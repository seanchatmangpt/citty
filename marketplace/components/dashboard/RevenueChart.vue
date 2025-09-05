<template>
  <div class="revenue-chart">
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
    borderColor: string;
    backgroundColor: string;
    tension?: number;
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
    ctx.fillText('No data available', width / 2, height / 2);
    return;
  }

  const dataset = props.data.datasets[0];
  const dataPoints = dataset.data;
  const labels = props.data.labels;
  const maxValue = Math.max(...dataPoints);
  const minValue = Math.min(...dataPoints);
  const range = maxValue - minValue || 1;

  // Draw grid lines
  ctx.strokeStyle = '#e9ecef';
  ctx.lineWidth = 1;

  // Horizontal grid lines
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding + (i * chartHeight) / gridLines;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  // Vertical grid lines
  const stepX = chartWidth / (labels.length - 1);
  for (let i = 0; i < labels.length; i++) {
    const x = padding + i * stepX;
    ctx.beginPath();
    ctx.moveTo(x, padding);
    ctx.lineTo(x, height - padding);
    ctx.stroke();
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

  // Draw area fill
  if (dataset.backgroundColor) {
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding);
    gradient.addColorStop(0, dataset.backgroundColor);
    gradient.addColorStop(1, 'rgba(0, 123, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(padding, height - padding);
    
    for (let i = 0; i < dataPoints.length; i++) {
      const x = padding + i * stepX;
      const y = height - padding - ((dataPoints[i] - minValue) / range) * chartHeight;
      
      if (i === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.lineTo(width - padding, height - padding);
    ctx.closePath();
    ctx.fill();
  }

  // Draw line
  ctx.strokeStyle = dataset.borderColor;
  ctx.lineWidth = 3;
  ctx.beginPath();

  for (let i = 0; i < dataPoints.length; i++) {
    const x = padding + i * stepX;
    const y = height - padding - ((dataPoints[i] - minValue) / range) * chartHeight;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Draw data points
  ctx.fillStyle = dataset.borderColor;
  for (let i = 0; i < dataPoints.length; i++) {
    const x = padding + i * stepX;
    const y = height - padding - ((dataPoints[i] - minValue) / range) * chartHeight;
    
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw labels
  ctx.fillStyle = '#6c757d';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';

  // X axis labels
  for (let i = 0; i < labels.length; i++) {
    const x = padding + i * stepX;
    ctx.fillText(labels[i], x, height - padding + 20);
  }

  // Y axis labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= gridLines; i++) {
    const value = minValue + (range * (gridLines - i)) / gridLines;
    const y = padding + (i * chartHeight) / gridLines;
    ctx.fillText('$' + value.toFixed(0), padding - 10, y + 4);
  }

  // Draw title
  ctx.fillStyle = '#333';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Revenue Trend (${props.period})`, width / 2, 20);
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
.revenue-chart {
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