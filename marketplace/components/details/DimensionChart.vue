<template>
  <div class="dimension-chart" ref="chartContainer">
    <canvas
      ref="chartCanvas"
      :width="canvasWidth"
      :height="canvasHeight"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import type { MarketplaceItem } from '../../types';

interface Props {
  dimension: string;
  value: any;
  item: MarketplaceItem;
  allItems: MarketplaceItem[];
}

const props = defineProps<Props>();

// Refs
const chartContainer = ref<HTMLDivElement>();
const chartCanvas = ref<HTMLCanvasElement>();
const canvasWidth = ref(280);
const canvasHeight = ref(80);

// Computed
const chartData = computed(() => {
  const values = props.allItems
    .map(item => item.dimensions[props.dimension])
    .filter(v => v !== undefined);

  if (values.length === 0) return null;

  // Handle numeric data
  if (values.every(v => typeof v === 'number')) {
    return {
      type: 'numeric',
      values: values as number[],
      currentValue: Number(props.value),
      min: Math.min(...(values as number[])),
      max: Math.max(...(values as number[])),
      avg: (values as number[]).reduce((a, b) => a + b, 0) / values.length
    };
  }

  // Handle categorical data
  const counts: Record<string, number> = {};
  values.forEach(v => {
    const key = String(v);
    counts[key] = (counts[key] || 0) + 1;
  });

  return {
    type: 'categorical',
    categories: Object.entries(counts).map(([key, count]) => ({
      value: key,
      count,
      percentage: (count / values.length) * 100
    })),
    currentValue: String(props.value),
    totalItems: values.length
  };
});

// Chart rendering
let animationFrame: number | null = null;

const renderChart = () => {
  const canvas = chartCanvas.value;
  const container = chartContainer.value;
  const data = chartData.value;

  if (!canvas || !container || !data) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height } = canvas;
  const padding = 10;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (data.type === 'numeric') {
    renderNumericChart(ctx, data, padding, chartWidth, chartHeight);
  } else {
    renderCategoricalChart(ctx, data, padding, chartWidth, chartHeight);
  }
};

const renderNumericChart = (
  ctx: CanvasRenderingContext2D,
  data: any,
  padding: number,
  width: number,
  height: number
) => {
  const { values, currentValue, min, max, avg } = data;

  // Create histogram
  const bins = 10;
  const binWidth = (max - min) / bins;
  const binCounts = new Array(bins).fill(0);

  values.forEach((value: number) => {
    let binIndex = Math.floor((value - min) / binWidth);
    if (binIndex >= bins) binIndex = bins - 1;
    binCounts[binIndex]++;
  });

  const maxCount = Math.max(...binCounts);
  const barWidth = width / bins;

  // Draw bars
  binCounts.forEach((count, i) => {
    const barHeight = (count / maxCount) * height;
    const x = padding + i * barWidth;
    const y = padding + height - barHeight;

    // Check if current value falls in this bin
    const binStart = min + i * binWidth;
    const binEnd = binStart + binWidth;
    const isCurrentBin = currentValue >= binStart && currentValue < binEnd;

    ctx.fillStyle = isCurrentBin ? '#007bff' : '#e9ecef';
    ctx.fillRect(x, y, barWidth - 1, barHeight);
  });

  // Draw current value line
  const currentX = padding + ((currentValue - min) / (max - min)) * width;
  ctx.strokeStyle = '#dc3545';
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(currentX, padding);
  ctx.lineTo(currentX, padding + height);
  ctx.stroke();

  // Draw average line
  const avgX = padding + ((avg - min) / (max - min)) * width;
  ctx.strokeStyle = '#28a745';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(avgX, padding);
  ctx.lineTo(avgX, padding + height);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw labels
  ctx.fillStyle = '#6c757d';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Min: ${min.toFixed(1)}`, padding, padding + height + 12);
  ctx.textAlign = 'right';
  ctx.fillText(`Max: ${max.toFixed(1)}`, padding + width, padding + height + 12);
  ctx.textAlign = 'center';
  ctx.fillText(`Avg: ${avg.toFixed(1)}`, avgX, padding - 5);
};

const renderCategoricalChart = (
  ctx: CanvasRenderingContext2D,
  data: any,
  padding: number,
  width: number,
  height: number
) => {
  const { categories, currentValue, totalItems } = data;
  
  // Sort categories by count
  const sortedCategories = [...categories].sort((a, b) => b.count - a.count);
  const visibleCategories = sortedCategories.slice(0, 5); // Show top 5

  const barHeight = height / visibleCategories.length;
  const maxCount = Math.max(...visibleCategories.map(c => c.count));

  // Draw bars
  visibleCategories.forEach((category, i) => {
    const barWidth = (category.count / maxCount) * width;
    const x = padding;
    const y = padding + i * barHeight;

    const isCurrent = category.value === currentValue;
    ctx.fillStyle = isCurrent ? '#007bff' : '#e9ecef';
    ctx.fillRect(x, y, barWidth, barHeight - 2);

    // Draw category label
    ctx.fillStyle = '#333';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'left';
    const labelText = category.value.length > 10 
      ? category.value.substring(0, 10) + '...' 
      : category.value;
    ctx.fillText(labelText, x + 2, y + barHeight / 2 + 3);

    // Draw count
    ctx.textAlign = 'right';
    ctx.fillStyle = '#6c757d';
    ctx.fillText(
      `${category.count} (${category.percentage.toFixed(1)}%)`,
      x + barWidth - 2,
      y + barHeight / 2 + 3
    );
  });
};

const resizeCanvas = () => {
  const container = chartContainer.value;
  const canvas = chartCanvas.value;

  if (!container || !canvas) return;

  const rect = container.getBoundingClientRect();
  canvasWidth.value = rect.width;
  canvasHeight.value = rect.height;

  // Update canvas size
  canvas.width = rect.width;
  canvas.height = rect.height;

  renderChart();
};

// Lifecycle
onMounted(() => {
  resizeCanvas();
  
  const resizeObserver = new ResizeObserver(() => {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(resizeCanvas);
  });

  if (chartContainer.value) {
    resizeObserver.observe(chartContainer.value);
  }

  onUnmounted(() => {
    resizeObserver.disconnect();
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
});

// Watch for data changes
watch(chartData, renderChart, { deep: true });
</script>

<style scoped>
.dimension-chart {
  width: 100%;
  height: 100%;
  position: relative;
  background: white;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>