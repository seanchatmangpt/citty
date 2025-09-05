/**
 * User Preferences System - Production Polish Feature
 * Comprehensive theming, customization, and preference management
 */

import { ref, reactive, computed, watch } from 'vue';

export interface Theme {
  id: string;
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
  };
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    full: string;
  };
  shadows: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export interface NotificationPreferences {
  email: {
    enabled: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    newsletter: boolean;
    securityAlerts: boolean;
    priceAlerts: boolean;
    wishlistUpdates: boolean;
  };
  push: {
    enabled: boolean;
    orderUpdates: boolean;
    promotions: boolean;
    priceAlerts: boolean;
    messages: boolean;
  };
  sms: {
    enabled: boolean;
    orderUpdates: boolean;
    securityAlerts: boolean;
  };
  frequency: 'immediate' | 'daily' | 'weekly' | 'monthly';
}

export interface AccessibilityPreferences {
  highContrast: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  keyboardNavigation: boolean;
  focusIndicators: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  colorBlindness: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

export interface DisplayPreferences {
  theme: string;
  colorMode: 'light' | 'dark' | 'auto';
  layout: 'comfortable' | 'compact' | 'spacious';
  density: 'comfortable' | 'compact';
  gridSize: 'small' | 'medium' | 'large';
  cardStyle: 'minimal' | 'detailed' | 'image-focus';
  showPrices: boolean;
  showRatings: boolean;
  showStock: boolean;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
}

export interface SearchPreferences {
  defaultSort: 'relevance' | 'price-low' | 'price-high' | 'newest' | 'rating';
  resultsPerPage: 12 | 24 | 48 | 96;
  showOutOfStock: boolean;
  enableAutocomplete: boolean;
  saveSearchHistory: boolean;
  priceAlerts: boolean;
  enableSynonyms: boolean;
  fuzzyMatching: boolean;
  includeDescription: boolean;
}

export interface PrivacyPreferences {
  dataCollection: boolean;
  analytics: boolean;
  personalization: boolean;
  thirdPartySharing: boolean;
  marketingCookies: boolean;
  functionalCookies: boolean;
  profileVisibility: 'public' | 'friends' | 'private';
  activityTracking: boolean;
  locationTracking: boolean;
  behaviorAnalysis: boolean;
}

export interface UserPreferences {
  userId: string;
  version: string;
  lastUpdated: Date;
  display: DisplayPreferences;
  notifications: NotificationPreferences;
  accessibility: AccessibilityPreferences;
  search: SearchPreferences;
  privacy: PrivacyPreferences;
  customizations: Record<string, any>;
}

export interface PreferenceGroup {
  id: string;
  name: string;
  icon: string;
  description: string;
  preferences: {
    key: string;
    label: string;
    type: 'boolean' | 'select' | 'multiselect' | 'range' | 'text' | 'color';
    default: any;
    options?: { value: any; label: string }[];
    min?: number;
    max?: number;
    step?: number;
    validation?: (value: any) => boolean;
    description?: string;
  }[];
}

export class UserPreferencesManager {
  private preferences: Map<string, UserPreferences> = new Map();
  private themes: Map<string, Theme> = new Map();
  private defaultPreferences: UserPreferences;
  private changeListeners: Map<string, ((prefs: UserPreferences) => void)[]> = new Map();
  private storageKey = 'user-preferences';
  
  constructor() {
    this.defaultPreferences = this.createDefaultPreferences();
    this.setupDefaultThemes();
    this.loadFromStorage();
    this.setupSystemThemeListener();
  }

  /**
   * Get user preferences with fallback to defaults
   */
  getUserPreferences(userId: string): UserPreferences {
    const existing = this.preferences.get(userId);
    if (existing) {
      // Merge with defaults to ensure new preferences are included
      return this.mergeWithDefaults(existing);
    }

    const defaultPrefs = {
      ...this.defaultPreferences,
      userId,
      lastUpdated: new Date()
    };

    this.preferences.set(userId, defaultPrefs);
    this.saveToStorage();
    return defaultPrefs;
  }

  /**
   * Update user preferences
   */
  updatePreferences(userId: string, updates: Partial<UserPreferences>): UserPreferences {
    const current = this.getUserPreferences(userId);
    const updated = {
      ...current,
      ...updates,
      userId,
      version: '1.0.0',
      lastUpdated: new Date()
    };

    this.preferences.set(userId, updated);
    this.saveToStorage();
    this.applyPreferences(updated);
    this.notifyListeners(userId, updated);

    return updated;
  }

  /**
   * Update specific preference section
   */
  updatePreferenceSection<K extends keyof UserPreferences>(
    userId: string,
    section: K,
    updates: Partial<UserPreferences[K]>
  ): UserPreferences {
    const current = this.getUserPreferences(userId);
    const updatedSection = {
      ...current[section],
      ...updates
    };

    return this.updatePreferences(userId, {
      [section]: updatedSection
    } as Partial<UserPreferences>);
  }

  /**
   * Get available themes
   */
  getAvailableThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  /**
   * Add custom theme
   */
  addCustomTheme(theme: Theme): void {
    this.themes.set(theme.id, theme);
  }

  /**
   * Get theme by ID
   */
  getTheme(themeId: string): Theme | undefined {
    return this.themes.get(themeId);
  }

  /**
   * Apply preferences to DOM/system
   */
  applyPreferences(preferences: UserPreferences): void {
    this.applyTheme(preferences.display.theme, preferences.display.colorMode);
    this.applyAccessibilitySettings(preferences.accessibility);
    this.applyDisplaySettings(preferences.display);
    this.configureCookieConsent(preferences.privacy);
  }

  /**
   * Export preferences for backup
   */
  exportPreferences(userId: string): string {
    const preferences = this.getUserPreferences(userId);
    return JSON.stringify(preferences, null, 2);
  }

  /**
   * Import preferences from backup
   */
  importPreferences(userId: string, data: string): UserPreferences {
    try {
      const imported = JSON.parse(data) as UserPreferences;
      return this.updatePreferences(userId, {
        ...imported,
        userId,
        lastUpdated: new Date()
      });
    } catch (error) {
      throw new Error('Invalid preferences data format');
    }
  }

  /**
   * Reset preferences to defaults
   */
  resetPreferences(userId: string): UserPreferences {
    const defaultPrefs = {
      ...this.defaultPreferences,
      userId,
      lastUpdated: new Date()
    };

    this.preferences.set(userId, defaultPrefs);
    this.saveToStorage();
    this.applyPreferences(defaultPrefs);
    this.notifyListeners(userId, defaultPrefs);

    return defaultPrefs;
  }

  /**
   * Get preference validation rules
   */
  getPreferenceGroups(): PreferenceGroup[] {
    return [
      {
        id: 'display',
        name: 'Display & Appearance',
        icon: 'palette',
        description: 'Customize the look and feel of your interface',
        preferences: [
          {
            key: 'theme',
            label: 'Theme',
            type: 'select',
            default: 'default',
            options: this.getAvailableThemes().map(t => ({ value: t.id, label: t.name }))
          },
          {
            key: 'colorMode',
            label: 'Color Mode',
            type: 'select',
            default: 'auto',
            options: [
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'auto', label: 'System' }
            ]
          },
          {
            key: 'layout',
            label: 'Layout Style',
            type: 'select',
            default: 'comfortable',
            options: [
              { value: 'comfortable', label: 'Comfortable' },
              { value: 'compact', label: 'Compact' },
              { value: 'spacious', label: 'Spacious' }
            ]
          }
        ]
      },
      {
        id: 'accessibility',
        name: 'Accessibility',
        icon: 'accessibility',
        description: 'Improve usability and accessibility',
        preferences: [
          {
            key: 'highContrast',
            label: 'High Contrast Mode',
            type: 'boolean',
            default: false
          },
          {
            key: 'reducedMotion',
            label: 'Reduce Motion',
            type: 'boolean',
            default: false
          },
          {
            key: 'fontSize',
            label: 'Font Size',
            type: 'select',
            default: 'medium',
            options: [
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
              { value: 'extra-large', label: 'Extra Large' }
            ]
          }
        ]
      },
      {
        id: 'notifications',
        name: 'Notifications',
        icon: 'bell',
        description: 'Manage your notification preferences',
        preferences: [
          {
            key: 'email.enabled',
            label: 'Email Notifications',
            type: 'boolean',
            default: true
          },
          {
            key: 'push.enabled',
            label: 'Push Notifications',
            type: 'boolean',
            default: true
          },
          {
            key: 'frequency',
            label: 'Notification Frequency',
            type: 'select',
            default: 'immediate',
            options: [
              { value: 'immediate', label: 'Immediate' },
              { value: 'daily', label: 'Daily Digest' },
              { value: 'weekly', label: 'Weekly Summary' }
            ]
          }
        ]
      },
      {
        id: 'privacy',
        name: 'Privacy & Data',
        icon: 'shield',
        description: 'Control your privacy and data settings',
        preferences: [
          {
            key: 'dataCollection',
            label: 'Allow Data Collection',
            type: 'boolean',
            default: true,
            description: 'Help improve our service by sharing anonymous usage data'
          },
          {
            key: 'personalization',
            label: 'Personalized Experience',
            type: 'boolean',
            default: true,
            description: 'Use your data to personalize your experience'
          },
          {
            key: 'profileVisibility',
            label: 'Profile Visibility',
            type: 'select',
            default: 'friends',
            options: [
              { value: 'public', label: 'Public' },
              { value: 'friends', label: 'Friends Only' },
              { value: 'private', label: 'Private' }
            ]
          }
        ]
      }
    ];
  }

  /**
   * Add preference change listener
   */
  addChangeListener(userId: string, callback: (preferences: UserPreferences) => void): void {
    if (!this.changeListeners.has(userId)) {
      this.changeListeners.set(userId, []);
    }
    this.changeListeners.get(userId)!.push(callback);
  }

  /**
   * Remove preference change listener
   */
  removeChangeListener(userId: string, callback: (preferences: UserPreferences) => void): void {
    const listeners = this.changeListeners.get(userId);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  // Private methods
  private createDefaultPreferences(): UserPreferences {
    return {
      userId: '',
      version: '1.0.0',
      lastUpdated: new Date(),
      display: {
        theme: 'default',
        colorMode: 'auto',
        layout: 'comfortable',
        density: 'comfortable',
        gridSize: 'medium',
        cardStyle: 'detailed',
        showPrices: true,
        showRatings: true,
        showStock: true,
        currency: 'USD',
        timezone: 'UTC',
        dateFormat: 'MM/DD/YYYY',
        numberFormat: 'en-US'
      },
      notifications: {
        email: {
          enabled: true,
          orderUpdates: true,
          promotions: false,
          newsletter: false,
          securityAlerts: true,
          priceAlerts: false,
          wishlistUpdates: true
        },
        push: {
          enabled: true,
          orderUpdates: true,
          promotions: false,
          priceAlerts: false,
          messages: true
        },
        sms: {
          enabled: false,
          orderUpdates: false,
          securityAlerts: true
        },
        frequency: 'immediate'
      },
      accessibility: {
        highContrast: false,
        reducedMotion: false,
        screenReader: false,
        keyboardNavigation: false,
        focusIndicators: true,
        fontSize: 'medium',
        colorBlindness: 'none'
      },
      search: {
        defaultSort: 'relevance',
        resultsPerPage: 24,
        showOutOfStock: false,
        enableAutocomplete: true,
        saveSearchHistory: true,
        priceAlerts: false,
        enableSynonyms: true,
        fuzzyMatching: true,
        includeDescription: true
      },
      privacy: {
        dataCollection: true,
        analytics: true,
        personalization: true,
        thirdPartySharing: false,
        marketingCookies: false,
        functionalCookies: true,
        profileVisibility: 'friends',
        activityTracking: true,
        locationTracking: false,
        behaviorAnalysis: true
      },
      customizations: {}
    };
  }

  private setupDefaultThemes(): void {
    // Light Theme
    this.themes.set('light', {
      id: 'light',
      name: 'Light',
      colors: {
        primary: '#3B82F6',
        secondary: '#8B5CF6',
        accent: '#10B981',
        background: '#FFFFFF',
        surface: '#F9FAFB',
        text: '#111827',
        textSecondary: '#6B7280',
        border: '#E5E7EB',
        error: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
        info: '#3B82F6'
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem'
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700
        },
        lineHeight: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75
        }
      },
      spacing: {
        xs: '0.5rem',
        sm: '1rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '3rem',
        '2xl': '4rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
      }
    });

    // Dark Theme
    this.themes.set('dark', {
      id: 'dark',
      name: 'Dark',
      colors: {
        primary: '#60A5FA',
        secondary: '#A78BFA',
        accent: '#34D399',
        background: '#111827',
        surface: '#1F2937',
        text: '#F9FAFB',
        textSecondary: '#9CA3AF',
        border: '#374151',
        error: '#F87171',
        warning: '#FBBF24',
        success: '#34D399',
        info: '#60A5FA'
      },
      typography: {
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: {
          xs: '0.75rem',
          sm: '0.875rem',
          base: '1rem',
          lg: '1.125rem',
          xl: '1.25rem',
          '2xl': '1.5rem',
          '3xl': '1.875rem'
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700
        },
        lineHeight: {
          tight: 1.25,
          normal: 1.5,
          relaxed: 1.75
        }
      },
      spacing: {
        xs: '0.5rem',
        sm: '1rem',
        md: '1.5rem',
        lg: '2rem',
        xl: '3rem',
        '2xl': '4rem'
      },
      borderRadius: {
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.25)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.25)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.25)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.25)'
      }
    });

    // Set default theme
    this.themes.set('default', this.themes.get('light')!);
  }

  private mergeWithDefaults(existing: UserPreferences): UserPreferences {
    return {
      ...this.defaultPreferences,
      ...existing,
      display: { ...this.defaultPreferences.display, ...existing.display },
      notifications: { ...this.defaultPreferences.notifications, ...existing.notifications },
      accessibility: { ...this.defaultPreferences.accessibility, ...existing.accessibility },
      search: { ...this.defaultPreferences.search, ...existing.search },
      privacy: { ...this.defaultPreferences.privacy, ...existing.privacy }
    };
  }

  private applyTheme(themeId: string, colorMode: 'light' | 'dark' | 'auto'): void {
    const theme = this.getTheme(themeId) || this.themes.get('default')!;
    let actualTheme = theme;

    // Handle auto mode
    if (colorMode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      actualTheme = this.themes.get(prefersDark ? 'dark' : 'light') || theme;
    } else if (colorMode === 'dark' || colorMode === 'light') {
      actualTheme = this.themes.get(colorMode) || theme;
    }

    // Apply CSS custom properties
    const root = document.documentElement;
    Object.entries(actualTheme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    Object.entries(actualTheme.typography.fontSize).forEach(([key, value]) => {
      root.style.setProperty(`--font-size-${key}`, value);
    });

    Object.entries(actualTheme.spacing).forEach(([key, value]) => {
      root.style.setProperty(`--spacing-${key}`, value);
    });

    root.setAttribute('data-theme', actualTheme.id);
    root.setAttribute('data-color-mode', colorMode);
  }

  private applyAccessibilitySettings(accessibility: AccessibilityPreferences): void {
    const root = document.documentElement;
    
    root.toggleAttribute('data-high-contrast', accessibility.highContrast);
    root.toggleAttribute('data-reduced-motion', accessibility.reducedMotion);
    root.setAttribute('data-font-size', accessibility.fontSize);
    
    if (accessibility.colorBlindness !== 'none') {
      root.setAttribute('data-color-blindness', accessibility.colorBlindness);
    } else {
      root.removeAttribute('data-color-blindness');
    }
  }

  private applyDisplaySettings(display: DisplayPreferences): void {
    const root = document.documentElement;
    
    root.setAttribute('data-layout', display.layout);
    root.setAttribute('data-density', display.density);
    root.setAttribute('data-grid-size', display.gridSize);
    root.setAttribute('data-card-style', display.cardStyle);
  }

  private configureCookieConsent(privacy: PrivacyPreferences): void {
    // Configure cookie consent based on privacy preferences
    // This would integrate with your cookie consent library
    console.log('Configuring cookie consent:', privacy);
  }

  private setupSystemThemeListener(): void {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      // Re-apply themes for users with 'auto' color mode
      this.preferences.forEach((prefs, userId) => {
        if (prefs.display.colorMode === 'auto') {
          this.applyTheme(prefs.display.theme, 'auto');
        }
      });
    });
  }

  private saveToStorage(): void {
    try {
      const data = Object.fromEntries(this.preferences);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save preferences to storage:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        Object.entries(parsed).forEach(([userId, prefs]) => {
          this.preferences.set(userId, prefs as UserPreferences);
        });
      }
    } catch (error) {
      console.error('Failed to load preferences from storage:', error);
    }
  }

  private notifyListeners(userId: string, preferences: UserPreferences): void {
    const listeners = this.changeListeners.get(userId);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(preferences);
        } catch (error) {
          console.error('Error in preference change listener:', error);
        }
      });
    }
  }
}

/**
 * Vue 3 Composable
 */
export function useUserPreferences(userId: string) {
  const manager = reactive(new UserPreferencesManager());
  const preferences = ref(manager.getUserPreferences(userId));
  
  const updatePreferences = (updates: Partial<UserPreferences>) => {
    preferences.value = manager.updatePreferences(userId, updates);
  };

  const updateSection = <K extends keyof UserPreferences>(
    section: K,
    updates: Partial<UserPreferences[K]>
  ) => {
    preferences.value = manager.updatePreferenceSection(userId, section, updates);
  };

  const resetToDefaults = () => {
    preferences.value = manager.resetPreferences(userId);
  };

  const exportPrefs = () => {
    return manager.exportPreferences(userId);
  };

  const importPrefs = (data: string) => {
    preferences.value = manager.importPreferences(userId, data);
  };

  const availableThemes = computed(() => manager.getAvailableThemes());
  const preferenceGroups = computed(() => manager.getPreferenceGroups());

  // Watch for changes and apply them
  watch(preferences, (newPrefs) => {
    manager.applyPreferences(newPrefs);
  }, { deep: true });

  // Apply preferences on mount
  manager.applyPreferences(preferences.value);

  return {
    preferences: readonly(preferences),
    updatePreferences,
    updateSection,
    resetToDefaults,
    exportPrefs,
    importPrefs,
    availableThemes,
    preferenceGroups
  };
}