import { EventEmitter } from 'events';
import { SemanticContext } from './types';
import { z } from 'zod';

export const TemplateSubmissionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000),
  category: z.enum(['web', 'cli', 'api', 'data', 'config', 'docs', 'other']),
  tags: z.array(z.string()).max(10),
  template: z.string(),
  examples: z.array(z.object({
    name: z.string(),
    input: z.record(z.any()),
    expected: z.string()
  })).max(5),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    github: z.string().optional()
  }),
  license: z.enum(['MIT', 'Apache-2.0', 'GPL-3.0', 'BSD-3-Clause', 'ISC', 'CC0-1.0']),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  dependencies: z.array(z.string()).optional(),
  readme: z.string().optional()
});

export const TemplateRatingSchema = z.object({
  templateId: z.string(),
  userId: z.string(),
  rating: z.number().min(1).max(5),
  review: z.string().max(500).optional(),
  aspects: z.object({
    usability: z.number().min(1).max(5),
    documentation: z.number().min(1).max(5),
    performance: z.number().min(1).max(5),
    reliability: z.number().min(1).max(5)
  }).optional()
});

export type TemplateSubmission = z.infer<typeof TemplateSubmissionSchema>;
export type TemplateRating = z.infer<typeof TemplateRatingSchema>;

export interface CommunityTemplate extends TemplateSubmission {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  downloads: number;
  ratings: {
    average: number;
    count: number;
    breakdown: Record<1 | 2 | 3 | 4 | 5, number>;
  };
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderationNotes?: string;
  featured: boolean;
  verified: boolean;
}

export interface CommunityUser {
  id: string;
  name: string;
  email?: string;
  github?: string;
  reputation: number;
  badges: string[];
  templates: string[];
  reviews: string[];
  joinedAt: Date;
  lastActive: Date;
}

export interface TemplateSearchOptions {
  query?: string;
  category?: string;
  tags?: string[];
  author?: string;
  minRating?: number;
  sortBy?: 'downloads' | 'rating' | 'created' | 'updated' | 'name';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  featured?: boolean;
  verified?: boolean;
}

export interface CollaborationRequest {
  id: string;
  templateId: string;
  requester: string;
  owner: string;
  type: 'contribution' | 'maintenance' | 'translation';
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  resolvedAt?: Date;
}

export class UnjucksCommunitySystem extends EventEmitter {
  private templates = new Map<string, CommunityTemplate>();
  private users = new Map<string, CommunityUser>();
  private ratings = new Map<string, TemplateRating[]>();
  private collaborations = new Map<string, CollaborationRequest[]>();
  private categories = new Map<string, { name: string; description: string; icon: string }>();
  private moderationQueue: string[] = [];
  private featuredTemplates: string[] = [];

  constructor() {
    super();
    this.initializeCategories();
    this.setupModerationSystem();
  }

  private initializeCategories(): void {
    this.categories.set('web', {
      name: 'Web Development',
      description: 'Templates for web applications, HTML, CSS, and JavaScript',
      icon: '🌐'
    });
    this.categories.set('cli', {
      name: 'Command Line',
      description: 'CLI tools, configuration files, and shell scripts',
      icon: '⚡'
    });
    this.categories.set('api', {
      name: 'API & Services',
      description: 'REST APIs, GraphQL schemas, and service configurations',
      icon: '🔌'
    });
    this.categories.set('data', {
      name: 'Data Processing',
      description: 'Data transformation, ETL pipelines, and analytics',
      icon: '📊'
    });
    this.categories.set('config', {
      name: 'Configuration',
      description: 'Application config, deployment scripts, and infrastructure',
      icon: '⚙️'
    });
    this.categories.set('docs', {
      name: 'Documentation',
      description: 'README files, API docs, and technical documentation',
      icon: '📖'
    });
    this.categories.set('other', {
      name: 'Other',
      description: 'Templates that don\'t fit other categories',
      icon: '🎯'
    });
  }

  private setupModerationSystem(): void {
    // Automated content scanning
    setInterval(() => {
      this.processModerationQueue();
    }, 60000); // Every minute

    // Community reporting system
    this.on('template:reported', (templateId: string, reason: string, reporter: string) => {
      this.flagTemplate(templateId, `Reported by ${reporter}: ${reason}`);
    });
  }

  async submitTemplate(submission: TemplateSubmission): Promise<string> {
    const validated = TemplateSubmissionSchema.parse(submission);
    
    const template: CommunityTemplate = {
      ...validated,
      id: `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      downloads: 0,
      ratings: {
        average: 0,
        count: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      },
      status: 'pending',
      featured: false,
      verified: false
    };

    this.templates.set(template.id, template);
    this.moderationQueue.push(template.id);

    // Create or update user
    const userId = `usr_${template.author.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const user = this.users.get(userId) || {
      id: userId,
      name: template.author.name,
      email: template.author.email,
      github: template.author.github,
      reputation: 0,
      badges: [],
      templates: [],
      reviews: [],
      joinedAt: new Date(),
      lastActive: new Date()
    };
    
    user.templates.push(template.id);
    user.lastActive = new Date();
    this.users.set(userId, user);

    this.emit('template:submitted', template);
    
    return template.id;
  }

  async searchTemplates(options: TemplateSearchOptions = {}): Promise<{
    templates: CommunityTemplate[];
    total: number;
    facets: {
      categories: Record<string, number>;
      tags: Record<string, number>;
      ratings: Record<string, number>;
    };
  }> {
    let filtered = Array.from(this.templates.values())
      .filter(t => t.status === 'approved');

    // Apply filters
    if (options.query) {
      const query = options.query.toLowerCase();
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (options.category) {
      filtered = filtered.filter(t => t.category === options.category);
    }

    if (options.tags?.length) {
      filtered = filtered.filter(t => 
        options.tags!.every(tag => t.tags.includes(tag))
      );
    }

    if (options.author) {
      filtered = filtered.filter(t => 
        t.author.name.toLowerCase().includes(options.author!.toLowerCase())
      );
    }

    if (options.minRating) {
      filtered = filtered.filter(t => t.ratings.average >= options.minRating!);
    }

    if (options.featured) {
      filtered = filtered.filter(t => t.featured);
    }

    if (options.verified) {
      filtered = filtered.filter(t => t.verified);
    }

    // Sort results
    const sortBy = options.sortBy || 'downloads';
    const sortOrder = options.sortOrder || 'desc';
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'downloads':
          comparison = a.downloads - b.downloads;
          break;
        case 'rating':
          comparison = a.ratings.average - b.ratings.average;
          break;
        case 'created':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updated':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Calculate facets
    const allTemplates = Array.from(this.templates.values()).filter(t => t.status === 'approved');
    const facets = {
      categories: {} as Record<string, number>,
      tags: {} as Record<string, number>,
      ratings: {} as Record<string, number>
    };

    allTemplates.forEach(t => {
      facets.categories[t.category] = (facets.categories[t.category] || 0) + 1;
      t.tags.forEach(tag => {
        facets.tags[tag] = (facets.tags[tag] || 0) + 1;
      });
      
      const ratingBucket = Math.floor(t.ratings.average).toString();
      facets.ratings[ratingBucket] = (facets.ratings[ratingBucket] || 0) + 1;
    });

    // Pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    const paginatedResults = filtered.slice(offset, offset + limit);

    return {
      templates: paginatedResults,
      total: filtered.length,
      facets
    };
  }

  async rateTemplate(rating: TemplateRating): Promise<void> {
    const validated = TemplateRatingSchema.parse(rating);
    const template = this.templates.get(validated.templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    const templateRatings = this.ratings.get(validated.templateId) || [];
    
    // Remove existing rating from same user
    const existingIndex = templateRatings.findIndex(r => r.userId === validated.userId);
    if (existingIndex >= 0) {
      templateRatings.splice(existingIndex, 1);
    }

    templateRatings.push(validated);
    this.ratings.set(validated.templateId, templateRatings);

    // Recalculate ratings
    this.updateTemplateRatings(validated.templateId);

    // Update user reputation
    const user = Array.from(this.users.values())
      .find(u => u.templates.includes(validated.templateId));
    if (user) {
      user.reputation += validated.rating > 3 ? 5 : -2;
      if (user.reputation > 100 && !user.badges.includes('popular-author')) {
        user.badges.push('popular-author');
        this.emit('user:badge-earned', user.id, 'popular-author');
      }
    }

    this.emit('template:rated', validated);
  }

  private updateTemplateRatings(templateId: string): void {
    const template = this.templates.get(templateId)!;
    const ratings = this.ratings.get(templateId) || [];

    if (ratings.length === 0) {
      template.ratings = {
        average: 0,
        count: 0,
        breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
      return;
    }

    const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const sum = ratings.reduce((acc, rating) => {
      breakdown[rating.rating as keyof typeof breakdown]++;
      return acc + rating.rating;
    }, 0);

    template.ratings = {
      average: Math.round((sum / ratings.length) * 10) / 10,
      count: ratings.length,
      breakdown
    };

    template.updatedAt = new Date();
  }

  async requestCollaboration(request: Omit<CollaborationRequest, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const collaboration: CollaborationRequest = {
      ...request,
      id: `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: new Date()
    };

    const templateCollabs = this.collaborations.get(request.templateId) || [];
    templateCollabs.push(collaboration);
    this.collaborations.set(request.templateId, templateCollabs);

    this.emit('collaboration:requested', collaboration);
    
    return collaboration.id;
  }

  async respondToCollaboration(collaborationId: string, response: 'accepted' | 'rejected', message?: string): Promise<void> {
    let found = false;
    
    for (const [templateId, collabs] of this.collaborations.entries()) {
      const collaboration = collabs.find(c => c.id === collaborationId);
      if (collaboration) {
        collaboration.status = response;
        collaboration.resolvedAt = new Date();
        
        if (response === 'accepted') {
          // Grant collaboration permissions
          this.grantCollaborationAccess(templateId, collaboration.requester, collaboration.type);
        }
        
        this.emit('collaboration:resolved', collaboration, message);
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error('Collaboration request not found');
    }
  }

  private grantCollaborationAccess(templateId: string, userId: string, type: string): void {
    const user = this.users.get(userId);
    if (user) {
      const badgeMap = {
        contribution: 'contributor',
        maintenance: 'maintainer',
        translation: 'translator'
      };
      
      const badge = badgeMap[type as keyof typeof badgeMap];
      if (badge && !user.badges.includes(badge)) {
        user.badges.push(badge);
        this.emit('user:badge-earned', userId, badge);
      }
      
      user.reputation += 10;
    }
  }

  async downloadTemplate(templateId: string, userId?: string): Promise<CommunityTemplate> {
    const template = this.templates.get(templateId);
    
    if (!template || template.status !== 'approved') {
      throw new Error('Template not found or not approved');
    }

    template.downloads++;
    
    if (userId) {
      // Track user downloads for recommendations
      this.emit('template:downloaded', templateId, userId);
    }

    return template;
  }

  async flagTemplate(templateId: string, reason: string): Promise<void> {
    const template = this.templates.get(templateId);
    
    if (!template) {
      throw new Error('Template not found');
    }

    template.status = 'flagged';
    template.moderationNotes = reason;
    
    if (!this.moderationQueue.includes(templateId)) {
      this.moderationQueue.unshift(templateId); // Priority review
    }

    this.emit('template:flagged', templateId, reason);
  }

  private async processContentSafety(template: CommunityTemplate): Promise<boolean> {
    // Basic safety checks
    const riskyPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /process\.exit/,
      /require\s*\(\s*['"]fs['"]/,
      /import.*fs/,
      /\.exec\(/,
      /child_process/
    ];

    const isRisky = riskyPatterns.some(pattern => 
      pattern.test(template.template) || 
      template.examples.some(ex => pattern.test(ex.expected))
    );

    if (isRisky) {
      template.moderationNotes = 'Contains potentially unsafe code patterns';
      return false;
    }

    return true;
  }

  private async processQualityCheck(template: CommunityTemplate): Promise<boolean> {
    // Quality scoring
    let score = 0;
    
    // Description quality
    if (template.description.length > 50) score += 20;
    if (template.description.length > 200) score += 10;
    
    // Examples provided
    score += template.examples.length * 15;
    
    // README provided
    if (template.readme && template.readme.length > 100) score += 20;
    
    // Proper versioning
    if (/^\d+\.\d+\.\d+$/.test(template.version)) score += 10;
    
    // License specified
    score += 10;
    
    // Tags (up to 25 points)
    score += Math.min(template.tags.length * 5, 25);

    return score >= 70; // Minimum quality threshold
  }

  private async processOriginality(template: CommunityTemplate): Promise<boolean> {
    // Check for similar templates
    const existing = Array.from(this.templates.values())
      .filter(t => t.id !== template.id && t.status === 'approved');
    
    const similarity = this.calculateTemplateSimilarity(template, existing);
    
    if (similarity > 0.9) {
      template.moderationNotes = 'Too similar to existing templates';
      return false;
    }

    return true;
  }

  private calculateTemplateSimilarity(template: CommunityTemplate, existing: CommunityTemplate[]): number {
    let maxSimilarity = 0;
    
    for (const other of existing) {
      // Name similarity
      const nameSim = this.stringSimilarity(template.name, other.name);
      
      // Description similarity
      const descSim = this.stringSimilarity(template.description, other.description);
      
      // Tag overlap
      const commonTags = template.tags.filter(tag => other.tags.includes(tag));
      const tagSim = commonTags.length / Math.max(template.tags.length, other.tags.length);
      
      // Template content similarity (simplified)
      const contentSim = this.stringSimilarity(
        template.template.replace(/\s+/g, ' ').trim(),
        other.template.replace(/\s+/g, ' ').trim()
      );
      
      const overallSim = (nameSim * 0.3 + descSim * 0.2 + tagSim * 0.2 + contentSim * 0.3);
      maxSimilarity = Math.max(maxSimilarity, overallSim);
    }
    
    return maxSimilarity;
  }

  private stringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async processModerationQueue(): Promise<void> {
    if (this.moderationQueue.length === 0) return;

    const templateId = this.moderationQueue.shift()!;
    const template = this.templates.get(templateId);
    
    if (!template || template.status !== 'pending') return;

    try {
      // Run automated checks
      const safetyCheck = await this.processContentSafety(template);
      const qualityCheck = await this.processQualityCheck(template);
      const originalityCheck = await this.processOriginality(template);

      if (safetyCheck && qualityCheck && originalityCheck) {
        template.status = 'approved';
        this.emit('template:approved', templateId);
        
        // Auto-feature high-quality templates
        if (template.examples.length >= 3 && template.readme && template.readme.length > 500) {
          this.featureTemplate(templateId);
        }
      } else {
        template.status = 'rejected';
        this.emit('template:rejected', templateId, template.moderationNotes);
      }
    } catch (error) {
      template.status = 'rejected';
      template.moderationNotes = `Moderation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.emit('template:rejected', templateId, template.moderationNotes);
    }
  }

  async featureTemplate(templateId: string): Promise<void> {
    const template = this.templates.get(templateId);
    
    if (!template || template.status !== 'approved') {
      throw new Error('Template not found or not approved');
    }

    template.featured = true;
    this.featuredTemplates.unshift(templateId);
    
    // Keep only top 10 featured templates
    if (this.featuredTemplates.length > 10) {
      const removed = this.featuredTemplates.pop()!;
      const removedTemplate = this.templates.get(removed);
      if (removedTemplate) {
        removedTemplate.featured = false;
      }
    }

    this.emit('template:featured', templateId);
  }

  async getTemplateRecommendations(userId: string, limit = 5): Promise<CommunityTemplate[]> {
    const user = this.users.get(userId);
    if (!user) return [];

    // Get user's download and rating history
    const userTemplates = user.templates.map(id => this.templates.get(id)).filter(Boolean) as CommunityTemplate[];
    const userCategories = [...new Set(userTemplates.map(t => t.category))];
    const userTags = [...new Set(userTemplates.flatMap(t => t.tags))];

    // Find similar templates
    const candidates = Array.from(this.templates.values())
      .filter(t => 
        t.status === 'approved' && 
        !user.templates.includes(t.id) &&
        (userCategories.includes(t.category) || 
         t.tags.some(tag => userTags.includes(tag)))
      )
      .sort((a, b) => {
        // Score by category match, tag overlap, and rating
        const aScore = (userCategories.includes(a.category) ? 2 : 0) +
                      a.tags.filter(tag => userTags.includes(tag)).length +
                      a.ratings.average;
        const bScore = (userCategories.includes(b.category) ? 2 : 0) +
                      b.tags.filter(tag => userTags.includes(tag)).length +
                      b.ratings.average;
        return bScore - aScore;
      })
      .slice(0, limit);

    return candidates;
  }

  async getCommunityStats(): Promise<{
    templates: {
      total: number;
      approved: number;
      pending: number;
      byCategory: Record<string, number>;
    };
    users: {
      total: number;
      active: number;
      topContributors: Array<{ name: string; templates: number; reputation: number }>;
    };
    engagement: {
      totalDownloads: number;
      totalRatings: number;
      averageRating: number;
    };
  }> {
    const templates = Array.from(this.templates.values());
    const users = Array.from(this.users.values());
    const allRatings = Array.from(this.ratings.values()).flat();

    const byCategory: Record<string, number> = {};
    templates.forEach(t => {
      byCategory[t.category] = (byCategory[t.category] || 0) + 1;
    });

    const activeUsers = users.filter(u => 
      u.lastActive.getTime() > Date.now() - (30 * 24 * 60 * 60 * 1000) // 30 days
    );

    const topContributors = users
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, 10)
      .map(u => ({
        name: u.name,
        templates: u.templates.length,
        reputation: u.reputation
      }));

    const totalDownloads = templates.reduce((sum, t) => sum + t.downloads, 0);
    const averageRating = allRatings.length > 0 
      ? allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length 
      : 0;

    return {
      templates: {
        total: templates.length,
        approved: templates.filter(t => t.status === 'approved').length,
        pending: templates.filter(t => t.status === 'pending').length,
        byCategory
      },
      users: {
        total: users.length,
        active: activeUsers.length,
        topContributors
      },
      engagement: {
        totalDownloads,
        totalRatings: allRatings.length,
        averageRating: Math.round(averageRating * 10) / 10
      }
    };
  }

  async exportTemplateBundle(templateIds: string[]): Promise<{
    templates: CommunityTemplate[];
    metadata: {
      exportedAt: Date;
      version: string;
      totalSize: number;
    };
  }> {
    const templates = templateIds
      .map(id => this.templates.get(id))
      .filter(Boolean) as CommunityTemplate[];

    const bundle = {
      templates,
      metadata: {
        exportedAt: new Date(),
        version: '1.0.0',
        totalSize: templates.reduce((size, t) => size + t.template.length, 0)
      }
    };

    this.emit('bundle:exported', bundle);
    
    return bundle;
  }
}

// Export singleton instance
export const communitySystem = new UnjucksCommunitySystem();

// CLI integration helpers
export const CommunityHelpers = {
  async initializeCommunity(): Promise<void> {
    console.log('🚀 Initializing UNJUCKS Community System...');
    
    // Set up event listeners for logging
    communitySystem.on('template:submitted', (template) => {
      console.log(`✅ Template submitted: ${template.name} by ${template.author.name}`);
    });
    
    communitySystem.on('template:approved', (templateId) => {
      console.log(`✅ Template approved: ${templateId}`);
    });
    
    communitySystem.on('template:rejected', (templateId, reason) => {
      console.log(`❌ Template rejected: ${templateId} - ${reason}`);
    });
    
    communitySystem.on('template:featured', (templateId) => {
      console.log(`⭐ Template featured: ${templateId}`);
    });
    
    communitySystem.on('user:badge-earned', (userId, badge) => {
      console.log(`🏆 Badge earned: ${userId} - ${badge}`);
    });
    
    console.log('✅ Community system initialized');
  },

  async displayCommunityStats(): Promise<void> {
    const stats = await communitySystem.getCommunityStats();
    
    console.log('\n📊 UNJUCKS Community Statistics');
    console.log('================================');
    console.log(`Templates: ${stats.templates.approved}/${stats.templates.total} approved (${stats.templates.pending} pending)`);
    console.log(`Users: ${stats.users.active}/${stats.users.total} active`);
    console.log(`Downloads: ${stats.engagement.totalDownloads.toLocaleString()}`);
    console.log(`Ratings: ${stats.engagement.totalRatings} (avg: ${stats.engagement.averageRating}⭐)`);
    
    console.log('\nTop Categories:');
    Object.entries(stats.templates.byCategory)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .forEach(([category, count]) => {
        console.log(`  ${category}: ${count} templates`);
      });
    
    console.log('\nTop Contributors:');
    stats.users.topContributors.slice(0, 5).forEach((user, i) => {
      console.log(`  ${i + 1}. ${user.name} - ${user.templates} templates (${user.reputation} rep)`);
    });
  },

  formatTemplateForDisplay(template: CommunityTemplate): string {
    const stars = '⭐'.repeat(Math.floor(template.ratings.average));
    const featured = template.featured ? '🌟' : '';
    const verified = template.verified ? '✅' : '';
    
    return [
      `${featured}${verified}${template.name} v${template.version}`,
      `  📝 ${template.description}`,
      `  👤 ${template.author.name} | 🏷️  ${template.tags.join(', ')}`,
      `  ${stars} ${template.ratings.average} (${template.ratings.count}) | ⬇️  ${template.downloads.toLocaleString()}`
    ].join('\n');
  }
};