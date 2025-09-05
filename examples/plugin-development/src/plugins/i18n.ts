import { definePlugin } from '../plugin-system'
import { defu } from 'defu'
import type { PluginContext, TemplateContext } from '@unjs/unjucks'

interface TranslationDict {
  [key: string]: string | TranslationDict
}

interface I18nConfig {
  defaultLocale: string
  locales: string[]
  fallbackLocale: string
  loadPath: string
  interpolation: {
    prefix: string
    suffix: string
  }
}

export default definePlugin({
  name: 'i18n',
  version: '1.0.0', 
  description: 'Internationalization plugin with template localization support',
  author: 'UnJucks Team',

  config: {
    defaultLocale: 'en',
    locales: ['en'],
    fallbackLocale: 'en',
    loadPath: './locales/{{locale}}.json',
    interpolation: {
      prefix: '{{',
      suffix: '}}'
    },
    translations: {} as Record<string, TranslationDict>
  } as I18nConfig & { translations: Record<string, TranslationDict> },

  async setup(context: PluginContext) {
    // Load translation files
    for (const locale of this.config.locales) {
      try {
        const translationPath = this.config.loadPath.replace('{{locale}}', locale)
        const translations = await context.unjucks.readTemplate(translationPath)
        this.config.translations[locale] = JSON.parse(translations)
        console.log(`✅ Loaded translations for ${locale}`)
      } catch (error) {
        console.warn(`Failed to load translations for ${locale}:`, error)
        this.config.translations[locale] = {}
      }
    }

    // Add locale context to templates
    context.unjucks.addGlobal('i18n', {
      locale: this.config.defaultLocale,
      t: (key: string, options?: any) => this.translate(key, this.config.defaultLocale, options),
      availableLocales: this.config.locales
    })
  },

  beforeRender(template: string, data: any, context: TemplateContext) {
    // Set locale from data or use default
    const locale = data.locale || context.locale || this.config.defaultLocale
    
    // Add translation helpers to template data
    data._i18n = {
      locale,
      t: (key: string, options?: any) => this.translate(key, locale, options),
      setLocale: (newLocale: string) => {
        if (this.config.locales.includes(newLocale)) {
          data._i18n.locale = newLocale
        }
      },
      availableLocales: this.config.locales,
      isRTL: this.isRTL(locale)
    }
  },

  filters: {
    // Translate a key
    t: (key: string, locale?: string, options?: any) => {
      const targetLocale = locale || this.config.defaultLocale
      return this.translate(key, targetLocale, options)
    },

    // Format date according to locale
    localDate: (date: Date | string, locale?: string, options?: Intl.DateTimeFormatOptions) => {
      const targetLocale = locale || this.config.defaultLocale
      const dateObj = date instanceof Date ? date : new Date(date)
      return new Intl.DateTimeFormat(targetLocale, options).format(dateObj)
    },

    // Format number according to locale
    localNumber: (number: number, locale?: string, options?: Intl.NumberFormatOptions) => {
      const targetLocale = locale || this.config.defaultLocale
      return new Intl.NumberFormat(targetLocale, options).format(number)
    },

    // Format currency
    currency: (amount: number, currency: string = 'USD', locale?: string) => {
      const targetLocale = locale || this.config.defaultLocale
      return new Intl.NumberFormat(targetLocale, {
        style: 'currency',
        currency
      }).format(amount)
    },

    // Pluralization
    plural: (count: number, key: string, locale?: string) => {
      const targetLocale = locale || this.config.defaultLocale
      const rules = new Intl.PluralRules(targetLocale)
      const category = rules.select(count)
      
      const pluralKey = `${key}.${category}`
      const translation = this.translate(pluralKey, targetLocale)
      
      // Fallback to singular form if plural not found
      if (translation === pluralKey) {
        return this.translate(key, targetLocale, { count })
      }
      
      return this.interpolate(translation, { count })
    }
  },

  functions: {
    // Load additional translations at runtime
    loadTranslations: async (context: PluginContext, locale: string, translations: TranslationDict) => {
      this.config.translations[locale] = defu(translations, this.config.translations[locale] || {})
    },

    // Add new locale support
    addLocale: async (context: PluginContext, locale: string, translationPath?: string) => {
      if (!this.config.locales.includes(locale)) {
        this.config.locales.push(locale)
      }

      if (translationPath) {
        try {
          const translations = await context.unjucks.readTemplate(translationPath)
          this.config.translations[locale] = JSON.parse(translations)
        } catch (error) {
          console.warn(`Failed to load translations for ${locale}:`, error)
          this.config.translations[locale] = {}
        }
      }
    },

    // Get all translations for a locale
    getTranslations: (context: PluginContext, locale: string) => {
      return this.config.translations[locale] || {}
    },

    // Switch template locale context
    withLocale: async (context: PluginContext, locale: string, template: string, data: any = {}) => {
      const originalLocale = data.locale
      data.locale = locale
      
      try {
        return await context.unjucks.render(template, data)
      } finally {
        data.locale = originalLocale
      }
    }
  },

  // Helper methods (not part of the plugin interface)
  translate(key: string, locale: string, options: any = {}): string {
    const translations = this.config.translations[locale] || {}
    const fallbackTranslations = this.config.translations[this.config.fallbackLocale] || {}
    
    // Get nested translation
    const getValue = (obj: TranslationDict, path: string): string | undefined => {
      const keys = path.split('.')
      let current: any = obj
      
      for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key]
        } else {
          return undefined
        }
      }
      
      return typeof current === 'string' ? current : undefined
    }
    
    // Try main locale first
    let translation = getValue(translations, key)
    
    // Fallback to fallback locale
    if (!translation && locale !== this.config.fallbackLocale) {
      translation = getValue(fallbackTranslations, key)
    }
    
    // Return key if no translation found
    if (!translation) {
      console.warn(`Translation missing for key: ${key} (locale: ${locale})`)
      return key
    }
    
    // Interpolate variables
    return this.interpolate(translation, options)
  },

  interpolate(template: string, data: Record<string, any>): string {
    const { prefix, suffix } = this.config.interpolation
    const regex = new RegExp(`${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+)${suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
    
    return template.replace(regex, (match, key) => {
      const value = data[key.trim()]
      return value !== undefined ? String(value) : match
    })
  },

  isRTL(locale: string): boolean {
    const rtlLocales = ['ar', 'he', 'fa', 'ur', 'yi']
    return rtlLocales.some(rtl => locale.startsWith(rtl))
  }
})