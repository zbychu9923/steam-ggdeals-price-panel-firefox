(() => {
  const DEFAULT_REGION = 'pl';
  const PANEL_ID = 'ggd-steam-price-panel';
  const PANEL_SELECTOR = '.rightcol.game_meta_data';
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const { SETTINGS_KEY, DEFAULT_LANG, loadLocale, normalizeLanguage, normalizeRegion, resolveLanguageFromSettings, t } = window.GGDI18n;
  const CUSTOM_MESSAGES = window.GGDCustomMessages || {};

  const state = {
    appId: null,
    title: null,
    panel: null,
    mountedFor: null,
    messages: {},
    language: DEFAULT_LANG
  };

  function getAppIdFromLocation() {
    const match = window.location.pathname.match(/\/(?:agecheck\/)?app\/(\d+)/i);
    return match ? match[1] : null;
  }

  function getGameTitle() {
    return (
      document.getElementById('appHubAppName')?.textContent?.trim() ||
      document.querySelector('.apphub_AppName')?.textContent?.trim() ||
      document.querySelector('.pageheader')?.textContent?.trim() ||
      t(state.messages, 'fallbackGameTitle')
    );
  }

  function getGgDealsUrl(appId) {
    return `https://gg.deals/steam/app/${encodeURIComponent(appId)}/`;
  }


  function getCustomMessage(appId) {
    const entry = CUSTOM_MESSAGES?.[String(appId)] ?? null;
    if (!entry) return '';
    if (typeof entry === 'string') return entry;

    const lang = normalizeLanguage(state.language || DEFAULT_LANG);
    const localized = entry?.[lang] ?? entry?.[DEFAULT_LANG] ?? entry?.pl ?? entry?.en ?? '';
    return typeof localized === 'string' ? localized : '';
  }

  function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) {
        resolve(existing);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });

      const timer = window.setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);

      observer.observe(document.documentElement, { childList: true, subtree: true });
    });
  }

  function formatPrice(value, currency) {
    if (value == null || value === '') {
      return t(state.messages, 'noData');
    }

    const number = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(number)) {
      return currency ? `${value} ${currency}` : String(value);
    }

    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currency || 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(number);
    } catch {
      return currency ? `${number.toFixed(2)} ${currency}` : number.toFixed(2);
    }
  }

  function getCacheKey(appId, region) {
    return `ggd-price-cache:${region}:${appId}`;
  }

  async function getSettings() {
    try {
      const store = await browser.storage.local.get(SETTINGS_KEY);
      const settings = store?.[SETTINGS_KEY] || {};
      return {
        apiKey: String(settings.apiKey || '').trim(),
        region: normalizeRegion(settings.region || DEFAULT_REGION),
        language: normalizeLanguage(settings.language || state.language || DEFAULT_LANG),
        showKeyshops: settings.showKeyshops !== false
      };
    } catch {
      return { apiKey: '', region: DEFAULT_REGION, language: state.language || DEFAULT_LANG, showKeyshops: true };
    }
  }

  async function readCache(appId, region) {
    try {
      const key = getCacheKey(appId, region);
      const store = await browser.storage.local.get(key);
      const cached = store[key];
      if (!cached || !cached.timestamp || !cached.payload) return null;
      if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
      return cached.payload;
    } catch {
      return null;
    }
  }

  async function writeCache(appId, region, payload) {
    try {
      const key = getCacheKey(appId, region);
      await browser.storage.local.set({
        [key]: {
          timestamp: Date.now(),
          payload
        }
      });
    } catch {}
  }

  function extractGamePayload(apiResponse, appId) {
    if (!apiResponse) return null;

    const dataRoot = apiResponse.data ?? apiResponse;
    const node = dataRoot?.[appId] ?? dataRoot?.data?.[appId] ?? null;
    if (!node) return null;

    const prices = node.prices ?? node.price ?? node;
    return {
      title: node.title ?? node.name ?? null,
      currency: prices.currency ?? node.currency ?? 'EUR',
      currentRetail: prices.currentRetail ?? prices.current_retail ?? null,
      currentKeyshops: prices.currentKeyshops ?? prices.current_keyshops ?? null,
      historicalRetail: prices.historicalRetail ?? prices.historical_retail ?? null,
      historicalKeyshops: prices.historicalKeyshops ?? prices.historical_keyshops ?? null,
      url: node.url ?? node.gameUrl ?? node.game_url ?? null,
      slug: node.slug ?? null
    };
  }

  function createPanel() {
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.className = 'ggd-panel';
    panel.innerHTML = `
      <div class="ggd-panel__header">
        <div class="ggd-panel__headline-wrap">
          <div class="ggd-panel__eyebrow" data-role="eyebrow"></div>
          <div class="ggd-panel__title" data-role="title"></div>
        </div>
        <span class="ggd-panel__status" data-role="status"></span>
      </div>

      <div class="ggd-panel__body">
        <a class="ggd-price-card" data-role="officialLink" href="#" target="_blank" rel="noopener noreferrer">
          <div class="ggd-price-card__label" data-role="officialLabel"></div>
          <div class="ggd-price-card__value" data-role="official">—</div>
          <div class="ggd-price-card__hint" data-role="officialHint"></div>
        </a>

        <a class="ggd-price-card" data-role="keyshopLink" href="#" target="_blank" rel="noopener noreferrer">
          <div class="ggd-price-card__label" data-role="keyshopLabel"></div>
          <div class="ggd-price-card__value" data-role="keyshop">—</div>
          <div class="ggd-price-card__hint" data-role="keyshopHint"></div>
        </a>
      </div>

      <div class="ggd-panel__note" data-role="note" hidden></div>

      <div class="ggd-panel__footer" data-role="footer" hidden>
        <div class="ggd-panel__custom" data-role="customWrap" hidden>
          <hr>
          <div class="ggd-panel__custom-text" data-role="customText"></div>
        </div>
      </div>
    `;

    return panel;
  }

  function applyStaticTexts(panel) {
    panel.querySelector('[data-role="eyebrow"]').textContent = t(state.messages, 'panelEyebrow');
    panel.querySelector('[data-role="title"]').textContent = t(state.messages, 'panelTitle');
    panel.querySelector('[data-role="officialLabel"]').textContent = t(state.messages, 'officialStores');
    panel.querySelector('[data-role="keyshopLabel"]').textContent = t(state.messages, 'keyshops');
  }

  function setStatus(panel, text, mode = 'normal') {
    const el = panel.querySelector('[data-role="status"]');
    if (!el) return;
    el.textContent = text;
    el.dataset.mode = mode;
  }

  function setCard(panel, role, value, hint) {
    const valueEl = panel.querySelector(`[data-role="${role}"]`);
    const hintEl = panel.querySelector(`[data-role="${role}Hint"]`);
    if (valueEl) valueEl.textContent = value;
    if (hintEl) hintEl.textContent = hint;
  }

  function setLink(panel, role, url, enabled = true) {
    const el = panel.querySelector(`[data-role="${role}"]`);
    if (!el) return;

    el.href = enabled && url ? url : '#';
    el.dataset.disabled = enabled && url ? 'false' : 'true';
    el.setAttribute('aria-disabled', enabled && url ? 'false' : 'true');
    el.tabIndex = enabled && url ? 0 : -1;
  }

  function setNote(panel, text = '', mode = 'info') {
    const el = panel.querySelector('[data-role="note"]');
    if (!el) return;

    if (!text) {
      el.hidden = true;
      el.textContent = '';
      delete el.dataset.mode;
      return;
    }

    el.hidden = false;
    el.textContent = text;
    el.dataset.mode = mode;
  }

  function setKeyshopsVisibility(panel, isVisible) {
    const card = panel.querySelector('[data-role="keyshopLink"]');
    const body = panel.querySelector('.ggd-panel__body');
    if (!card || !body) return;

    card.hidden = !isVisible;
    body.dataset.keyshopsVisible = isVisible ? 'true' : 'false';
  }

  function setCustomMessage(panel, text = '') {
    const footer = panel.querySelector('[data-role="footer"]');
    const wrap = panel.querySelector('[data-role="customWrap"]');
    const textEl = panel.querySelector('[data-role="customText"]');
    if (!footer || !wrap || !textEl) return;

    if (!text) {
      wrap.hidden = true;
      footer.hidden = true;
      textEl.textContent = '';
      return;
    }

    wrap.hidden = false;
    footer.hidden = false;
    textEl.textContent = text;
  }

  async function fetchPrices(appId, apiKey, region) {
    const cached = await readCache(appId, region);
    if (cached) {
      return { payload: cached, fromCache: true, headers: null, status: 200 };
    }

    const url = `https://api.gg.deals/v1/prices/by-steam-app-id/?ids=${encodeURIComponent(appId)}&key=${encodeURIComponent(apiKey)}&region=${encodeURIComponent(region)}`;
    const response = await browser.runtime.sendMessage({ type: 'ggd-fetch-price', url });

    if (!response?.ok) {
      const err = new Error(response?.error || `HTTP ${response?.status || 0}`);
      err.status = response?.status || 0;
      err.headers = response?.headers || null;
      throw err;
    }

    const payload = extractGamePayload(response.data, appId);
    if (payload) await writeCache(appId, region, payload);

    return {
      payload,
      fromCache: false,
      headers: response.headers || null,
      status: response.status
    };
  }

  async function loadMessages() {
    const settings = await getSettings();
    state.language = settings.language || await resolveLanguageFromSettings();
    state.messages = await loadLocale(state.language);
  }

  async function mountPanel() {
    const appId = getAppIdFromLocation();
    if (!appId) return;

    await loadMessages();

    const target = await waitForElement(PANEL_SELECTOR);
    if (!target) return;

    const firstChild = target.firstElementChild;
    let panel = document.getElementById(PANEL_ID);
    if (!panel) panel = createPanel();

    if (!panel.parentElement || panel.parentElement !== target) {
      if (firstChild) target.insertBefore(panel, firstChild);
      else target.appendChild(panel);
    } else if (panel !== firstChild) {
      target.insertBefore(panel, firstChild);
    }

    applyStaticTexts(panel);

    state.panel = panel;
    state.appId = appId;
    state.title = getGameTitle();

    const mountKey = `${window.location.pathname}:${appId}:${state.language}`;
    if (state.mountedFor === mountKey) return;

    state.mountedFor = mountKey;
    const fallbackUrl = getGgDealsUrl(appId);
    setStatus(panel, t(state.messages, 'panelStatusLoading'));
    setCard(panel, 'official', '—', t(state.messages, 'checkingCurrentPrice'));
    setCard(panel, 'keyshop', '—', t(state.messages, 'checkingCurrentPrice'));
    setLink(panel, 'officialLink', fallbackUrl, false);
    setLink(panel, 'keyshopLink', fallbackUrl, false);
    setNote(panel, '');
    setCustomMessage(panel, getCustomMessage(appId));

    const { apiKey, region, showKeyshops } = await getSettings();
    setKeyshopsVisibility(panel, showKeyshops);
    if (!apiKey) {
      setStatus(panel, t(state.messages, 'panelStatusNoData'), 'warn');
      setCard(panel, 'official', '—', t(state.messages, 'noteMissingApiKey'));
      setCard(panel, 'keyshop', '—', t(state.messages, 'noteMissingApiKey'));
      setLink(panel, 'officialLink', fallbackUrl, true);
      setLink(panel, 'keyshopLink', fallbackUrl, true);
      setNote(panel, t(state.messages, 'noteMissingApiKey'), 'info');
      return;
    }

    try {
      const { payload } = await fetchPrices(appId, apiKey, region);
      const targetUrl = payload?.url || (payload?.slug ? `https://gg.deals/game/${payload.slug}/` : fallbackUrl);

      setLink(panel, 'officialLink', targetUrl, true);
      setLink(panel, 'keyshopLink', targetUrl, true);

      if (!payload) {
        setStatus(panel, t(state.messages, 'panelStatusNoData'), 'warn');
        setCard(panel, 'official', t(state.messages, 'noData'), t(state.messages, 'noData'));
        setCard(panel, 'keyshop', t(state.messages, 'noData'), t(state.messages, 'noData'));
        return;
      }

      setCard(
        panel,
        'official',
        formatPrice(payload.currentRetail, payload.currency),
        payload.historicalRetail != null
          ? t(state.messages, 'historicalMinimum', { price: formatPrice(payload.historicalRetail, payload.currency) })
          : t(state.messages, 'noData')
      );

      setCard(
        panel,
        'keyshop',
        formatPrice(payload.currentKeyshops, payload.currency),
        payload.historicalKeyshops != null
          ? t(state.messages, 'historicalMinimum', { price: formatPrice(payload.historicalKeyshops, payload.currency) })
          : t(state.messages, 'noData')
      );

      setStatus(panel, t(state.messages, 'panelStatusCurrent'), 'ok');
    } catch (error) {
      const status = Number(error?.status || 0);
      if (status === 400 || status === 401 || status === 403) {
        setStatus(panel, t(state.messages, 'panelStatusError'), 'error');
        setCard(panel, 'official', '—', t(state.messages, 'noteMissingApiKey'));
        setCard(panel, 'keyshop', '—', t(state.messages, 'noteMissingApiKey'));
        setNote(panel, t(state.messages, 'noteMissingApiKey'), 'error');
      } else if (status === 429) {
        setStatus(panel, t(state.messages, 'panelStatusError'), 'warn');
        setCard(panel, 'official', '—', t(state.messages, 'noteApiLimit'));
        setCard(panel, 'keyshop', '—', t(state.messages, 'noteApiLimit'));
        setNote(panel, t(state.messages, 'noteApiLimit'), 'warn');
      } else {
        setStatus(panel, t(state.messages, 'panelStatusError'), 'error');
        setCard(panel, 'official', '—', t(state.messages, 'noteFailedToFetch'));
        setCard(panel, 'keyshop', '—', t(state.messages, 'noteFailedToFetch'));
      }

      setLink(panel, 'officialLink', fallbackUrl, true);
      setLink(panel, 'keyshopLink', fallbackUrl, true);
      }
  }

  let lastUrl = location.href;
  const navigationObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      window.setTimeout(mountPanel, 250);
    }
  });

  navigationObserver.observe(document.documentElement, { childList: true, subtree: true });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[SETTINGS_KEY]) {
      state.mountedFor = null;
      window.setTimeout(mountPanel, 50);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountPanel, { once: true });
  } else {
    mountPanel();
  }
})();
