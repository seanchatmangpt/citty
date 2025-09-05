/**
 * Internationalization System - Production Polish Feature
 * Comprehensive i18n support with dynamic loading, pluralization, and localization
 */

import { ref, reactive, computed, watch } from 'vue';

export interface Translation {
  key: string;
  value: string;
  context?: string;
  description?: string;
  placeholders?: Record<string, string>;
}

export interface Locale {
  code: string;
  name: string;
  nativeName: string;
  direction: 'ltr' | 'rtl';
  region: string;
  currency: {
    code: string;
    symbol: string;
    name: string;
  };
  dateFormat: {
    short: string;
    medium: string;
    long: string;
    full: string;
  };
  timeFormat: {
    short: string;
    medium: string;
    long: string;
  };
  numberFormat: {
    decimal: string;
    thousand: string;
    precision: number;
  };
  pluralRules: (count: number) => 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';
}

export interface TranslationNamespace {
  id: string;
  name: string;
  description: string;
  translations: Map<string, Translation>;
  fallback?: string;
}

export interface InterpolationContext {
  count?: number;
  [key: string]: any;
}

export interface LocalizationOptions {
  locale?: string;
  fallbackLocale?: string;
  namespace?: string;
  interpolation?: InterpolationContext;
  format?: 'text' | 'html' | 'markdown';
}

export interface CurrencyFormatOptions {
  style?: 'symbol' | 'code' | 'name';
  precision?: number;
  showZero?: boolean;
}

export interface DateTimeFormatOptions {
  format?: 'short' | 'medium' | 'long' | 'full' | 'relative';
  includeTime?: boolean;
  timezone?: string;
}

export interface NumberFormatOptions {
  style?: 'decimal' | 'percent' | 'scientific' | 'engineering';
  precision?: number;
  compact?: boolean;
}

export class InternationalizationEngine {
  private currentLocale: string = 'en';
  private fallbackLocale: string = 'en';
  private locales: Map<string, Locale> = new Map();
  private namespaces: Map<string, TranslationNamespace> = new Map();
  private loadedTranslations: Map<string, Map<string, Translation>> = new Map();
  private missingKeys: Set<string> = new Set();
  private translationCache: Map<string, string> = new Map();
  private interpolationRegex = /\{\{(\w+)\}\}/g;
  private pluralizationCache: Map<string, Map<number, string>> = new Map();
  
  constructor() {
    this.setupDefaultLocales();
    this.setupDefaultNamespaces();
    this.detectBrowserLocale();
  }

  /**
   * Initialize with locale and load translations
   */
  async initialize(locale: string, namespaces: string[] = ['common']): Promise<void> {
    this.setLocale(locale);
    
    // Load translations for specified namespaces
    await Promise.all(
      namespaces.map(namespace => this.loadNamespace(namespace, locale))
    );
  }

  /**
   * Set current locale
   */
  setLocale(locale: string): void {
    if (!this.locales.has(locale)) {
      console.warn(`Locale ${locale} not supported, falling back to ${this.fallbackLocale}`);
      locale = this.fallbackLocale;
    }
    
    this.currentLocale = locale;
    this.clearCache();
    this.updateDocumentLanguage();
    this.updateDocumentDirection();
  }

  /**
   * Get current locale
   */
  getCurrentLocale(): Locale {
    return this.locales.get(this.currentLocale) || this.locales.get(this.fallbackLocale)!;
  }

  /**
   * Get available locales
   */
  getAvailableLocales(): Locale[] {
    return Array.from(this.locales.values());
  }

  /**
   * Translate a key with optional interpolation
   */
  translate(
    key: string,
    options: LocalizationOptions = {}
  ): string {
    const {
      locale = this.currentLocale,
      namespace = 'common',
      interpolation = {},
      format = 'text'
    } = options;

    // Generate cache key
    const cacheKey = `${locale}:${namespace}:${key}:${JSON.stringify(interpolation)}`;
    
    // Check cache first
    if (this.translationCache.has(cacheKey)) {
      return this.translationCache.get(cacheKey)!;
    }

    let translation = this.getTranslation(key, locale, namespace);
    
    // If not found, try fallback locale
    if (!translation && locale !== this.fallbackLocale) {
      translation = this.getTranslation(key, this.fallbackLocale, namespace);
    }
    
    // If still not found, log missing key and return key
    if (!translation) {
      this.logMissingKey(key, locale, namespace);
      this.translationCache.set(cacheKey, key);
      return key;
    }

    // Handle pluralization
    if (interpolation.count !== undefined) {
      translation = this.handlePluralization(translation, interpolation.count, locale);
    }

    // Interpolate variables
    let result = this.interpolate(translation, interpolation);

    // Apply formatting
    result = this.applyFormatting(result, format);

    // Cache result
    this.translationCache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Translate with pluralization support
   */
  translatePlural(
    key: string,
    count: number,
    options: Omit<LocalizationOptions, 'interpolation'> & {
      interpolation?: Omit<InterpolationContext, 'count'>;
    } = {}
  ): string {
    return this.translate(key, {
      ...options,
      interpolation: {
        ...options.interpolation,
        count
      }
    });
  }

  /**
   * Check if translation exists
   */
  hasTranslation(key: string, locale?: string, namespace?: string): boolean {
    return !!this.getTranslation(
      key,
      locale || this.currentLocale,
      namespace || 'common'
    );
  }

  /**
   * Load translations for a namespace
   */
  async loadNamespace(namespace: string, locale: string): Promise<void> {
    try {
      // In a real implementation, this would load from files or API
      const translations = await this.fetchTranslations(namespace, locale);
      
      const nsTranslations = new Map<string, Translation>();
      translations.forEach(translation => {
        nsTranslations.set(translation.key, translation);
      });
      
      const key = `${locale}:${namespace}`;
      this.loadedTranslations.set(key, nsTranslations);
      
    } catch (error) {
      console.error(`Failed to load translations for ${namespace}:${locale}`, error);
    }
  }

  /**
   * Add translations dynamically
   */
  addTranslations(
    namespace: string,
    locale: string,
    translations: Record<string, string | Translation>
  ): void {
    const key = `${locale}:${namespace}`;
    let nsTranslations = this.loadedTranslations.get(key);
    
    if (!nsTranslations) {
      nsTranslations = new Map();
      this.loadedTranslations.set(key, nsTranslations);
    }

    Object.entries(translations).forEach(([translationKey, value]) => {
      const translation: Translation = typeof value === 'string' 
        ? { key: translationKey, value }
        : value;
      
      nsTranslations!.set(translationKey, translation);
    });

    this.clearCache();
  }

  /**
   * Format currency value
   */
  formatCurrency(
    amount: number,
    options: CurrencyFormatOptions = {}
  ): string {
    const locale = this.getCurrentLocale();
    const {
      style = 'symbol',
      precision = 2,
      showZero = true
    } = options;

    if (!showZero && amount === 0) {
      return '';
    }

    try {
      const formatter = new Intl.NumberFormat(this.currentLocale, {
        style: 'currency',
        currency: locale.currency.code,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
        currencyDisplay: style
      });

      return formatter.format(amount);
    } catch (error) {
      // Fallback formatting
      const symbol = style === 'symbol' ? locale.currency.symbol : locale.currency.code;
      return `${symbol}${amount.toFixed(precision)}`;
    }
  }

  /**
   * Format date and time
   */
  formatDateTime(
    date: Date,
    options: DateTimeFormatOptions = {}
  ): string {
    const locale = this.getCurrentLocale();
    const {
      format = 'medium',
      includeTime = false,
      timezone
    } = options;

    if (format === 'relative') {
      return this.formatRelativeTime(date);
    }

    try {
      const formatOptions: Intl.DateTimeFormatOptions = {
        timeZone: timezone
      };

      switch (format) {
        case 'short':
          formatOptions.dateStyle = 'short';
          break;
        case 'medium':
          formatOptions.dateStyle = 'medium';
          break;
        case 'long':
          formatOptions.dateStyle = 'long';
          break;
        case 'full':
          formatOptions.dateStyle = 'full';
          break;
      }

      if (includeTime) {
        formatOptions.timeStyle = 'short';
      }

      const formatter = new Intl.DateTimeFormat(this.currentLocale, formatOptions);
      return formatter.format(date);
    } catch (error) {
      // Fallback formatting
      return date.toLocaleDateString(this.currentLocale);
    }
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    try {
      const formatter = new Intl.RelativeTimeFormat(this.currentLocale);

      if (Math.abs(diffSeconds) < 60) {
        return formatter.format(-diffSeconds, 'second');
      } else if (Math.abs(diffMinutes) < 60) {
        return formatter.format(-diffMinutes, 'minute');
      } else if (Math.abs(diffHours) < 24) {
        return formatter.format(-diffHours, 'hour');
      } else {
        return formatter.format(-diffDays, 'day');
      }
    } catch (error) {
      // Fallback
      if (diffDays > 0) {
        return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
      } else if (diffHours > 0) {
        return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
      } else if (diffMinutes > 0) {
        return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
      } else {
        return 'Just now';
      }
    }
  }

  /**
   * Format numbers
   */
  formatNumber(
    value: number,
    options: NumberFormatOptions = {}
  ): string {
    const {
      style = 'decimal',
      precision,
      compact = false
    } = options;

    try {
      const formatOptions: Intl.NumberFormatOptions = {
        style: style === 'decimal' ? 'decimal' : style
      };

      if (precision !== undefined) {
        formatOptions.minimumFractionDigits = precision;
        formatOptions.maximumFractionDigits = precision;
      }

      if (compact) {
        formatOptions.notation = 'compact';
      }

      const formatter = new Intl.NumberFormat(this.currentLocale, formatOptions);
      return formatter.format(value);
    } catch (error) {
      // Fallback
      return precision !== undefined ? value.toFixed(precision) : value.toString();
    }
  }

  /**
   * Get missing translation keys for debugging
   */
  getMissingKeys(): string[] {
    return Array.from(this.missingKeys);
  }

  /**
   * Generate translation template for translators
   */
  generateTranslationTemplate(namespace: string, locale: string): Record<string, any> {
    const key = `${locale}:${namespace}`;
    const translations = this.loadedTranslations.get(key);
    
    if (!translations) {
      return {};
    }

    const template: Record<string, any> = {};
    
    translations.forEach((translation, key) => {
      const keyParts = key.split('.');
      let current = template;
      
      for (let i = 0; i < keyParts.length - 1; i++) {
        if (!current[keyParts[i]]) {
          current[keyParts[i]] = {};
        }
        current = current[keyParts[i]];
      }
      
      current[keyParts[keyParts.length - 1]] = {
        value: '',
        description: translation.description,
        context: translation.context,
        placeholders: translation.placeholders
      };
    });

    return template;
  }

  /**
   * Validate translations for completeness
   */
  validateTranslations(baseLocale: string, targetLocale: string): {
    missing: string[];
    extra: string[];
    coverage: number;
  } {
    const missing: string[] = [];
    const extra: string[] = [];
    
    this.namespaces.forEach((_, namespace) => {
      const baseKey = `${baseLocale}:${namespace}`;
      const targetKey = `${targetLocale}:${namespace}`;
      
      const baseTranslations = this.loadedTranslations.get(baseKey);
      const targetTranslations = this.loadedTranslations.get(targetKey);
      
      if (!baseTranslations) return;
      
      baseTranslations.forEach((_, key) => {
        if (!targetTranslations?.has(key)) {
          missing.push(`${namespace}.${key}`);
        }
      });
      
      if (targetTranslations) {
        targetTranslations.forEach((_, key) => {
          if (!baseTranslations.has(key)) {
            extra.push(`${namespace}.${key}`);
          }
        });
      }
    });

    const totalKeys = Array.from(this.loadedTranslations.get(`${baseLocale}:common`)?.keys() || []).length;
    const coverage = totalKeys > 0 ? ((totalKeys - missing.length) / totalKeys) * 100 : 0;

    return { missing, extra, coverage };
  }

  // Private helper methods
  private setupDefaultLocales(): void {
    const locales: Locale[] = [
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
        direction: 'ltr',
        region: 'US',
        currency: { code: 'USD', symbol: '$', name: 'US Dollar' },
        dateFormat: {
          short: 'MM/dd/yyyy',
          medium: 'MMM d, yyyy',
          long: 'MMMM d, yyyy',
          full: 'EEEE, MMMM d, yyyy'
        },
        timeFormat: {
          short: 'h:mm a',
          medium: 'h:mm:ss a',
          long: 'h:mm:ss a z'
        },
        numberFormat: {
          decimal: '.',
          thousand: ',',
          precision: 2
        },
        pluralRules: (count) => count === 1 ? 'one' : 'other'
      },
      {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        direction: 'ltr',
        region: 'ES',
        currency: { code: 'EUR', symbol: '€', name: 'Euro' },
        dateFormat: {
          short: 'dd/MM/yyyy',
          medium: 'd MMM yyyy',
          long: 'd MMMM yyyy',
          full: 'EEEE, d MMMM yyyy'
        },
        timeFormat: {
          short: 'H:mm',
          medium: 'H:mm:ss',
          long: 'H:mm:ss z'
        },
        numberFormat: {
          decimal: ',',
          thousand: '.',
          precision: 2
        },
        pluralRules: (count) => count === 1 ? 'one' : 'other'
      },
      {
        code: 'fr',
        name: 'French',
        nativeName: 'Français',
        direction: 'ltr',
        region: 'FR',
        currency: { code: 'EUR', symbol: '€', name: 'Euro' },
        dateFormat: {
          short: 'dd/MM/yyyy',
          medium: 'd MMM yyyy',
          long: 'd MMMM yyyy',
          full: 'EEEE d MMMM yyyy'
        },
        timeFormat: {
          short: 'HH:mm',
          medium: 'HH:mm:ss',
          long: 'HH:mm:ss z'
        },
        numberFormat: {
          decimal: ',',
          thousand: ' ',
          precision: 2
        },
        pluralRules: (count) => count === 1 ? 'one' : 'other'
      },
      {
        code: 'de',
        name: 'German',
        nativeName: 'Deutsch',
        direction: 'ltr',
        region: 'DE',
        currency: { code: 'EUR', symbol: '€', name: 'Euro' },
        dateFormat: {
          short: 'dd.MM.yyyy',
          medium: 'd. MMM yyyy',
          long: 'd. MMMM yyyy',
          full: 'EEEE, d. MMMM yyyy'
        },
        timeFormat: {
          short: 'HH:mm',
          medium: 'HH:mm:ss',
          long: 'HH:mm:ss z'
        },
        numberFormat: {
          decimal: ',',
          thousand: '.',
          precision: 2
        },
        pluralRules: (count) => count === 1 ? 'one' : 'other'
      },
      {
        code: 'ar',
        name: 'Arabic',
        nativeName: 'العربية',
        direction: 'rtl',
        region: 'SA',
        currency: { code: 'SAR', symbol: 'ريال', name: 'Saudi Riyal' },
        dateFormat: {
          short: 'dd/MM/yyyy',
          medium: 'd MMM yyyy',
          long: 'd MMMM yyyy',
          full: 'EEEE، d MMMM yyyy'
        },
        timeFormat: {
          short: 'h:mm a',
          medium: 'h:mm:ss a',
          long: 'h:mm:ss a z'
        },
        numberFormat: {
          decimal: '.',
          thousand: ',',
          precision: 2
        },
        pluralRules: (count) => {
          if (count === 0) return 'zero';
          if (count === 1) return 'one';
          if (count === 2) return 'two';
          if (count % 100 >= 3 && count % 100 <= 10) return 'few';
          if (count % 100 >= 11 && count % 100 <= 99) return 'many';
          return 'other';
        }
      }
    ];

    locales.forEach(locale => {
      this.locales.set(locale.code, locale);
    });
  }

  private setupDefaultNamespaces(): void {
    const namespaces = [
      {
        id: 'common',
        name: 'Common',
        description: 'Common translations used throughout the application'
      },
      {
        id: 'navigation',
        name: 'Navigation',
        description: 'Navigation menu and routing translations'
      },
      {
        id: 'forms',
        name: 'Forms',
        description: 'Form labels, placeholders, and validation messages'
      },
      {
        id: 'errors',
        name: 'Errors',
        description: 'Error messages and notifications'
      },
      {
        id: 'marketplace',
        name: 'Marketplace',
        description: 'Marketplace-specific translations'
      }
    ];

    namespaces.forEach(ns => {
      this.namespaces.set(ns.id, {
        ...ns,
        translations: new Map()
      });
    });
  }

  private detectBrowserLocale(): void {
    const browserLocales = navigator.languages || [navigator.language];
    
    for (const locale of browserLocales) {
      const normalizedLocale = locale.split('-')[0].toLowerCase();
      if (this.locales.has(normalizedLocale)) {
        this.currentLocale = normalizedLocale;
        break;
      }
    }
  }

  private getTranslation(key: string, locale: string, namespace: string): string | null {
    const nsKey = `${locale}:${namespace}`;
    const translations = this.loadedTranslations.get(nsKey);
    
    if (!translations) {
      return null;
    }

    const translation = translations.get(key);
    return translation?.value || null;
  }

  private handlePluralization(translation: string, count: number, locale: string): string {
    const localeData = this.locales.get(locale);
    if (!localeData) {
      return translation;
    }

    // Check if translation has plural forms (separated by |)
    const forms = translation.split('|');
    if (forms.length === 1) {
      return translation;
    }

    const pluralForm = localeData.pluralRules(count);
    const formIndex = this.getPluralFormIndex(pluralForm, forms.length);
    
    return forms[formIndex] || forms[forms.length - 1];
  }

  private getPluralFormIndex(form: string, totalForms: number): number {
    const formOrder = ['zero', 'one', 'two', 'few', 'many', 'other'];
    const index = formOrder.indexOf(form);
    
    if (index === -1 || index >= totalForms) {
      return totalForms - 1; // Default to last form
    }
    
    return index;
  }

  private interpolate(text: string, context: InterpolationContext): string {
    return text.replace(this.interpolationRegex, (match, key) => {
      const value = context[key];
      return value !== undefined ? String(value) : match;
    });
  }

  private applyFormatting(text: string, format: LocalizationOptions['format']): string {
    switch (format) {
      case 'html':
        return text.replace(/\n/g, '<br>');
      case 'markdown':
        return text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
      default:
        return text;
    }
  }

  private logMissingKey(key: string, locale: string, namespace: string): void {
    const missingKey = `${locale}:${namespace}:${key}`;
    this.missingKeys.add(missingKey);
    
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Missing translation: ${missingKey}`);
    }
  }

  private clearCache(): void {
    this.translationCache.clear();
    this.pluralizationCache.clear();
  }

  private updateDocumentLanguage(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.currentLocale;
    }
  }

  private updateDocumentDirection(): void {
    if (typeof document !== 'undefined') {
      const locale = this.getCurrentLocale();
      document.documentElement.dir = locale.direction;
    }
  }

  private async fetchTranslations(namespace: string, locale: string): Promise<Translation[]> {
    // In a real implementation, this would fetch from files or API
    // For now, return some sample translations
    const sampleTranslations: Record<string, Record<string, string>> = {
      'en:common': {
        'welcome': 'Welcome',
        'loading': 'Loading...',
        'save': 'Save',
        'cancel': 'Cancel',
        'delete': 'Delete',
        'edit': 'Edit',
        'search': 'Search',
        'no_results': 'No results found',
        'item_count': '{count} item|{count} items'
      },
      'es:common': {
        'welcome': 'Bienvenido',
        'loading': 'Cargando...',
        'save': 'Guardar',
        'cancel': 'Cancelar',
        'delete': 'Eliminar',
        'edit': 'Editar',
        'search': 'Buscar',
        'no_results': 'No se encontraron resultados',
        'item_count': '{count} elemento|{count} elementos'
      },
      'fr:common': {
        'welcome': 'Bienvenue',
        'loading': 'Chargement...',
        'save': 'Enregistrer',
        'cancel': 'Annuler',
        'delete': 'Supprimer',
        'edit': 'Modifier',
        'search': 'Rechercher',
        'no_results': 'Aucun résultat trouvé',
        'item_count': '{count} élément|{count} éléments'
      }
    };

    const key = `${locale}:${namespace}`;
    const translations = sampleTranslations[key] || {};

    return Object.entries(translations).map(([translationKey, value]) => ({
      key: translationKey,
      value
    }));
  }
}

/**
 * Vue 3 Composable for Internationalization
 */
export function useInternationalization() {
  const engine = reactive(new InternationalizationEngine());
  const currentLocale = ref(engine.getCurrentLocale());
  const isLoading = ref(false);

  // Watch for locale changes
  watch(() => engine.getCurrentLocale(), (newLocale) => {
    currentLocale.value = newLocale;
  });

  const initialize = async (locale: string, namespaces: string[] = ['common']) => {
    isLoading.value = true;
    try {
      await engine.initialize(locale, namespaces);
      currentLocale.value = engine.getCurrentLocale();
    } finally {
      isLoading.value = false;
    }
  };

  const setLocale = (locale: string) => {
    engine.setLocale(locale);
    currentLocale.value = engine.getCurrentLocale();
  };

  const t = (key: string, options?: LocalizationOptions) => {
    return engine.translate(key, options);
  };

  const tc = (key: string, count: number, options?: any) => {
    return engine.translatePlural(key, count, options);
  };

  const formatCurrency = (amount: number, options?: CurrencyFormatOptions) => {
    return engine.formatCurrency(amount, options);
  };

  const formatDate = (date: Date, options?: DateTimeFormatOptions) => {
    return engine.formatDateTime(date, options);
  };

  const formatNumber = (value: number, options?: NumberFormatOptions) => {
    return engine.formatNumber(value, options);
  };

  const formatRelativeTime = (date: Date) => {
    return engine.formatRelativeTime(date);
  };

  const hasTranslation = (key: string, locale?: string, namespace?: string) => {
    return engine.hasTranslation(key, locale, namespace);
  };

  const addTranslations = (namespace: string, locale: string, translations: Record<string, string>) => {
    engine.addTranslations(namespace, locale, translations);
  };

  const loadNamespace = async (namespace: string, locale?: string) => {
    isLoading.value = true;
    try {
      await engine.loadNamespace(namespace, locale || currentLocale.value.code);
    } finally {
      isLoading.value = false;
    }
  };

  const availableLocales = computed(() => engine.getAvailableLocales());
  const missingKeys = computed(() => engine.getMissingKeys());

  const generateTemplate = (namespace: string, locale: string) => {
    return engine.generateTranslationTemplate(namespace, locale);
  };

  const validateTranslations = (baseLocale: string, targetLocale: string) => {
    return engine.validateTranslations(baseLocale, targetLocale);
  };

  return {
    initialize,
    setLocale,
    t,
    tc,
    formatCurrency,
    formatDate,
    formatNumber,
    formatRelativeTime,
    hasTranslation,
    addTranslations,
    loadNamespace,
    generateTemplate,
    validateTranslations,
    currentLocale: readonly(currentLocale),
    availableLocales,
    missingKeys,
    isLoading: readonly(isLoading)
  };
}