<template>
  <div class="transaction-flow">
    <!-- Transaction Header -->
    <div class="transaction-header">
      <div class="transaction-info">
        <h3>Transaction Flow</h3>
        <div class="transaction-meta">
          <span class="transaction-id">ID: {{ transaction.id }}</span>
          <span class="transaction-status" :class="transaction.status">
            {{ getStatusLabel(transaction.status) }}
          </span>
          <span class="transaction-date">
            {{ formatDateTime(transaction.timestamp) }}
          </span>
        </div>
      </div>
      
      <div class="transaction-actions">
        <button
          v-if="canCancel"
          @click="cancelTransaction"
          class="action-btn cancel"
        >
          Cancel
        </button>
        <button
          v-if="canRefund"
          @click="initiateRefund"
          class="action-btn refund"
        >
          Refund
        </button>
        <button
          @click="refreshTransaction"
          class="action-btn refresh"
        >
          Refresh
        </button>
      </div>
    </div>

    <!-- Transaction Details -->
    <div class="transaction-details">
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Item:</span>
          <span class="detail-value">{{ itemName }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Amount:</span>
          <span class="detail-value amount">${{ transaction.amount.toLocaleString() }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Buyer:</span>
          <span class="detail-value">{{ getBuyerName(transaction.buyerId) }}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Seller:</span>
          <span class="detail-value">{{ getSellerName(transaction.sellerId) }}</span>
        </div>
      </div>
    </div>

    <!-- Workflow Progress -->
    <div class="workflow-section">
      <h4>Transaction Progress</h4>
      <WorkflowProgress
        :workflow="transaction.workflowState"
        @step-clicked="onStepClicked"
        :interactive="true"
      />
    </div>

    <!-- Step Details -->
    <div v-if="selectedStep" class="step-details">
      <div class="step-header">
        <h4>{{ selectedStep.name }}</h4>
        <span class="step-status" :class="selectedStep.status">
          {{ selectedStep.status }}
        </span>
      </div>
      
      <div class="step-content">
        <p>{{ selectedStep.description }}</p>
        
        <div v-if="selectedStep.actions.length > 0" class="step-actions">
          <h5>Available Actions:</h5>
          <div class="action-buttons">
            <button
              v-for="action in selectedStep.actions"
              :key="action.id"
              @click="executeStepAction(action)"
              :disabled="!action.enabled"
              class="step-action-btn"
              :class="action.type"
            >
              {{ action.label }}
            </button>
          </div>
        </div>
        
        <div v-if="selectedStep.requirements.length > 0" class="step-requirements">
          <h5>Requirements:</h5>
          <ul>
            <li
              v-for="requirement in selectedStep.requirements"
              :key="requirement.id"
              :class="{ completed: requirement.satisfied }"
            >
              {{ requirement.description }}
              <span v-if="requirement.satisfied" class="check">✓</span>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Transaction Timeline -->
    <div class="timeline-section">
      <h4>Transaction Timeline</h4>
      <div class="timeline">
        <div
          v-for="event in transactionEvents"
          :key="event.id"
          class="timeline-event"
          :class="event.type"
        >
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div class="event-header">
              <span class="event-title">{{ event.title }}</span>
              <span class="event-time">{{ formatTime(event.timestamp) }}</span>
            </div>
            <p class="event-description">{{ event.description }}</p>
            <div v-if="event.metadata" class="event-metadata">
              <div
                v-for="(value, key) in event.metadata"
                :key="key"
                class="metadata-item"
              >
                <span class="metadata-key">{{ key }}:</span>
                <span class="metadata-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Information -->
    <div v-if="paymentInfo" class="payment-section">
      <h4>Payment Information</h4>
      <div class="payment-details">
        <div class="payment-method">
          <span class="payment-label">Method:</span>
          <span class="payment-value">{{ paymentInfo.method }}</span>
        </div>
        <div class="payment-status">
          <span class="payment-label">Status:</span>
          <span class="payment-value" :class="paymentInfo.status">
            {{ paymentInfo.status }}
          </span>
        </div>
        <div v-if="paymentInfo.reference" class="payment-reference">
          <span class="payment-label">Reference:</span>
          <span class="payment-value">{{ paymentInfo.reference }}</span>
        </div>
        <div v-if="paymentInfo.fees" class="payment-fees">
          <span class="payment-label">Fees:</span>
          <span class="payment-value">${{ paymentInfo.fees.toFixed(2) }}</span>
        </div>
      </div>
    </div>

    <!-- Documents and Attachments -->
    <div v-if="documents.length > 0" class="documents-section">
      <h4>Documents & Attachments</h4>
      <div class="documents-list">
        <div
          v-for="document in documents"
          :key="document.id"
          class="document-item"
        >
          <div class="document-info">
            <span class="document-name">{{ document.name }}</span>
            <span class="document-type">{{ document.type }}</span>
            <span class="document-size">{{ formatFileSize(document.size) }}</span>
          </div>
          <div class="document-actions">
            <button @click="downloadDocument(document)" class="download-btn">
              Download
            </button>
            <button @click="viewDocument(document)" class="view-btn">
              View
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Dispute Section -->
    <div v-if="dispute" class="dispute-section">
      <h4>Dispute Information</h4>
      <div class="dispute-alert">
        <div class="alert-header">
          <span class="alert-icon">⚠️</span>
          <span class="alert-title">Transaction Disputed</span>
        </div>
        <p class="dispute-reason">{{ dispute.reason }}</p>
        <div class="dispute-details">
          <div class="dispute-field">
            <span class="field-label">Filed by:</span>
            <span class="field-value">{{ dispute.filedBy }}</span>
          </div>
          <div class="dispute-field">
            <span class="field-label">Status:</span>
            <span class="field-value dispute-status" :class="dispute.status">
              {{ dispute.status }}
            </span>
          </div>
          <div class="dispute-field">
            <span class="field-label">Filed on:</span>
            <span class="field-value">{{ formatDateTime(dispute.filedAt) }}</span>
          </div>
        </div>
        
        <div class="dispute-actions">
          <button @click="viewDisputeDetails" class="dispute-btn">
            View Details
          </button>
          <button @click="respondToDispute" class="dispute-btn primary">
            Respond
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Transaction, WorkflowState } from '../../types';
import WorkflowProgress from '../workflows/WorkflowProgress.vue';

interface TransactionEvent {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  type: 'info' | 'success' | 'warning' | 'error';
  metadata?: Record<string, any>;
}

interface PaymentInfo {
  method: string;
  status: string;
  reference?: string;
  fees?: number;
}

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

interface Dispute {
  id: string;
  reason: string;
  filedBy: string;
  status: string;
  filedAt: Date;
}

interface StepAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  enabled: boolean;
}

interface StepRequirement {
  id: string;
  description: string;
  satisfied: boolean;
}

interface StepDetails {
  name: string;
  status: string;
  description: string;
  actions: StepAction[];
  requirements: StepRequirement[];
}

interface Props {
  transaction: Transaction;
  itemName?: string;
}

const props = withDefaults(defineProps<Props>(), {
  itemName: 'Unknown Item'
});

const emit = defineEmits<{
  transactionUpdated: [transaction: Transaction];
  actionExecuted: [action: string, result: any];
}>();

// Reactive state
const selectedStep = ref<StepDetails | null>(null);
const transactionEvents = ref<TransactionEvent[]>([]);
const paymentInfo = ref<PaymentInfo | null>(null);
const documents = ref<Document[]>([]);
const dispute = ref<Dispute | null>(null);

// Computed properties
const canCancel = computed(() => 
  props.transaction.status === 'pending' &&
  !props.transaction.workflowState.completedSteps.includes('payment_processed')
);

const canRefund = computed(() =>
  props.transaction.status === 'completed' &&
  props.transaction.workflowState.completedSteps.includes('payment_processed')
);

// Methods
const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: 'Pending',
    completed: 'Completed',
    failed: 'Failed',
    refunded: 'Refunded'
  };
  return labels[status] || status;
};

const formatDateTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date));
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getBuyerName = (buyerId: string) => {
  return `Buyer ${buyerId.substring(0, 8)}`;
};

const getSellerName = (sellerId: string) => {
  return `Seller ${sellerId.substring(0, 8)}`;
};

const onStepClicked = (stepId: string) => {
  // Mock step details based on step ID
  const stepDetailsMap: Record<string, StepDetails> = {
    'payment_verification': {
      name: 'Payment Verification',
      status: 'in_progress',
      description: 'Verifying payment method and processing transaction.',
      actions: [
        { id: 'verify_payment', label: 'Verify Payment', type: 'primary', enabled: true },
        { id: 'request_documents', label: 'Request Documents', type: 'secondary', enabled: true }
      ],
      requirements: [
        { id: 'payment_method', description: 'Valid payment method', satisfied: true },
        { id: 'buyer_verification', description: 'Buyer identity verified', satisfied: false }
      ]
    },
    'item_preparation': {
      name: 'Item Preparation',
      status: 'pending',
      description: 'Seller preparing item for shipment.',
      actions: [
        { id: 'mark_ready', label: 'Mark Ready', type: 'primary', enabled: false },
        { id: 'upload_photos', label: 'Upload Photos', type: 'secondary', enabled: true }
      ],
      requirements: [
        { id: 'item_packaged', description: 'Item properly packaged', satisfied: false },
        { id: 'shipping_label', description: 'Shipping label created', satisfied: false }
      ]
    }
  };
  
  selectedStep.value = stepDetailsMap[stepId] || null;
};

const executeStepAction = (action: StepAction) => {
  console.log('Executing action:', action);
  emit('actionExecuted', action.id, { success: true, message: 'Action executed successfully' });
};

const cancelTransaction = () => {
  if (confirm('Are you sure you want to cancel this transaction?')) {
    console.log('Canceling transaction:', props.transaction.id);
  }
};

const initiateRefund = () => {
  if (confirm('Are you sure you want to initiate a refund?')) {
    console.log('Initiating refund for transaction:', props.transaction.id);
  }
};

const refreshTransaction = () => {
  console.log('Refreshing transaction data...');
  loadTransactionData();
};

const downloadDocument = (document: Document) => {
  const link = document.createElement('a');
  link.href = document.url;
  link.download = document.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const viewDocument = (document: Document) => {
  window.open(document.url, '_blank');
};

const viewDisputeDetails = () => {
  console.log('Opening dispute details...');
};

const respondToDispute = () => {
  console.log('Opening dispute response form...');
};

const loadTransactionData = () => {
  // Mock transaction events
  transactionEvents.value = [
    {
      id: '1',
      title: 'Transaction Created',
      description: 'Transaction initiated by buyer',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      type: 'info'
    },
    {
      id: '2',
      title: 'Payment Processing',
      description: 'Payment method verified and charge initiated',
      timestamp: new Date(Date.now() - 3 * 60 * 1000),
      type: 'info',
      metadata: {
        'Payment Method': 'Credit Card ****1234',
        'Gateway': 'Stripe'
      }
    },
    {
      id: '3',
      title: 'Seller Notified',
      description: 'Seller has been notified of the purchase',
      timestamp: new Date(Date.now() - 2 * 60 * 1000),
      type: 'success'
    }
  ];

  // Mock payment info
  paymentInfo.value = {
    method: 'Credit Card ****1234',
    status: 'processing',
    reference: 'TXN_' + props.transaction.id.substring(0, 8),
    fees: 2.99
  };

  // Mock documents
  documents.value = [
    {
      id: '1',
      name: 'Purchase Agreement.pdf',
      type: 'PDF',
      size: 245760,
      url: '/documents/purchase-agreement.pdf'
    },
    {
      id: '2',
      name: 'Item Receipt.jpg',
      type: 'Image',
      size: 1024000,
      url: '/documents/item-receipt.jpg'
    }
  ];

  // Mock dispute (only if transaction has issues)
  if (props.transaction.status === 'failed') {
    dispute.value = {
      id: 'dispute_1',
      reason: 'Payment processing failed multiple times',
      filedBy: 'System',
      status: 'open',
      filedAt: new Date(Date.now() - 60 * 60 * 1000)
    };
  }
};

// Lifecycle
onMounted(() => {
  loadTransactionData();
});
</script>

<style scoped>
.transaction-flow {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 2rem;
  max-width: 900px;
  margin: 0 auto;
}

.transaction-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e9ecef;
}

.transaction-info h3 {
  margin: 0 0 0.5rem 0;
  color: #333;
  font-size: 1.5rem;
}

.transaction-meta {
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
}

.transaction-id {
  font-family: monospace;
  background: #f8f9fa;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.875rem;
}

.transaction-status {
  padding: 0.375rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.transaction-status.pending {
  background: #fff3cd;
  color: #856404;
}

.transaction-status.completed {
  background: #d4edda;
  color: #155724;
}

.transaction-status.failed {
  background: #f8d7da;
  color: #721c24;
}

.transaction-status.refunded {
  background: #d1ecf1;
  color: #0c5460;
}

.transaction-date {
  color: #6c757d;
  font-size: 0.875rem;
}

.transaction-actions {
  display: flex;
  gap: 0.5rem;
}

.action-btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.action-btn.cancel {
  border: 1px solid #dc3545;
  background: white;
  color: #dc3545;
}

.action-btn.cancel:hover {
  background: #dc3545;
  color: white;
}

.action-btn.refund {
  border: 1px solid #fd7e14;
  background: white;
  color: #fd7e14;
}

.action-btn.refund:hover {
  background: #fd7e14;
  color: white;
}

.action-btn.refresh {
  border: 1px solid #6c757d;
  background: white;
  color: #6c757d;
}

.action-btn.refresh:hover {
  background: #6c757d;
  color: white;
}

.transaction-details {
  margin-bottom: 2rem;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  background: #f8f9fa;
  padding: 1.5rem;
  border-radius: 6px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.detail-label {
  font-size: 0.875rem;
  color: #6c757d;
  font-weight: 500;
}

.detail-value {
  color: #333;
  font-weight: 600;
}

.detail-value.amount {
  color: #28a745;
  font-size: 1.125rem;
}

.workflow-section,
.timeline-section,
.payment-section,
.documents-section,
.dispute-section {
  margin-bottom: 2rem;
}

.workflow-section h4,
.timeline-section h4,
.payment-section h4,
.documents-section h4,
.dispute-section h4 {
  margin: 0 0 1rem 0;
  color: #333;
  font-size: 1.125rem;
  font-weight: 600;
}

.step-details {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1.5rem;
  margin-top: 1rem;
}

.step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.step-header h4 {
  margin: 0;
  color: #333;
}

.step-status {
  padding: 0.25rem 0.75rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.step-status.in_progress {
  background: #fff3cd;
  color: #856404;
}

.step-status.completed {
  background: #d4edda;
  color: #155724;
}

.step-status.pending {
  background: #e2e3e5;
  color: #383d41;
}

.step-content p {
  color: #495057;
  margin-bottom: 1rem;
}

.step-actions h5,
.step-requirements h5 {
  margin: 1rem 0 0.5rem 0;
  color: #333;
  font-size: 1rem;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.step-action-btn {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.step-action-btn.primary {
  border: 1px solid #007bff;
  background: #007bff;
  color: white;
}

.step-action-btn.primary:hover:not(:disabled) {
  background: #0056b3;
}

.step-action-btn.secondary {
  border: 1px solid #6c757d;
  background: white;
  color: #6c757d;
}

.step-action-btn.secondary:hover:not(:disabled) {
  background: #6c757d;
  color: white;
}

.step-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.step-requirements ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.step-requirements li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid #dee2e6;
}

.step-requirements li:last-child {
  border-bottom: none;
}

.step-requirements li.completed {
  color: #28a745;
}

.check {
  color: #28a745;
  font-weight: bold;
}

.timeline {
  position: relative;
  padding-left: 2rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 15px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #dee2e6;
}

.timeline-event {
  position: relative;
  margin-bottom: 2rem;
}

.timeline-marker {
  position: absolute;
  left: -2.5rem;
  top: 0.25rem;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6c757d;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #dee2e6;
}

.timeline-event.success .timeline-marker {
  background: #28a745;
}

.timeline-event.warning .timeline-marker {
  background: #ffc107;
}

.timeline-event.error .timeline-marker {
  background: #dc3545;
}

.timeline-content {
  background: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1rem;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.event-title {
  font-weight: 600;
  color: #333;
}

.event-time {
  font-size: 0.875rem;
  color: #6c757d;
}

.event-description {
  color: #495057;
  margin: 0 0 0.5rem 0;
}

.event-metadata {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.5rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e9ecef;
}

.metadata-item {
  display: flex;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.metadata-key {
  color: #6c757d;
  font-weight: 500;
}

.metadata-value {
  color: #333;
}

.payment-details {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1.5rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.payment-method,
.payment-status,
.payment-reference,
.payment-fees {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.payment-label {
  font-weight: 500;
  color: #495057;
}

.payment-value {
  color: #333;
}

.payment-value.processing {
  color: #fd7e14;
}

.payment-value.completed {
  color: #28a745;
}

.payment-value.failed {
  color: #dc3545;
}

.documents-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.document-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  padding: 1rem;
}

.document-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.document-name {
  font-weight: 600;
  color: #333;
}

.document-type,
.document-size {
  font-size: 0.875rem;
  color: #6c757d;
}

.document-actions {
  display: flex;
  gap: 0.5rem;
}

.download-btn,
.view-btn {
  padding: 0.375rem 0.75rem;
  border: 1px solid #007bff;
  background: white;
  color: #007bff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.download-btn:hover,
.view-btn:hover {
  background: #007bff;
  color: white;
}

.dispute-alert {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 1.5rem;
}

.alert-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.alert-icon {
  font-size: 1.25rem;
}

.alert-title {
  font-weight: 600;
  color: #856404;
}

.dispute-reason {
  color: #856404;
  margin-bottom: 1rem;
}

.dispute-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.dispute-field {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-label {
  font-weight: 500;
  color: #856404;
}

.field-value {
  color: #333;
}

.dispute-status.open {
  color: #dc3545;
  font-weight: 600;
}

.dispute-actions {
  display: flex;
  gap: 0.5rem;
}

.dispute-btn {
  padding: 0.5rem 1rem;
  border: 1px solid #856404;
  background: white;
  color: #856404;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.dispute-btn:hover {
  background: #856404;
  color: white;
}

.dispute-btn.primary {
  background: #856404;
  color: white;
}

.dispute-btn.primary:hover {
  background: #6c5f03;
}

@media (max-width: 768px) {
  .transaction-header {
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }
  
  .transaction-meta {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
  }
  
  .transaction-actions {
    justify-content: stretch;
  }
  
  .action-btn {
    flex: 1;
  }
  
  .detail-grid {
    grid-template-columns: 1fr;
  }
  
  .timeline {
    padding-left: 1.5rem;
  }
  
  .timeline::before {
    left: 10px;
  }
  
  .timeline-marker {
    left: -2rem;
  }
}
</style>