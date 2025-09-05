import { z } from 'zod';
import {
  MultiDimensionalEntitySchema,
  TemporalDimensionSchema,
  CoordinateSchema,
  DimensionalAttributeSchema
} from '../base/dimensional-schema.js';

/**
 * Temporal Scheduling and Availability Models
 * Advanced scheduling system with multi-dimensional time management, resource allocation, and availability tracking
 */

// Time zone handling
export const TimezoneSchema = z.object({
  timezone: z.string().default('UTC'),
  offset: z.number(), // UTC offset in minutes
  dstActive: z.boolean().default(false),
  dstOffset: z.number().optional() // Additional DST offset in minutes
});

export type Timezone = z.infer<typeof TimezoneSchema>;

// Recurrence patterns
export const RecurrencePatternSchema = z.enum([
  'none',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'weekdays',
  'weekends',
  'custom'
]);

export type RecurrencePattern = z.infer<typeof RecurrencePatternSchema>;

// Days of week enumeration
export const DayOfWeekSchema = z.enum([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
]);

export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

// Time slot status
export const TimeSlotStatusSchema = z.enum([
  'available',
  'booked',
  'blocked',
  'tentative',
  'cancelled',
  'expired',
  'maintenance'
]);

export type TimeSlotStatus = z.infer<typeof TimeSlotStatusSchema>;

// Availability type
export const AvailabilityTypeSchema = z.enum([
  'service',
  'resource',
  'location',
  'person',
  'equipment',
  'digital_asset',
  'custom'
]);

export type AvailabilityType = z.infer<typeof AvailabilityTypeSchema>;

// Time slot configuration
export const TimeSlotSchema = z.object({
  id: z.string(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  duration: z.number().int().positive(), // minutes
  
  // Status and booking
  status: TimeSlotStatusSchema.default('available'),
  capacity: z.object({
    total: z.number().int().positive().default(1),
    booked: z.number().int().nonnegative().default(0),
    available: z.number().int().nonnegative().default(1)
  }).default({
    total: 1,
    booked: 0,
    available: 1
  }),
  
  // Pricing
  pricing: z.object({
    basePrice: z.number().min(0),
    currency: z.string().default('USD'),
    priceModifiers: z.array(z.object({
      type: z.enum(['peak_hour', 'off_peak', 'season', 'demand', 'duration', 'group_size']),
      modifier: z.number(), // multiplier or fixed amount
      description: z.string().optional()
    })).default([]),
    dynamicPricing: z.boolean().default(false)
  }).optional(),
  
  // Booking constraints
  constraints: z.object({
    minAdvanceBooking: z.number().int().nonnegative().default(0), // minutes
    maxAdvanceBooking: z.number().int().positive().optional(), // minutes
    minDuration: z.number().int().positive().optional(), // minutes
    maxDuration: z.number().int().positive().optional(), // minutes
    bufferBefore: z.number().int().nonnegative().default(0), // minutes
    bufferAfter: z.number().int().nonnegative().default(0), // minutes
    allowPartialBooking: z.boolean().default(false),
    requiresApproval: z.boolean().default(false)
  }).default({
    minAdvanceBooking: 0,
    bufferBefore: 0,
    bufferAfter: 0,
    allowPartialBooking: false,
    requiresApproval: false
  }),
  
  // Resource allocation
  resources: z.array(z.object({
    resourceId: z.string(),
    resourceType: z.string(),
    quantity: z.number().int().positive().default(1),
    required: z.boolean().default(true)
  })).default([]),
  
  // Location information
  location: z.object({
    type: z.enum(['physical', 'virtual', 'hybrid']),
    address: z.string().optional(),
    coordinates: CoordinateSchema.optional(),
    virtualDetails: z.object({
      platform: z.string().optional(),
      meetingUrl: z.string().url().optional(),
      accessCode: z.string().optional()
    }).optional()
  }).optional(),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  
  // Audit information
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

// Recurring availability rule
export const RecurrenceRuleSchema = z.object({
  id: z.string(),
  pattern: RecurrencePatternSchema,
  
  // Basic recurrence settings
  interval: z.number().int().positive().default(1), // every N periods
  
  // Weekly pattern
  daysOfWeek: z.array(DayOfWeekSchema).optional(),
  
  // Monthly pattern
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  weekOfMonth: z.number().int().min(1).max(5).optional(), // first, second, third, fourth, last
  
  // Yearly pattern
  monthOfYear: z.number().int().min(1).max(12).optional(),
  
  // Custom pattern (cron-like expression)
  customPattern: z.string().optional(),
  
  // Bounds
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  occurrences: z.number().int().positive().optional(), // max occurrences
  
  // Time settings
  timeSlots: z.array(z.object({
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    duration: z.number().int().positive().optional() // minutes, calculated if not provided
  })),
  
  // Timezone handling
  timezone: TimezoneSchema,
  
  // Exceptions (dates to exclude from the pattern)
  exceptions: z.array(z.object({
    date: z.coerce.date(),
    reason: z.string().optional(),
    type: z.enum(['exclude', 'modify', 'cancel']).default('exclude'),
    modification: z.object({
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      capacity: z.number().int().positive().optional(),
      pricing: z.record(z.any()).optional()
    }).optional()
  })).default([]),
  
  // Special dates (dates to include that don't match the pattern)
  inclusions: z.array(z.object({
    date: z.coerce.date(),
    timeSlots: z.array(z.object({
      startTime: z.string(),
      endTime: z.string(),
      capacity: z.number().int().positive().default(1)
    })),
    reason: z.string().optional()
  })).default([])
});

export type RecurrenceRule = z.infer<typeof RecurrenceRuleSchema>;

// Blackout period for unavailability
export const BlackoutPeriodSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Time period
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  allDay: z.boolean().default(true),
  
  // Specific time range if not all day
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  timezone: TimezoneSchema.optional(),
  
  // Scope
  scope: z.object({
    type: z.enum(['global', 'resource', 'location', 'category', 'specific']),
    targets: z.array(z.string()).optional() // IDs of affected resources/locations
  }),
  
  // Recurrence for recurring blackouts
  recurrence: RecurrenceRuleSchema.optional(),
  
  // Reason and type
  reason: z.enum(['maintenance', 'holiday', 'vacation', 'emergency', 'renovation', 'training', 'custom']),
  priority: z.number().int().min(1).max(10).default(5),
  
  // Impact on existing bookings
  existingBookings: z.enum(['allow', 'cancel', 'reschedule', 'modify']).default('allow'),
  
  // Notifications
  notifications: z.object({
    enabled: z.boolean().default(true),
    advanceNotice: z.number().int().positive().default(1440), // minutes (24 hours)
    recipients: z.array(z.string()).default([]),
    message: z.string().optional()
  }).default({
    enabled: true,
    advanceNotice: 1440,
    recipients: []
  }),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.any()).optional(),
  
  // Audit
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date()
});

export type BlackoutPeriod = z.infer<typeof BlackoutPeriodSchema>;

// Resource availability tracking
export const ResourceAvailabilitySchema = z.object({
  id: z.string(),
  resourceId: z.string(),
  resourceType: AvailabilityTypeSchema,
  resourceName: z.string(),
  
  // Capacity management
  capacity: z.object({
    total: z.number().int().positive(),
    unit: z.string().default('slot'), // slots, people, hours, etc.
    concurrent: z.boolean().default(false), // can resource handle multiple bookings
    sharable: z.boolean().default(false) // can be shared between bookings
  }),
  
  // Operating schedule
  operatingHours: z.array(z.object({
    dayOfWeek: DayOfWeekSchema,
    openTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    closeTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    closed: z.boolean().default(false),
    breaks: z.array(z.object({
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      reason: z.string().optional()
    })).default([])
  })),
  
  // Recurrence rules for availability
  recurrenceRules: z.array(RecurrenceRuleSchema).default([]),
  
  // Blackout periods
  blackoutPeriods: z.array(BlackoutPeriodSchema).default([]),
  
  // Booking rules and constraints
  bookingRules: z.object({
    minBookingDuration: z.number().int().positive().default(30), // minutes
    maxBookingDuration: z.number().int().positive().optional(),
    slotDuration: z.number().int().positive().default(60), // minutes
    bufferTime: z.number().int().nonnegative().default(0), // minutes between bookings
    advanceBookingWindow: z.object({
      min: z.number().int().nonnegative().default(0), // minutes
      max: z.number().int().positive().optional() // minutes
    }),
    cancellationPolicy: z.object({
      allowCancellation: z.boolean().default(true),
      cancellationDeadline: z.number().int().nonnegative().default(1440), // minutes before start
      penaltyFee: z.number().min(0).optional(),
      refundPercentage: z.number().min(0).max(100).default(100)
    }),
    reschedulePolicy: z.object({
      allowReschedule: z.boolean().default(true),
      rescheduleDeadline: z.number().int().nonnegative().default(1440), // minutes before start
      rescheduleLimit: z.number().int().positive().default(3), // max reschedules per booking
      feeApplies: z.boolean().default(false)
    })
  }),
  
  // Current availability snapshot
  currentAvailability: z.object({
    date: z.coerce.date(),
    totalSlots: z.number().int().nonnegative(),
    availableSlots: z.number().int().nonnegative(),
    bookedSlots: z.number().int().nonnegative(),
    blockedSlots: z.number().int().nonnegative(),
    nextAvailable: z.coerce.date().optional(),
    peakHours: z.array(z.object({
      start: z.string(),
      end: z.string(),
      utilizationRate: z.number().min(0).max(1)
    })).optional()
  }).optional(),
  
  // Performance metrics
  metrics: z.object({
    utilizationRate: z.number().min(0).max(1).optional(),
    averageBookingDuration: z.number().positive().optional(),
    peakUtilizationPeriods: z.array(z.object({
      period: z.string(),
      utilization: z.number().min(0).max(1)
    })).optional(),
    noShowRate: z.number().min(0).max(1).optional(),
    cancellationRate: z.number().min(0).max(1).optional(),
    revenue: z.object({
      total: z.number().min(0),
      currency: z.string().default('USD'),
      period: z.string()
    }).optional()
  }).optional(),
  
  // Location and logistics
  location: z.object({
    type: z.enum(['fixed', 'mobile', 'virtual', 'hybrid']),
    address: z.string().optional(),
    coordinates: CoordinateSchema.optional(),
    serviceArea: z.object({
      radius: z.number().positive().optional(), // km
      regions: z.array(z.string()).optional(),
      restrictions: z.array(z.string()).optional()
    }).optional()
  }).optional(),
  
  // Dependencies on other resources
  dependencies: z.array(z.object({
    resourceId: z.string(),
    dependencyType: z.enum(['prerequisite', 'concurrent', 'exclusive', 'sequence']),
    relationship: z.string().optional()
  })).default([]),
  
  // Staff or operator assignment
  staffing: z.object({
    required: z.boolean().default(false),
    staffIds: z.array(z.string()).default([]),
    skillRequirements: z.array(z.object({
      skill: z.string(),
      level: z.enum(['basic', 'intermediate', 'advanced', 'expert']),
      required: z.boolean().default(true)
    })).default([]),
    autoAssign: z.boolean().default(false)
  }).optional(),
  
  // Integration settings
  integrations: z.array(z.object({
    type: z.enum(['calendar', 'booking_system', 'payment', 'notification', 'analytics']),
    provider: z.string(),
    config: z.record(z.any()),
    enabled: z.boolean().default(true)
  })).default([]),
  
  // Status and lifecycle
  status: z.enum(['active', 'inactive', 'maintenance', 'retired']).default('active'),
  
  // Metadata
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  
  // Audit trail
  createdBy: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  version: z.number().int().positive().default(1)
});

export type ResourceAvailability = z.infer<typeof ResourceAvailabilitySchema>;

// Schedule conflict detection and resolution
export const ScheduleConflictSchema = z.object({
  id: z.string(),
  type: z.enum(['overlap', 'resource_conflict', 'capacity_exceeded', 'blackout_conflict', 'dependency_conflict']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  
  // Conflicting entities
  conflicts: z.array(z.object({
    entityId: z.string(),
    entityType: z.string(),
    timeSlot: z.object({
      startTime: z.coerce.date(),
      endTime: z.coerce.date()
    }),
    description: z.string().optional()
  })),
  
  // Conflict details
  description: z.string(),
  impactAssessment: z.object({
    affectedBookings: z.number().int().nonnegative(),
    affectedResources: z.number().int().nonnegative(),
    estimatedRevenueLoss: z.number().min(0).optional(),
    customerImpact: z.enum(['none', 'low', 'medium', 'high']).default('medium')
  }),
  
  // Resolution options
  resolutionOptions: z.array(z.object({
    id: z.string(),
    type: z.enum(['reschedule', 'cancel', 'modify_capacity', 'add_resource', 'override', 'split_booking']),
    description: z.string(),
    cost: z.number().min(0).optional(),
    effort: z.enum(['low', 'medium', 'high']).default('medium'),
    impact: z.object({
      customers: z.enum(['none', 'low', 'medium', 'high']).default('low'),
      operations: z.enum(['none', 'low', 'medium', 'high']).default('low'),
      revenue: z.number().optional()
    })
  })).default([]),
  
  // Resolution status
  status: z.enum(['detected', 'analyzing', 'proposed', 'resolving', 'resolved', 'ignored']).default('detected'),
  selectedResolution: z.string().optional(),
  resolutionNotes: z.string().optional(),
  
  // Timestamps
  detectedAt: z.coerce.date(),
  resolvedAt: z.coerce.date().optional(),
  
  // Metadata
  metadata: z.record(z.any()).optional()
});

export type ScheduleConflict = z.infer<typeof ScheduleConflictSchema>;

// Main scheduling system entity
export const SchedulingSystemSchema = MultiDimensionalEntitySchema.extend({
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['service_booking', 'resource_scheduling', 'event_management', 'shift_planning', 'equipment_rental']),
  
  // System configuration
  configuration: z.object({
    timezone: TimezoneSchema,
    workingDays: z.array(DayOfWeekSchema).default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
    defaultSlotDuration: z.number().int().positive().default(60), // minutes
    bookingWindow: z.object({
      maxAdvanceDays: z.number().int().positive().default(90),
      minAdvanceHours: z.number().int().nonnegative().default(1)
    }),
    
    // Conflict management
    conflictResolution: z.object({
      autoResolve: z.boolean().default(false),
      notifyOnConflict: z.boolean().default(true),
      allowOverbooking: z.boolean().default(false),
      overbookingThreshold: z.number().min(0).max(1).default(1.1)
    }),
    
    // Notifications
    notifications: z.object({
      enabled: z.boolean().default(true),
      reminderPeriods: z.array(z.number().int().positive()).default([1440, 60]), // minutes before
      confirmationRequired: z.boolean().default(true),
      autoCancel: z.object({
        enabled: z.boolean().default(false),
        noShowThreshold: z.number().int().positive().default(15) // minutes late
      })
    }),
    
    // Integration settings
    integrations: z.object({
      calendar: z.boolean().default(false),
      payments: z.boolean().default(false),
      crm: z.boolean().default(false),
      analytics: z.boolean().default(true)
    })
  }),
  
  // Resources managed by this system
  resources: z.array(z.string()).default([]), // ResourceAvailability IDs
  
  // Current system status
  status: z.enum(['active', 'maintenance', 'disabled']).default('active'),
  
  // Performance metrics
  metrics: z.object({
    totalBookings: z.number().int().nonnegative().default(0),
    utilizationRate: z.number().min(0).max(1).optional(),
    conflictRate: z.number().min(0).max(1).optional(),
    customerSatisfaction: z.number().min(0).max(5).optional(),
    averageBookingValue: z.number().min(0).optional(),
    revenue: z.object({
      total: z.number().min(0),
      currency: z.string().default('USD'),
      period: z.string().default('30d')
    }).optional()
  }),
  
  // Access control
  permissions: z.object({
    managers: z.array(z.string()).default([]),
    operators: z.array(z.string()).default([]),
    viewers: z.array(z.string()).default([])
  }),
  
  // Audit settings
  auditSettings: z.object({
    logBookings: z.boolean().default(true),
    logChanges: z.boolean().default(true),
    logAccess: z.boolean().default(false),
    retentionDays: z.number().int().positive().default(365)
  })
});

export type SchedulingSystem = z.infer<typeof SchedulingSystemSchema>;

// Availability query for complex searches
export const AvailabilityQuerySchema = z.object({
  // Time range
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  timezone: z.string().optional(),
  
  // Resource filters
  resourceIds: z.array(z.string()).optional(),
  resourceTypes: z.array(AvailabilityTypeSchema).optional(),
  capacity: z.object({
    min: z.number().int().positive().optional(),
    exact: z.number().int().positive().optional()
  }).optional(),
  
  // Duration requirements
  duration: z.object({
    min: z.number().int().positive().optional(), // minutes
    max: z.number().int().positive().optional(),
    exact: z.number().int().positive().optional()
  }).optional(),
  
  // Location constraints
  location: z.object({
    coordinates: CoordinateSchema.optional(),
    radius: z.number().positive().optional(), // km
    regions: z.array(z.string()).optional(),
    type: z.enum(['physical', 'virtual', 'hybrid']).optional()
  }).optional(),
  
  // Pricing filters
  pricing: z.object({
    maxPrice: z.number().min(0).optional(),
    currency: z.string().default('USD'),
    includeFees: z.boolean().default(true)
  }).optional(),
  
  // Availability preferences
  preferences: z.object({
    preferredTimes: z.array(z.object({
      startTime: z.string(),
      endTime: z.string(),
      weight: z.number().min(0).max(1).default(1)
    })).optional(),
    avoidTimes: z.array(z.object({
      startTime: z.string(),
      endTime: z.string()
    })).optional(),
    flexibleDuration: z.boolean().default(false),
    splitBooking: z.boolean().default(false)
  }).optional(),
  
  // Additional filters
  tags: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  
  // Response configuration
  groupBy: z.enum(['resource', 'date', 'time', 'location']).optional(),
  includeUnavailable: z.boolean().default(false),
  maxResults: z.number().int().positive().default(100),
  
  // Sorting
  sortBy: z.enum(['price', 'availability', 'location', 'rating', 'random']).default('availability'),
  sortDirection: z.enum(['asc', 'desc']).default('asc')
});

export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

// Schema creation and update DTOs
export const CreateResourceAvailabilitySchema = ResourceAvailabilitySchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  currentAvailability: true,
  metrics: true
});

export const UpdateResourceAvailabilitySchema = CreateResourceAvailabilitySchema.partial();

export const CreateSchedulingSystemSchema = SchedulingSystemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  metrics: true
});

export const UpdateSchedulingSystemSchema = CreateSchedulingSystemSchema.partial();

export type CreateResourceAvailability = z.infer<typeof CreateResourceAvailabilitySchema>;
export type UpdateResourceAvailability = z.infer<typeof UpdateResourceAvailabilitySchema>;
export type CreateSchedulingSystem = z.infer<typeof CreateSchedulingSystemSchema>;
export type UpdateSchedulingSystem = z.infer<typeof UpdateSchedulingSystemSchema>;

export default {
  SchedulingSystemSchema,
  ResourceAvailabilitySchema,
  TimeSlotSchema,
  RecurrenceRuleSchema,
  BlackoutPeriodSchema,
  ScheduleConflictSchema,
  AvailabilityQuerySchema,
  CreateResourceAvailabilitySchema,
  UpdateResourceAvailabilitySchema,
  CreateSchedulingSystemSchema,
  UpdateSchedulingSystemSchema,
  TimezoneSchema,
  RecurrencePatternSchema,
  DayOfWeekSchema,
  TimeSlotStatusSchema,
  AvailabilityTypeSchema
};