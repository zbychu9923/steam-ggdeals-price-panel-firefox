(() => {
  const SETTINGS_KEY = 'ggd-settings';
  const SUPPORTED_LANGS = ['pl', 'en'];
  const DEFAULT_LANG = 'en';
  const DEFAULT_REGION = 'pl';
  const SUPPORTED_REGIONS = new Set(['au','be','br','ca','ch','de','dk','es','eu','fi','fr','gb','ie','it','nl','no','pl','se','us']);

  function normalizeLanguage(lang) {
    const value = String(lang || '').trim().toLowerCase();
    const base = value.split(/[-_]/)[0];
    return SUPPORTED_LANGS.includes(base) ? base : DEFAULT_LANG;
  }

  function detectBrowserLanguage() {
    try {
      const uiLang = browser.i18n?.getUILanguage?.();
      if (uiLang) return normalizeLanguage(uiLang);
    } catch {}
    return DEFAULT_LANG;
  }

  function normalizeRegion(region) {
    const value = String(region || '').trim().toLowerCase();
    return SUPPORTED_REGIONS.has(value) ? value : DEFAULT_REGION;
  }

  async function ensureDefaultSettings() {
    try {
      const store = await browser.storage.local.get(SETTINGS_KEY);
      const current = store?.[SETTINGS_KEY] || {};
      const next = {
        apiKey: typeof current.apiKey === 'string' ? current.apiKey : '',
        region: normalizeRegion(current.region || DEFAULT_REGION),
        language: normalizeLanguage(current.language || detectBrowserLanguage())
      };

      const shouldWrite =
        current.apiKey !== next.apiKey ||
        current.region !== next.region ||
        current.language !== next.language;

      if (shouldWrite) {
        await browser.storage.local.set({ [SETTINGS_KEY]: next });
      }
    } catch {}
  }

  browser.runtime.onInstalled.addListener(() => {
    ensureDefaultSettings();
  });

  browser.runtime.onStartup.addListener(() => {
    ensureDefaultSettings();
  });

  browser.runtime.onMessage.addListener((message) => {
    if (message?.type === 'ggd-fetch-price' && message.url) {
      return fetch(message.url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit'
      })
        .then(async (response) => {
          const text = await response.text();
          let data = null;

          try {
            data = text ? JSON.parse(text) : null;
          } catch {
            data = null;
          }

          return {
            ok: response.ok,
            status: response.status,
            headers: {
              limit: response.headers.get('x-ratelimit-limit'),
              remaining: response.headers.get('x-ratelimit-remaining'),
              reset: response.headers.get('x-ratelimit-reset')
            },
            data,
            raw: text
          };
        })
        .catch((error) => ({
          ok: false,
          status: 0,
          error: String(error)
        }));
    }

    return undefined;
  });
})();
