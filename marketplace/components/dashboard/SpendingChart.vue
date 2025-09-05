<template>
  <div class="spending-chart">
    <canvas
      ref="chartCanvas"
      :width="canvasWidth"
      :height="canvasHeight"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor: string;
    borderColor: string;
  }>;
}

interface Props {
  data: ChartData;
  period: string;
}

const props = defineProps<Props>();

// Refs
const chartCanvas = ref<HTMLCanvasElement>();
const canvasWidth = ref(400);
const canvasHeight = ref(200);

// Chart rendering
let animationFrame: number | null = null;

const renderChart = () => {
  const canvas = chartCanvas.value;
  if (!canvas || !props.data) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (!props.data.datasets[0]?.data.length) {
    // Show "No data" message
    ctx.fillStyle = '#6c757d';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('No spending data available', width / 2, height / 2);
    return;
  }

  const dataset = props.data.datasets[0];
  const dataPoints = dataset.data;
  const labels = props.data.labels;
  const maxValue = Math.max(...dataPoints, 1);

  // Draw grid lines
  ctx.strokeStyle = '#e9ecef';
  ctx.lineWidth = 1;

  // Horizontal grid lines
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (i * chartHeight) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Draw bars
  const barWidth = chartWidth / labels.length * 0.6;
  const barSpacing = chartWidth / labels.length;

  for (let i = 0; i < dataPoints.length; i++) {
    const barHeight = (dataPoints[i] / maxValue) * chartHeight;
    const x = padding + i * barSpacing + (barSpacing - barWidth) / 2;
    const y = height - padding - barHeight;

    // Create gradient
    const gradient = ctx.createLinearGradient(0, y, 0, height - padding);
    gradient.addColorStop(0, dataset.borderColor);
    gradient.addColorStop(1, dataset.backgroundColor);

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Draw value on top of bar
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$' + dataPoints[i].toString(), x + barWidth / 2, y - 5);
  }

  // Draw axes
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;

  // X axis
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  // Y axis
  ctx.beginPath();
  ctx.moveTo(padding, padding);
  ctx.lineTo(padding, height - padding);
  ctx.stroke();

  // Draw labels
  ctx.fillStyle = '#6c757d';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';

  // X axis labels
  for (let i = 0; i < labels.length; i++) {
    const x = padding + i * barSpacing + barSpacing / 2;
    ctx.fillText(labels[i], x, height - padding + 20);
  }

  // Y axis labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= gridLines; i++) {
    const value = (maxValue * (gridLines - i)) / gridLines;
    const y = padding + (i * chartHeight) / gridLines;
    ctx.fillText('$' + Math.round(value).toString(), padding - 10, y + 4);
  }

  // Draw title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Monthly Spending (${props.period})`, width / 2, 20);

  // Draw average line
  const avgSpending = dataPoints.reduce((sum, val) => sum + val, 0) / dataPoints.length;
  const avgY = height - padding - (avgSpending / maxValue) * chartHeight;
  
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#dc3545';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding, avgY);
  ctx.lineTo(width - padding, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Average label
  ctx.fillStyle = '#dc3545';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Avg: $' + Math.round(avgSpending), padding + 10, avgY - 5);
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
watch(() => props.data, renderChart, { deep: true });
watch(() => props.period, renderChart);
</script>

<style scoped>
.spending-chart {
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