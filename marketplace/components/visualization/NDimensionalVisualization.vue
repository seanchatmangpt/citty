<template>
  <div class="ndim-visualization">
    <!-- Controls Panel -->
    <div class="viz-controls">
      <div class="control-group">
        <label>Visualization Type:</label>
        <select v-model="config.type" @change="onConfigChanged">
          <option value="2d">2D Scatter Plot</option>
          <option value="3d">3D Scatter Plot</option>
          <option value="ndim">N-Dimensional (PCA)</option>
        </select>
      </div>
      
      <div class="control-group" v-if="config.type !== 'ndim'">
        <label>Dimensions:</label>
        <div class="dimension-selectors">
          <select
            v-for="(dim, index) in selectedDimensions"
            :key="index"
            v-model="selectedDimensions[index]"
            @change="updateDimensions"
          >
            <option value="">Select dimension...</option>
            <option
              v-for="dimension in availableDimensions"
              :key="dimension"
              :value="dimension"
            >
              {{ dimension }}
            </option>
          </select>
        </div>
      </div>
      
      <div class="control-group">
        <label>Color by:</label>
        <select v-model="config.colorDimension" @change="onConfigChanged">
          <option value="">None</option>
          <option
            v-for="dimension in categoricalDimensions"
            :key="dimension"
            :value="dimension"
          >
            {{ dimension }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <label>Size by:</label>
        <select v-model="config.sizeDimension" @change="onConfigChanged">
          <option value="">Fixed size</option>
          <option
            v-for="dimension in numericDimensions"
            :key="dimension"
            :value="dimension"
          >
            {{ dimension }}
          </option>
        </select>
      </div>
      
      <div class="control-group">
        <label>Opacity:</label>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.1"
          v-model="config.opacity"
          @input="onConfigChanged"
        />
        <span>{{ config.opacity }}</span>
      </div>
      
      <div class="control-toggles">
        <label>
          <input
            type="checkbox"
            v-model="config.showAxes"
            @change="onConfigChanged"
          />
          Show Axes
        </label>
        <label>
          <input
            type="checkbox"
            v-model="config.showGrid"
            @change="onConfigChanged"
          />
          Show Grid
        </label>
      </div>
    </div>

    <!-- Visualization Container -->
    <div class="viz-container" ref="vizContainer">
      <canvas
        ref="vizCanvas"
        @click="onCanvasClick"
        @mousemove="onCanvasHover"
      ></canvas>
      
      <!-- Tooltip -->
      <div
        v-if="hoveredItem"
        class="viz-tooltip"
        :style="tooltipStyle"
      >
        <div class="tooltip-title">{{ hoveredItem.name }}</div>
        <div class="tooltip-content">
          <div><strong>Price:</strong> ${{ hoveredItem.price.toLocaleString() }}</div>
          <div><strong>Category:</strong> {{ hoveredItem.category }}</div>
          <div
            v-for="(value, dimension) in getTooltipDimensions(hoveredItem)"
            :key="dimension"
            class="tooltip-dimension"
          >
            <strong>{{ dimension }}:</strong> {{ formatValue(value) }}
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="config.colorDimension" class="viz-legend">
      <h4>{{ config.colorDimension }}</h4>
      <div class="legend-items">
        <div
          v-for="(color, value) in colorMap"
          :key="value"
          class="legend-item"
        >
          <div class="legend-color" :style="{ backgroundColor: color }"></div>
          <span>{{ value }}</span>
        </div>
      </div>
    </div>

    <!-- Statistics Panel -->
    <div class="viz-stats">
      <h4>Statistics</h4>
      <div class="stats-content">
        <div><strong>Items:</strong> {{ items.length }}</div>
        <div><strong>Dimensions:</strong> {{ availableDimensions.length }}</div>
        <div v-if="selectedDimensions.length > 0">
          <strong>Displaying:</strong> {{ selectedDimensions.filter(d => d).join(', ') }}
        </div>
        <div v-if="selectedItem">
          <strong>Selected:</strong> {{ selectedItem.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { MarketplaceItem, VisualizationConfig } from '../../types';

interface Props {
  items: MarketplaceItem[];
  config: VisualizationConfig;
  selectedItem?: MarketplaceItem | null;
}

const props = withDefaults(defineProps<Props>(), {
  selectedItem: null
});

const emit = defineEmits<{
  itemSelected: [item: MarketplaceItem];
  configChanged: [config: VisualizationConfig];
}>();

// Reactive refs
const vizContainer = ref<HTMLDivElement>();
const vizCanvas = ref<HTMLCanvasElement>();
const hoveredItem = ref<MarketplaceItem | null>(null);
const tooltipPosition = ref({ x: 0, y: 0 });
const selectedDimensions = ref<string[]>([]);

// Local config copy
const config = ref<VisualizationConfig>({ ...props.config });

// Computed properties
const availableDimensions = computed(() => {
  const dims = new Set<string>();
  props.items.forEach(item => {
    Object.keys(item.dimensions).forEach(dim => dims.add(dim));
  });
  return Array.from(dims);
});

const numericDimensions = computed(() => {
  return availableDimensions.value.filter(dim => {
    return props.items.some(item => 
      typeof item.dimensions[dim] === 'number'
    );
  });
});

const categoricalDimensions = computed(() => {
  return availableDimensions.value.filter(dim => {
    const values = props.items.map(item => item.dimensions[dim]);
    const uniqueValues = new Set(values);
    return uniqueValues.size <= 10; // Consider as categorical if <= 10 unique values
  });
});

// Color mapping for categories
const colorMap = computed(() => {
  if (!config.value.colorDimension) return {};
  
  const values = [...new Set(props.items.map(item => 
    item.dimensions[config.value.colorDimension!]
  ))];
  
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
  ];
  
  const map: Record<string, string> = {};
  values.forEach((value, index) => {
    map[String(value)] = colors[index % colors.length];
  });
  
  return map;
});

// Tooltip styling
const tooltipStyle = computed(() => ({
  left: `${tooltipPosition.value.x + 10}px`,
  top: `${tooltipPosition.value.y - 10}px`
}));

// Visualization data processing
const processedData = computed(() => {
  const validDims = selectedDimensions.value.filter(d => d);
  
  if (config.value.type === 'ndim') {
    return processPCAData();
  }
  
  return props.items.map(item => {
    const point: any = { item };
    
    validDims.forEach((dim, index) => {
      const value = item.dimensions[dim];
      if (typeof value === 'number') {
        point[`dim${index}`] = value;
      } else {
        // Convert categorical to numeric for plotting
        point[`dim${index}`] = hashString(String(value)) % 100;
      }
    });
    
    // Color value
    if (config.value.colorDimension) {
      point.color = colorMap.value[String(item.dimensions[config.value.colorDimension])];
    }
    
    // Size value
    if (config.value.sizeDimension) {
      const sizeValue = item.dimensions[config.value.sizeDimension];
      if (typeof sizeValue === 'number') {
        point.size = Math.max(3, Math.min(20, sizeValue / 1000)); // Scale size
      }
    }
    
    return point;
  });
});

// Canvas rendering
let animationFrame: number | null = null;
let renderContext: CanvasRenderingContext2D | null = null;

const initCanvas = () => {
  const canvas = vizCanvas.value;
  const container = vizContainer.value;
  
  if (!canvas || !container) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  renderContext = ctx;
  
  // Set canvas size
  const resizeCanvas = () => {
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    render();
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Initial render
  render();
  
  return () => {
    window.removeEventListener('resize', resizeCanvas);
  };
};

const render = () => {
  const canvas = vizCanvas.value;
  const ctx = renderContext;
  
  if (!canvas || !ctx) return;
  
  const { width, height } = canvas;
  
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw grid if enabled
  if (config.value.showGrid) {
    drawGrid(ctx, width, height);
  }
  
  // Draw axes if enabled
  if (config.value.showAxes) {
    drawAxes(ctx, width, height);
  }
  
  // Draw data points
  drawDataPoints(ctx, width, height);
  
  // Draw selected item highlight
  if (props.selectedItem) {
    highlightSelectedItem(ctx, width, height);
  }
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.strokeStyle = '#E5E5E5';
  ctx.lineWidth = 1;
  
  const gridSpacing = 50;
  
  // Vertical lines
  for (let x = 0; x <= width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  // Horizontal lines
  for (let y = 0; y <= height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
};

const drawAxes = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  
  // X axis
  ctx.beginPath();
  ctx.moveTo(0, height - 50);
  ctx.lineTo(width, height - 50);
  ctx.stroke();
  
  // Y axis
  ctx.beginPath();
  ctx.moveTo(50, 0);
  ctx.lineTo(50, height);
  ctx.stroke();
  
  // Axis labels
  ctx.fillStyle = '#333';
  ctx.font = '12px sans-serif';
  
  const validDims = selectedDimensions.value.filter(d => d);
  if (validDims[0]) {
    ctx.fillText(validDims[0], width / 2, height - 20);
  }
  if (validDims[1]) {
    ctx.save();
    ctx.translate(20, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(validDims[1], 0, 0);
    ctx.restore();
  }
};

const drawDataPoints = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const data = processedData.value;
  
  if (data.length === 0) return;
  
  // Calculate bounds
  const bounds = calculateBounds(data);
  
  data.forEach(point => {
    const x = mapValue(point.dim0 || 0, bounds.x.min, bounds.x.max, 60, width - 20);
    const y = mapValue(point.dim1 || 0, bounds.y.min, bounds.y.max, height - 60, 20);
    
    const size = point.size || 5;
    const color = point.color || '#007bff';
    
    ctx.globalAlpha = config.value.opacity;
    ctx.fillStyle = color;
    
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    
    // Store position for click detection
    point.screenX = x;
    point.screenY = y;
    point.screenRadius = size;
  });
  
  ctx.globalAlpha = 1;
};

const highlightSelectedItem = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const selectedData = processedData.value.find(p => p.item.id === props.selectedItem?.id);
  
  if (!selectedData || !selectedData.screenX) return;
  
  ctx.strokeStyle = '#FF4444';
  ctx.lineWidth = 3;
  ctx.setLineDash([]);
  
  ctx.beginPath();
  ctx.arc(selectedData.screenX, selectedData.screenY, selectedData.screenRadius + 3, 0, Math.PI * 2);
  ctx.stroke();
};

const calculateBounds = (data: any[]) => {
  const bounds = {
    x: { min: Infinity, max: -Infinity },
    y: { min: Infinity, max: -Infinity }
  };
  
  data.forEach(point => {
    if (point.dim0 !== undefined) {
      bounds.x.min = Math.min(bounds.x.min, point.dim0);
      bounds.x.max = Math.max(bounds.x.max, point.dim0);
    }
    if (point.dim1 !== undefined) {
      bounds.y.min = Math.min(bounds.y.min, point.dim1);
      bounds.y.max = Math.max(bounds.y.max, point.dim1);
    }
  });
  
  return bounds;
};

const mapValue = (value: number, fromMin: number, fromMax: number, toMin: number, toMax: number) => {
  const ratio = (value - fromMin) / (fromMax - fromMin);
  return toMin + ratio * (toMax - toMin);
};

// PCA processing for n-dimensional visualization
const processPCAData = () => {
  // Simplified PCA implementation
  const numericDims = numericDimensions.value;
  if (numericDims.length < 2) return [];
  
  // Extract numeric data matrix
  const matrix = props.items.map(item => 
    numericDims.map(dim => Number(item.dimensions[dim]) || 0)
  );
  
  // Center the data
  const means = numericDims.map((_, colIndex) => {
    const sum = matrix.reduce((acc, row) => acc + row[colIndex], 0);
    return sum / matrix.length;
  });
  
  const centeredMatrix = matrix.map(row => 
    row.map((value, index) => value - means[index])
  );
  
  // For simplicity, project onto first 2 dimensions
  return props.items.map((item, index) => ({
    item,
    dim0: centeredMatrix[index][0],
    dim1: centeredMatrix[index][1],
    color: config.value.colorDimension ? 
      colorMap.value[String(item.dimensions[config.value.colorDimension])] : undefined,
    size: config.value.sizeDimension ?
      Math.max(3, Math.min(20, Number(item.dimensions[config.value.sizeDimension]) / 1000)) : 5
  }));
};

// Event handlers
const onCanvasClick = (event: MouseEvent) => {
  const canvas = vizCanvas.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Find clicked item
  const data = processedData.value;
  const clickedItem = data.find(point => {
    if (!point.screenX || !point.screenY) return false;
    
    const dx = x - point.screenX;
    const dy = y - point.screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= point.screenRadius + 5;
  });
  
  if (clickedItem) {
    emit('itemSelected', clickedItem.item);
  }
};

const onCanvasHover = (event: MouseEvent) => {
  const canvas = vizCanvas.value;
  if (!canvas) return;
  
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  tooltipPosition.value = { x: event.clientX, y: event.clientY };
  
  // Find hovered item
  const data = processedData.value;
  const hoveredPoint = data.find(point => {
    if (!point.screenX || !point.screenY) return false;
    
    const dx = x - point.screenX;
    const dy = y - point.screenY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    return distance <= point.screenRadius + 2;
  });
  
  hoveredItem.value = hoveredPoint?.item || null;
  
  // Update cursor
  canvas.style.cursor = hoveredPoint ? 'pointer' : 'default';
};

const onConfigChanged = () => {
  emit('configChanged', { ...config.value });
  nextTick(() => render());
};

const updateDimensions = () => {
  config.value.dimensions = selectedDimensions.value.filter(d => d);
  onConfigChanged();
};

// Utility functions
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

const getTooltipDimensions = (item: MarketplaceItem) => {
  const entries = Object.entries(item.dimensions);
  return Object.fromEntries(entries.slice(0, 5)); // Show first 5 dimensions
};

const formatValue = (value: any): string => {
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

// Watch for config changes
watch(() => props.config, (newConfig) => {
  config.value = { ...newConfig };
  selectedDimensions.value = [...newConfig.dimensions];
}, { deep: true, immediate: true });

// Watch for data changes
watch(() => props.items, () => {
  nextTick(() => render());
}, { deep: true });

// Lifecycle
onMounted(() => {
  const cleanup = initCanvas();
  
  onUnmounted(() => {
    if (cleanup) cleanup();
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });
  
  // Initialize selected dimensions
  if (config.value.dimensions.length > 0) {
    selectedDimensions.value = [...config.value.dimensions];
  } else if (availableDimensions.value.length >= 2) {
    selectedDimensions.value = availableDimensions.value.slice(0, 3);
  }
});
</script>

<style scoped>
.ndim-visualization {
  display: grid;
  grid-template-columns: 300px 1fr 200px;
  grid-template-rows: 1fr auto;
  height: 100%;
  gap: 1rem;
  background: #f8f9fa;
  padding: 1rem;
}

.viz-controls {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow-y: auto;
}

.control-group {
  margin-bottom: 1rem;
}

.control-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #333;
}

.control-group select,
.control-group input[type="range"] {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.dimension-selectors {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-toggles {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.control-toggles label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: normal;
  cursor: pointer;
}

.viz-container {
  position: relative;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.viz-container canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.viz-tooltip {
  position: fixed;
  background: rgba(0,0,0,0.9);
  color: white;
  padding: 0.75rem;
  border-radius: 4px;
  font-size: 0.875rem;
  pointer-events: none;
  z-index: 1000;
  max-width: 250px;
}

.tooltip-title {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #fff;
}

.tooltip-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tooltip-dimension {
  color: #ccc;
}

.viz-legend {
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.viz-legend h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 0.875rem;
}

.legend-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid #ddd;
}

.viz-stats {
  grid-column: 1 / -1;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.viz-stats h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 0.875rem;
}

.stats-content {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  font-size: 0.875rem;
}

@media (max-width: 1024px) {
  .ndim-visualization {
    grid-template-columns: 250px 1fr;
    grid-template-rows: 1fr auto auto;
  }
  
  .viz-legend {
    grid-column: 1 / -1;
  }
}

@media (max-width: 768px) {
  .ndim-visualization {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto 1fr auto;
  }
  
  .viz-controls {
    order: 1;
  }
  
  .viz-container {
    order: 3;
    height: 400px;
  }
  
  .viz-legend {
    order: 2;
  }
  
  .viz-stats {
    order: 4;
  }
}
</style>