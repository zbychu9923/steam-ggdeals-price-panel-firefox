(() => {
  const SUPPORTED_LANGS = ['pl', 'en'];
  const SETTINGS_KEY = 'ggd-settings';
  const DEFAULT_LANG = 'en';

  function normalizeLanguage(lang) {
    const value = String(lang || '').trim().toLowerCase();
    if (!value) return DEFAULT_LANG;
    const base = value.split(/[-_]/)[0];
    return SUPPORTED_LANGS.includes(base) ? base : DEFAULT_LANG;
  }

  function detectBrowserLanguage() {
    const candidates = [];

    try {
      if (typeof browser !== 'undefined' && browser?.i18n?.getUILanguage) {
        candidates.push(browser.i18n.getUILanguage());
      }
    } catch {}

    try {
      if (Array.isArray(navigator.languages)) {
        candidates.push(...navigator.languages);
      }
    } catch {}

    try {
      candidates.push(navigator.language);
      candidates.push(navigator.userLanguage);
      candidates.push(document.documentElement?.lang);
    } catch {}

    for (const candidate of candidates) {
      const normalized = normalizeLanguage(candidate);
      if (SUPPORTED_LANGS.includes(normalized)) {
        return normalized;
      }
    }

    return DEFAULT_LANG;
  }

  async function loadLocale(lang) {
    const normalized = normalizeLanguage(lang);
    const url = browser.runtime.getURL(`src/locales/${normalized}.json`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load locale: ${normalized}`);
    }
    return response.json();
  }

  async function resolveLanguageFromSettings() {
    try {
      const store = await browser.storage.local.get(SETTINGS_KEY);
      const settings = store?.[SETTINGS_KEY] || {};
      if (settings.language) {
        return normalizeLanguage(settings.language);
      }
    } catch {}

    return detectBrowserLanguage();
  }

  function t(messages, key, vars = {}) {
    const template = messages?.[key] ?? key;
    return String(template).replace(/\{(\w+)\}/g, (_, name) => {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{${name}}`;
    });
  }

  const REGION_OPTIONS = [
    { value: 'au', currency: 'AUD', key: 'regionAU' },
    { value: 'be', currency: 'EUR', key: 'regionBE' },
    { value: 'br', currency: 'BRL', key: 'regionBR' },
    { value: 'ca', currency: 'CAD', key: 'regionCA' },
    { value: 'ch', currency: 'CHF', key: 'regionCH' },
    { value: 'de', currency: 'EUR', key: 'regionDE' },
    { value: 'dk', currency: 'DKK', key: 'regionDK' },
    { value: 'es', currency: 'EUR', key: 'regionES' },
    { value: 'eu', currency: 'EUR', key: 'regionEU' },
    { value: 'fi', currency: 'EUR', key: 'regionFI' },
    { value: 'fr', currency: 'EUR', key: 'regionFR' },
    { value: 'gb', currency: 'GBP', key: 'regionGB' },
    { value: 'ie', currency: 'EUR', key: 'regionIE' },
    { value: 'it', currency: 'EUR', key: 'regionIT' },
    { value: 'nl', currency: 'EUR', key: 'regionNL' },
    { value: 'no', currency: 'NOK', key: 'regionNO' },
    { value: 'pl', currency: 'PLN', key: 'regionPL' },
    { value: 'se', currency: 'SEK', key: 'regionSE' },
    { value: 'us', currency: 'USD', key: 'regionUS' }
  ];

  function normalizeRegion(region) {
    const value = String(region || '').trim().toLowerCase();
    return REGION_OPTIONS.some((option) => option.value === value) ? value : 'pl';
  }

  window.GGDI18n = {
    SUPPORTED_LANGS,
    DEFAULT_LANG,
    SETTINGS_KEY,
    REGION_OPTIONS,
    loadLocale,
    normalizeLanguage,
    detectBrowserLanguage,
    resolveLanguageFromSettings,
    normalizeRegion,
    t
  };
})();
