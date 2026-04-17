(() => {
  const {
    SETTINGS_KEY,
    DEFAULT_LANG,
    SUPPORTED_LANGS,
    REGION_OPTIONS,
    loadLocale,
    normalizeLanguage,
    resolveLanguageFromSettings,
    normalizeRegion,
    t
  } = window.GGDI18n;

  const form = document.getElementById('settings-form');
  const apiKeyInput = document.getElementById('apiKey');
  const regionInput = document.getElementById('region');
  const languageInput = document.getElementById('language');
  const clearButton = document.getElementById('clear-btn');
  const showKeyshopsInput = document.getElementById('showKeyshops');
  const statusEl = document.getElementById('status');
  const thanksEl = document.getElementById('developer-thanks');

  let thanksTimer = null;

  let messages = {};
  let currentLanguage = DEFAULT_LANG;
  let previousShowKeyshops = true;

  function setStatus(text, mode = 'ok') {
    statusEl.hidden = !text;
    statusEl.textContent = text || '';
    statusEl.dataset.mode = mode;
  }

  function hideThanksMessage() {
    if (thanksTimer) {
      clearTimeout(thanksTimer);
      thanksTimer = null;
    }
    thanksEl.classList.remove('is-visible');
  }

  function showThanksMessage() {
    thanksEl.textContent = t(messages, 'developersThanks');
    thanksEl.classList.add('is-visible');
    if (thanksTimer) {
      clearTimeout(thanksTimer);
    }
    thanksTimer = setTimeout(() => {
      thanksEl.classList.remove('is-visible');
      thanksTimer = null;
    }, 5000);
  }

  function renderRegionOptions() {
    const currentValue = regionInput.value;
    regionInput.innerHTML = '';

    for (const option of REGION_OPTIONS) {
      const el = document.createElement('option');
      el.value = option.value;
      el.textContent = `${option.currency} — ${t(messages, option.key)}`;
      regionInput.appendChild(el);
    }

    regionInput.value = normalizeRegion(currentValue || 'pl');
  }

  function applyTranslations() {
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(messages, el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(messages, el.dataset.i18nPlaceholder);
    });
    renderRegionOptions();
  }

  async function setLanguage(lang) {
    currentLanguage = normalizeLanguage(lang);
    messages = await loadLocale(currentLanguage);
    applyTranslations();
  }

  async function loadSettings() {
    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result?.[SETTINGS_KEY] || {};
      apiKeyInput.value = settings.apiKey || '';
      regionInput.value = normalizeRegion(settings.region || 'pl');
      languageInput.value = normalizeLanguage(settings.language || currentLanguage);
      showKeyshopsInput.checked = settings.showKeyshops !== false;
      previousShowKeyshops = showKeyshopsInput.checked;
      hideThanksMessage();
    } catch {
      setStatus(t(messages, 'statusLoadError'), 'error');
    }
  }

  async function saveSettings(apiKey, region, language, showKeyshops) {
    await browser.storage.local.set({
      [SETTINGS_KEY]: {
        apiKey,
        region,
        language,
        showKeyshops
      }
    });
  }

  languageInput.addEventListener('change', async () => {
    const nextLanguage = normalizeLanguage(languageInput.value);
    await setLanguage(nextLanguage);
    setStatus('');
    if (thanksEl.classList.contains('is-visible')) {
      thanksEl.textContent = t(messages, 'developersThanks');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    const region = normalizeRegion(regionInput.value);
    const language = normalizeLanguage(languageInput.value);
    const showKeyshops = showKeyshopsInput.checked;

    try {
      await saveSettings(apiKey, region, language, showKeyshops);
      setStatus(t(messages, 'statusSaved'), 'ok');
      const shouldShowThanks = previousShowKeyshops && !showKeyshops;
      previousShowKeyshops = showKeyshops;
      if (shouldShowThanks) {
        showThanksMessage();
      } else {
        hideThanksMessage();
      }
    } catch {
      setStatus(t(messages, 'statusSaveError'), 'error');
    }
  });

  clearButton.addEventListener('click', async () => {
    apiKeyInput.value = '';
    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result?.[SETTINGS_KEY] || {};
      const currentShowKeyshops = settings.showKeyshops !== false;
      await saveSettings('', normalizeRegion(settings.region || 'pl'), normalizeLanguage(settings.language || currentLanguage), currentShowKeyshops);
      previousShowKeyshops = currentShowKeyshops;
      hideThanksMessage();
      setStatus(t(messages, 'statusCleared'), 'ok');
    } catch {
      setStatus(t(messages, 'statusClearError'), 'error');
    }
  });

  (async () => {
    const initialLanguage = await resolveLanguageFromSettings();
    if (!SUPPORTED_LANGS.includes(initialLanguage)) {
      currentLanguage = DEFAULT_LANG;
    }
    await setLanguage(initialLanguage);
    await loadSettings();
  })();
})();
