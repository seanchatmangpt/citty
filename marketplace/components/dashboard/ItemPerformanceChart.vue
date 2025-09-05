<template>
  <div class="item-performance-chart">
    <canvas
      ref="chartCanvas"
      :width="canvasWidth"
      :height="canvasHeight"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';

interface PerformanceData {
  name: string;
  views: number;
  sales: number;
  revenue: number;
}

interface Props {
  data: PerformanceData[];
  view: 'views' | 'sales';
}

const props = defineProps<Props>();

// Refs
const chartCanvas = ref<HTMLCanvasElement>();
const canvasWidth = ref(300);
const canvasHeight = ref(200);

// Computed
const chartData = computed(() => {
  if (!props.data.length) return [];
  
  return props.data
    .map(item => ({
      name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
      value: props.view === 'views' ? item.views : item.sales
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10); // Show top 10 items
});

// Chart rendering
let animationFrame: number | null = null;

const renderChart = () => {
  const canvas = chartCanvas.value;
  if (!canvas || !chartData.value.length) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const padding = 60;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (chartData.value.length === 0) {
    // Show "No data" message
    ctx.fillStyle = '#6c757d';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }

  const maxValue = Math.max(...chartData.value.map(d => d.value));
  const barHeight = chartHeight / chartData.value.length;
  const colors = [
    '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1',
    '#fd7e14', '#20c997', '#6c757d', '#e83e8c', '#17a2b8'
  ];

  // Draw bars
  chartData.value.forEach((item, index) => {
    const barWidth = (item.value / maxValue) * chartWidth;
    const y = padding + index * barHeight;
    const barActualHeight = barHeight * 0.7; // Leave some spacing

    // Draw bar
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(padding, y, barWidth, barActualHeight);

    // Draw item name
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(item.name, padding + 5, y + barActualHeight / 2 + 4);

    // Draw value
    ctx.textAlign = 'right';
    const valueText = props.view === 'views' ? `${item.value} views` : `${item.value} sales`;
    ctx.fillText(valueText, padding + barWidth - 5, y + barActualHeight / 2 + 4);
  });

  // Draw title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  const title = props.view === 'views' ? 'Top Items by Views' : 'Top Items by Sales';
  ctx.fillText(title, width / 2, 20);

  // Draw axis line
  ctx.strokeStyle = '#dee2e6';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();
};

const resizeChart = () => {
  const canvas = chartCanvas.value;
  if (!canvas || !canvas.parentElement) return;

  const rect = canvas.parentElement.getBoundingClientRect();
  canvasWidth.value = rect.width;
  canvasHeight.value = rect.height;

  canvas.width = rect.width;
  canvas.height = rect.height;

  renderChart();
};

// Lifecycle
onMounted(() => {
  resizeChart();
  
  const resizeObserver = new ResizeObserver(() => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(resizeChart);
  });

  if (chartCanvas.value?.parentElement) {
    resizeObserver.observe(chartCanvas.value.parentElement);
  }

  onUnmounted(() => {
    resizeObserver.disconnect();
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
});

// Watch for data changes
watch(chartData, renderChart, { deep: true });
watch(() => props.view, renderChart);
</script>

<style scoped>
.item-performance-chart {
  width: 100%;
  height: 100%;
  position: relative;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>