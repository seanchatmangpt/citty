<template>
  <div class="workflow-progress">
    <div class="progress-header">
      <div class="progress-info">
        <h4 v-if="workflow.currentStep">Current: {{ formatStepName(workflow.currentStep) }}</h4>
        <div class="progress-stats">
          <span class="completed-count">{{ workflow.completedSteps.length }} completed</span>
          <span class="remaining-count">{{ workflow.remainingSteps.length }} remaining</span>
          <span class="progress-percentage">{{ Math.round(workflow.progress * 100) }}%</span>
        </div>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-bar-container">
      <div class="progress-bar">
        <div 
          class="progress-fill" 
          :style="{ width: `${workflow.progress * 100}%` }"
        ></div>
      </div>
    </div>

    <!-- Step Timeline -->
    <div class="step-timeline">
      <!-- Completed Steps -->
      <div
        v-for="step in workflow.completedSteps"
        :key="`completed-${step}`"
        class="step-item completed"
        :class="{ clickable: interactive }"
        @click="interactive && $emit('stepClicked', step)"
      >
        <div class="step-marker">
          <span class="check-icon">✓</span>
        </div>
        <div class="step-content">
          <div class="step-name">{{ formatStepName(step) }}</div>
          <div class="step-status">Completed</div>
          <div class="step-time">{{ getStepCompletionTime(step) }}</div>
        </div>
      </div>

      <!-- Current Step -->
      <div
        v-if="workflow.currentStep"
        class="step-item current"
        :class="{ clickable: interactive }"
        @click="interactive && $emit('stepClicked', workflow.currentStep)"
      >
        <div class="step-marker">
          <div class="loading-spinner"></div>
        </div>
        <div class="step-content">
          <div class="step-name">{{ formatStepName(workflow.currentStep) }}</div>
          <div class="step-status">In Progress</div>
          <div class="step-time">{{ getCurrentStepDuration() }}</div>
        </div>
        
        <!-- Current Step Details -->
        <div v-if="showCurrentStepDetails" class="step-details">
          <div class="detail-item">
            <span class="detail-label">Estimated completion:</span>
            <span class="detail-value">{{ getEstimatedCompletion() }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Required actions:</span>
            <span class="detail-value">{{ getCurrentStepActions() }}</span>
          </div>
        </div>
      </div>

      <!-- Remaining Steps -->
      <div
        v-for="(step, index) in workflow.remainingSteps"
        :key="`remaining-${step}`"
        class="step-item pending"
        :class="{ 
          clickable: interactive,
          'next-step': index === 0 && !workflow.currentStep
        }"
        @click="interactive && $emit('stepClicked', step)"
      >
        <div class="step-marker">
          <span class="step-number">{{ index + 1 }}</span>
        </div>
        <div class="step-content">
          <div class="step-name">{{ formatStepName(step) }}</div>
          <div class="step-status">
            {{ index === 0 && !workflow.currentStep ? 'Next' : 'Pending' }}
          </div>
          <div class="step-time">{{ getStepEstimate(step) }}</div>
        </div>
      </div>
    </div>

    <!-- Workflow Metadata -->
    <div v-if="showMetadata && workflow.metadata && Object.keys(workflow.metadata).length > 0" class="workflow-metadata">
      <h5>Additional Information</h5>
      <div class="metadata-grid">
        <div
          v-for="(value, key) in workflow.metadata"
          :key="key"
          class="metadata-item"
        >
          <span class="metadata-key">{{ formatMetadataKey(key) }}:</span>
          <span class="metadata-value">{{ formatMetadataValue(value) }}</span>
        </div>
      </div>
    </div>

    <!-- Workflow Actions -->
    <div v-if="showActions" class="workflow-actions">
      <button
        v-if="canRetry"
        @click="$emit('retryWorkflow')"
        class="workflow-btn retry"
      >
        Retry Current Step
      </button>
      <button
        v-if="canSkip"
        @click="$emit('skipStep', workflow.currentStep)"
        class="workflow-btn skip"
      >
        Skip Current Step
      </button>
      <button
        v-if="canCancel"
        @click="$emit('cancelWorkflow')"
        class="workflow-btn cancel"
      >
        Cancel Workflow
      </button>
      <button
        @click="$emit('refreshWorkflow')"
        class="workflow-btn refresh"
      >
        Refresh Status
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WorkflowState } from '../../types';

interface Props {
  workflow: WorkflowState;
  interactive?: boolean;
  showMetadata?: boolean;
  showActions?: boolean;
  showCurrentStepDetails?: boolean;
  canRetry?: boolean;
  canSkip?: boolean;
  canCancel?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  interactive: false,
  showMetadata: false,
  showActions: false,
  showCurrentStepDetails: false,
  canRetry: false,
  canSkip: false,
  canCancel: false
});

const emit = defineEmits<{
  stepClicked: [step: string];
  retryWorkflow: [];
  skipStep: [step: string];
  cancelWorkflow: [];
  refreshWorkflow: [];
}>();

// Computed properties
const allSteps = computed(() => [
  ...props.workflow.completedSteps,
  ...(props.workflow.currentStep ? [props.workflow.currentStep] : []),
  ...props.workflow.remainingSteps
]);

// Methods
const formatStepName = (step: string) => {
  return step
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatMetadataKey = (key: string) => {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const formatMetadataValue = (value: any) => {
  if (typeof value === 'object' && value !== null) {
    if (value instanceof Date) {
      return formatDateTime(value);
    }
    return JSON.stringify(value, null, 2);
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
};

const formatDateTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const getStepCompletionTime = (step: string) => {
  // Mock completion times based on step
  const mockTimes: Record<string, string> = {
    'payment_verification': '2 min ago',
    'seller_notification': '1 min ago',
    'item_verification': '30 sec ago'
  };
  return mockTimes[step] || 'Recently';
};

const getCurrentStepDuration = () => {
  // Mock current step duration
  return 'Running for 45 seconds';
};

const getEstimatedCompletion = () => {
  // Mock estimated completion
  const estimates: Record<string, string> = {
    'payment_processing': '2-3 minutes',
    'item_preparation': '1-2 hours',
    'shipping_setup': '30 minutes',
    'quality_check': '15 minutes'
  };
  return estimates[props.workflow.currentStep || ''] || '5-10 minutes';
};

const getCurrentStepActions = () => {
  // Mock required actions for current step
  const actions: Record<string, string> = {
    'payment_processing': 'Awaiting bank confirmation',
    'item_preparation': 'Seller action required',
    'shipping_setup': 'Generating shipping label',
    'quality_check': 'Automated verification'
  };
  return actions[props.workflow.currentStep || ''] || 'System processing';
};

const getStepEstimate = (step: string) => {
  // Mock time estimates for pending steps
  const estimates: Record<string, string> = {
    'payment_processing': '~2 min',
    'item_preparation': '~1 hour',
    'shipping_setup': '~30 min',
    'quality_check': '~15 min',
    'delivery_setup': '~5 min',
    'completion': '~1 min'
  };
  return estimates[step] || '~10 min';
};
</script>

<style scoped>
.workflow-progress {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 1.5rem;
}

.progress-header {
  margin-bottom: 1.5rem;
}

.progress-info h4 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.125rem;
}

.progress-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: #6c757d;
}

.progress-percentage {
  color: #007bff;
  font-weight: 600;
}

.progress-bar-container {
  margin-bottom: 2rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007bff, #0056b3);
  transition: width 0.3s ease;
}

.step-timeline {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.step-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  transition: all 0.2s ease;
  padding: 0.75rem;
  border-radius: 6px;
}

.step-item.clickable {
  cursor: pointer;
}

.step-item.clickable:hover {
  background: #f8f9fa;
}

.step-item.completed {
  opacity: 0.8;
}

.step-item.current {
  background: #e3f2fd;
  border: 1px solid #bbdefb;
}

.step-item.next-step {
  background: #f3e5f5;
  border: 1px solid #e1bee7;
}

.step-marker {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-weight: 600;
}

.step-item.completed .step-marker {
  background: #28a745;
  color: white;
}

.step-item.current .step-marker {
  background: #007bff;
  color: white;
}

.step-item.pending .step-marker {
  background: #e9ecef;
  color: #6c757d;
  border: 2px solid #dee2e6;
}

.step-item.next-step .step-marker {
  background: #9c27b0;
  color: white;
}

.check-icon {
  font-size: 16px;
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.step-number {
  font-size: 14px;
}

.step-content {
  flex: 1;
  min-width: 0;
}

.step-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.25rem;
}

.step-status {
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 0.25rem;
}

.step-item.completed .step-status {
  color: #28a745;
}

.step-item.current .step-status {
  color: #007bff;
}

.step-item.next-step .step-status {
  color: #9c27b0;
}

.step-time {
  font-size: 0.75rem;
  color: #6c757d;
}

.step-details {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.875rem;
}

.detail-label {
  color: #6c757d;
  font-weight: 500;
}

.detail-value {
  color: #333;
}

.workflow-metadata {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #dee2e6;
}

.workflow-metadata h5 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1rem;
}

.metadata-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.metadata-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: #f8f9fa;
  border-radius: 4px;
  font-size: 0.875rem;
}

.metadata-key {
  color: #6c757d;
  font-weight: 500;
}

.metadata-value {
  color: #333;
  word-break: break-word;
}

.workflow-actions {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid #dee2e6;
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.workflow-btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.workflow-btn.retry {
  border: 1px solid #28a745;
  background: white;
  color: #28a745;
}

.workflow-btn.retry:hover {
  background: #28a745;
  color: white;
}

.workflow-btn.skip {
  border: 1px solid #ffc107;
  background: white;
  color: #ffc107;
}

.workflow-btn.skip:hover {
  background: #ffc107;
  color: #333;
}

.workflow-btn.cancel {
  border: 1px solid #dc3545;
  background: white;
  color: #dc3545;
}

.workflow-btn.cancel:hover {
  background: #dc3545;
  color: white;
}

.workflow-btn.refresh {
  border: 1px solid #6c757d;
  background: white;
  color: #6c757d;
}

.workflow-btn.refresh:hover {
  background: #6c757d;
  color: white;
}

@media (max-width: 768px) {
  .progress-stats {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .step-item {
    padding: 0.5rem;
  }
  
  .metadata-grid {
    grid-template-columns: 1fr;
  }
  
  .metadata-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.25rem;
  }
  
  .workflow-actions {
    flex-direction: column;
  }
  
  .workflow-btn {
    text-align: center;
  }
}
</style>