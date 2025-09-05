import { z } from 'zod';
import {
  MultiDimensionalEntitySchema,
  VectorEmbeddingSchema,
  CoordinateSchema,
  TemporalDimensionSchema,
  QualityDimensionSchema,
  CategoryDimensionSchema,
  EconomicDimensionSchema,
  SocialDimensionSchema,
  DimensionalAttributeSchema
} from '../base/dimensional-schema.js';

/**
 * Marketplace Item Entity with n-dimensional support
 * Comprehensive model for marketplace items with multi-dimensional attributes
 */

// Item availability status
export const ItemStatusSchema = z.enum([
  'draft',
  'active',
  'inactive',
  'pending',
  'approved',
  'rejected',
  'suspended',
  'archived',
  'out_of_stock',
  'discontinued'
]);

export type ItemStatus = z.infer<typeof ItemStatusSchema>;

// Item type classification
export const ItemTypeSchema = z.enum([
  'physical_product',
  'digital_product',
  'service',
  'subscription',
  'rental',
  'auction',
  'bundle',
  'custom',
  'experience',
  'virtual_asset'
]);

export type ItemType = z.infer<typeof ItemTypeSchema>;

// Condition for physical items
export const ItemConditionSchema = z.enum([
  'new',
  'like_new',
  'excellent',
  'good',
  'fair',
  'poor',
  'refurbished',
  'damaged',
  'for_parts'
]);

export type ItemCondition = z.infer<typeof ItemConditionSchema>;

// Shipping information
export const ShippingInfoSchema = z.object({
  required: z.boolean().default(false),
  weight: z.number().positive().optional(),
  dimensions: z.object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(['cm', 'inch', 'mm', 'm']).default('cm')
  }).optional(),
  options: z.array(z.object({
    method: z.string(),
    cost: z.number().min(0),
    estimatedDays: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive()
    }),
    regions: z.array(z.string()).optional(),
    restrictions: z.array(z.string()).optional()
  })).default([]),
  freeShipping: z.object({
    enabled: z.boolean().default(false),
    minimumOrder: z.number().min(0).optional(),
    regions: z.array(z.string()).optional()
  }).optional(),
  internationalShipping: z.boolean().default(false)
});

export type ShippingInfo = z.infer<typeof ShippingInfoSchema>;

// Digital asset information
export const DigitalAssetInfoSchema = z.object({
  downloadable: z.boolean().default(false),
  fileTypes: z.array(z.string()).optional(),
  fileSize: z.number().positive().optional(),
  downloadLimit: z.number().int().positive().optional(),
  expirationPeriod: z.number().int().positive().optional(), // days
  drm: z.object({
    enabled: z.boolean().default(false),
    type: z.enum(['watermark', 'encryption', 'license_key', 'custom']).optional(),
    restrictions: z.record(z.any()).optional()
  }).optional(),
  streaming: z.object({
    enabled: z.boolean().default(false),
    quality: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional()
  }).optional()
});

export type DigitalAssetInfo = z.infer<typeof DigitalAssetInfoSchema>;

// Service information
export const ServiceInfoSchema = z.object({
  duration: z.object({
    value: z.number().positive(),
    unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months', 'years'])
  }).optional(),
  location: z.object({
    type: z.enum(['remote', 'on_site', 'hybrid']),
    address: z.string().optional(),
    coordinates: CoordinateSchema.optional(),
    radius: z.number().positive().optional() // km
  }).optional(),
  capacity: z.object({
    min: z.number().int().positive().default(1),
    max: z.number().int().positive().optional(),
    concurrent: z.boolean().default(false)
  }).optional(),
  requirements: z.array(z.string()).optional(),
  deliverables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    timeline: z.string().optional()
  })).optional(),
  expertise: z.array(z.object({
    skill: z.string(),
    level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
    certified: z.boolean().default(false)
  })).optional()
});

export type ServiceInfo = z.infer<typeof ServiceInfoSchema>;

// Subscription model
export const SubscriptionModelSchema = z.object({
  billingCycle: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom']),
  trialPeriod: z.object({
    enabled: z.boolean().default(false),
    duration: z.number().int().positive().optional(),
    unit: z.enum(['days', 'weeks', 'months']).optional()
  }).optional(),
  tiers: z.array(z.object({
    name: z.string(),
    price: z.number().min(0),
    features: z.array(z.string()),
    limits: z.record(z.number()).optional(),
    popular: z.boolean().default(false)
  })).optional(),
  discounts: z.array(z.object({
    type: z.enum(['percentage', 'fixed', 'bulk']),
    value: z.number().positive(),
    conditions: z.record(z.any()).optional(),
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional()
  })).optional(),
  cancellation: z.object({
    policy: z.enum(['immediate', 'end_of_cycle', 'no_refund']),
    refundWindow: z.number().int().nonnegative().optional() // days
  }).optional()
});

export type SubscriptionModel = z.infer<typeof SubscriptionModelSchema>;

// Media attachments
export const MediaAttachmentSchema = z.object({
  id: z.string(),
  type: z.enum(['image', 'video', 'audio', 'document', '3d_model', 'ar_asset']),
  url: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  order: z.number().int().nonnegative().default(0),
  primary: z.boolean().default(false),
  metadata: z.object({
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().positive().optional(),
    fileSize: z.number().positive().optional(),
    format: z.string().optional(),
    colorProfile: z.string().optional()
  }).optional(),
  accessibility: z.object({
    altText: z.string().optional(),
    caption: z.string().optional(),
    audioDescription: z.string().optional()
  }).optional()
});

export type MediaAttachment = z.infer<typeof MediaAttachmentSchema>;

// Inventory tracking
export const InventorySchema = z.object({
  tracked: z.boolean().default(false),
  quantity: z.number().int().nonnegative().default(0),
  reserved: z.number().int().nonnegative().default(0),
  available: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  restockDate: z.coerce.date().optional(),
  locations: z.array(z.object({
    id: z.string(),
    name: z.string(),
    quantity: z.number().int().nonnegative(),
    coordinates: CoordinateSchema.optional()
  })).optional(),
  variants: z.array(z.object({
    id: z.string(),
    attributes: z.record(z.string()),
    sku: z.string().optional(),
    quantity: z.number().int().nonnegative(),
    price: z.number().min(0).optional()
  })).optional()
});

export type Inventory = z.infer<typeof InventorySchema>;

// Marketplace Item main schema
export const MarketplaceItemSchema = MultiDimensionalEntitySchema.extend({
  // Basic information
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5000),
  shortDescription: z.string().max(200).optional(),
  
  // Classification
  itemType: ItemTypeSchema,
  status: ItemStatusSchema.default('draft'),
  condition: ItemConditionSchema.optional(),
  
  // Owner information
  sellerId: z.string(),
  sellerType: z.enum(['individual', 'business', 'marketplace']).default('individual'),
  
  // Identification
  sku: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  
  // Media and content
  media: z.array(MediaAttachmentSchema).default([]),
  
  // Pricing (extends economic dimension)
  basePrice: z.number().min(0),
  salePrice: z.number().min(0).optional(),
  currency: z.string().default('USD'),
  priceType: z.enum(['fixed', 'auction', 'negotiable', 'quote_required']).default('fixed'),
  
  // Type-specific information
  shippingInfo: ShippingInfoSchema.optional(),
  digitalAssetInfo: DigitalAssetInfoSchema.optional(),
  serviceInfo: ServiceInfoSchema.optional(),
  subscriptionModel: SubscriptionModelSchema.optional(),
  
  // Inventory management
  inventory: InventorySchema.optional(),
  
  // Availability and scheduling
  availability: z.object({
    always: z.boolean().default(true),
    schedule: z.array(z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: z.string().default('UTC')
    })).optional(),
    blackoutDates: z.array(z.object({
      from: z.coerce.date(),
      to: z.coerce.date(),
      reason: z.string().optional()
    })).optional(),
    leadTime: z.number().int().nonnegative().default(0) // days
  }).default({ always: true }),
  
  // Legal and compliance
  legal: z.object({
    ageRestriction: z.number().int().nonnegative().optional(),
    licenses: z.array(z.string()).optional(),
    restrictions: z.array(z.object({
      type: z.string(),
      regions: z.array(z.string()).optional(),
      description: z.string().optional()
    })).optional(),
    termsOfService: z.string().optional(),
    warranty: z.object({
      enabled: z.boolean().default(false),
      duration: z.number().int().positive().optional(),
      unit: z.enum(['days', 'months', 'years']).optional(),
      coverage: z.string().optional()
    }).optional()
  }).optional(),
  
  // Performance metrics
  metrics: z.object({
    views: z.number().int().nonnegative().default(0),
    likes: z.number().int().nonnegative().default(0),
    shares: z.number().int().nonnegative().default(0),
    saves: z.number().int().nonnegative().default(0),
    purchases: z.number().int().nonnegative().default(0),
    returns: z.number().int().nonnegative().default(0),
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().nonnegative().default(0),
    conversionRate: z.number().min(0).max(1).optional()
  }).default({
    views: 0,
    likes: 0,
    shares: 0,
    saves: 0,
    purchases: 0,
    returns: 0,
    reviewCount: 0
  }),
  
  // SEO and discoverability
  seo: z.object({
    slug: z.string().optional(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    canonicalUrl: z.string().url().optional(),
    structuredData: z.record(z.any()).optional()
  }).optional(),
  
  // Moderation and safety
  moderation: z.object({
    flagged: z.boolean().default(false),
    flags: z.array(z.object({
      type: z.string(),
      reason: z.string(),
      reporterId: z.string(),
      timestamp: z.coerce.date(),
      resolved: z.boolean().default(false)
    })).default([]),
    reviewStatus: z.enum(['pending', 'approved', 'rejected', 'under_review']).default('pending'),
    reviewedBy: z.string().optional(),
    reviewedAt: z.coerce.date().optional(),
    reviewNotes: z.string().optional()
  }).default({
    flagged: false,
    flags: [],
    reviewStatus: 'pending'
  }),
  
  // Recommendations and ML features
  ml: z.object({
    embedding: VectorEmbeddingSchema.optional(),
    similarItems: z.array(z.string()).optional(),
    recommendations: z.array(z.object({
      itemId: z.string(),
      score: z.number().min(0).max(1),
      reason: z.string().optional()
    })).optional(),
    personalization: z.record(z.any()).optional(),
    trends: z.object({
      velocity: z.number().optional(),
      seasonality: z.array(z.number()).optional(),
      demand: z.number().min(0).max(1).optional()
    }).optional()
  }).optional()
}).refine(
  (data) => {
    // Validation: sale price should be less than base price
    if (data.salePrice && data.salePrice >= data.basePrice) {
      return false;
    }
    
    // Validation: inventory required for physical products
    if (data.itemType === 'physical_product' && !data.inventory?.tracked) {
      return false;
    }
    
    // Validation: shipping info required for physical products
    if (data.itemType === 'physical_product' && !data.shippingInfo) {
      return false;
    }
    
    // Validation: digital asset info required for digital products
    if (data.itemType === 'digital_product' && !data.digitalAssetInfo) {
      return false;
    }
    
    // Validation: service info required for services
    if (data.itemType === 'service' && !data.serviceInfo) {
      return false;
    }
    
    return true;
  },
  {
    message: "Item validation failed: check type-specific requirements"
  }
);

export type MarketplaceItem = z.infer<typeof MarketplaceItemSchema>;

// Item search and filtering
export const ItemSearchSchema = z.object({
  query: z.string().optional(),
  filters: z.object({
    itemType: z.array(ItemTypeSchema).optional(),
    status: z.array(ItemStatusSchema).optional(),
    condition: z.array(ItemConditionSchema).optional(),
    priceRange: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      currency: z.string().default('USD')
    }).optional(),
    categories: z.array(z.string()).optional(),
    location: z.object({
      coordinates: CoordinateSchema,
      radius: z.number().positive(),
      unit: z.enum(['km', 'miles']).default('km')
    }).optional(),
    availability: z.object({
      inStock: z.boolean().optional(),
      shippingRequired: z.boolean().optional(),
      digitalOnly: z.boolean().optional()
    }).optional(),
    quality: z.object({
      minRating: z.number().min(0).max(5).optional(),
      minReviews: z.number().int().nonnegative().optional(),
      certified: z.boolean().optional()
    }).optional(),
    seller: z.object({
      sellerIds: z.array(z.string()).optional(),
      sellerTypes: z.array(z.enum(['individual', 'business', 'marketplace'])).optional(),
      verified: z.boolean().optional()
    }).optional()
  }).optional(),
  sort: z.object({
    field: z.enum([
      'relevance',
      'price_asc',
      'price_desc',
      'date_newest',
      'date_oldest',
      'popularity',
      'rating',
      'distance'
    ]).default('relevance'),
    direction: z.enum(['asc', 'desc']).default('desc')
  }).optional(),
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20)
  }).optional(),
  vectorSearch: z.object({
    embedding: z.array(z.number()),
    threshold: z.number().min(0).max(1).default(0.7),
    includeMetadata: z.boolean().default(false)
  }).optional()
});

export type ItemSearch = z.infer<typeof ItemSearchSchema>;

// Item creation/update DTOs
export const CreateMarketplaceItemSchema = MarketplaceItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  metrics: true,
  moderation: true
});

export const UpdateMarketplaceItemSchema = CreateMarketplaceItemSchema.partial();

export type CreateMarketplaceItem = z.infer<typeof CreateMarketplaceItemSchema>;
export type UpdateMarketplaceItem = z.infer<typeof UpdateMarketplaceItemSchema>;

export default {
  MarketplaceItemSchema,
  ItemSearchSchema,
  CreateMarketplaceItemSchema,
  UpdateMarketplaceItemSchema,
  ItemStatusSchema,
  ItemTypeSchema,
  ItemConditionSchema,
  ShippingInfoSchema,
  DigitalAssetInfoSchema,
  ServiceInfoSchema,
  SubscriptionModelSchema,
  MediaAttachmentSchema,
  InventorySchema
};