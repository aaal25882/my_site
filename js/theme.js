(function () {
  const STORAGE_KEY = "aaal-theme";
  const validModes = new Set(["auto", "light", "dark"]);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const labels = { auto: "خودکار", light: "روشن", dark: "تیره" };
  const icons = { auto: "◐", light: "☀", dark: "☾" };

  function getMode() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return validModes.has(saved) ? saved : "auto";
  }

  function resolveTheme(mode) {
    return mode === "auto" ? (media.matches ? "dark" : "light") : mode;
  }

  function closeAllPickers(except = null) {
    document.querySelectorAll('.theme-picker.is-open').forEach((picker) => {
      if (picker !== except) picker.classList.remove('is-open');
      const toggle = picker.querySelector('.theme-dropdown-toggle');
      if (toggle && picker !== except) toggle.setAttribute('aria-expanded', 'false');
    });
  }

  function buildCustomPicker(control) {
    const picker = control.closest('.theme-picker');
    if (!picker || picker.dataset.enhanced === 'true') return;
    picker.dataset.enhanced = 'true';
    control.classList.add('theme-native-select');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'theme-dropdown-toggle ui-control';
    toggle.setAttribute('aria-haspopup', 'listbox');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = `
      <span class="theme-dropdown-value">خودکار</span>
      <span class="theme-dropdown-chevron" aria-hidden="true">⌄</span>
    `;

    const menu = document.createElement('div');
    menu.className = 'theme-dropdown-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'انتخاب تم');

    [
      { value: 'auto', description: 'هماهنگ با تنظیمات سیستم' },
      { value: 'light', description: 'حالت روشن و شفاف' },
      { value: 'dark', description: 'حالت تیره و کم‌نور' },
    ].forEach((item) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'theme-option';
      option.dataset.value = item.value;
      option.setAttribute('role', 'option');
      option.innerHTML = `
        <span class="theme-option-main">
          <span class="theme-option-icon" aria-hidden="true">${icons[item.value]}</span>
          <span class="theme-option-copy">
            <strong>${labels[item.value]}</strong>
            <small>${item.description}</small>
          </span>
        </span>
        <span class="theme-option-check" aria-hidden="true">✓</span>
      `;
      option.addEventListener('click', () => {
        applyTheme(item.value, true);
        picker.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
      menu.appendChild(option);
    });

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      const willOpen = !picker.classList.contains('is-open');
      closeAllPickers(willOpen ? picker : null);
      picker.classList.toggle('is-open', willOpen);
      toggle.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    toggle.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeAllPickers(picker);
        picker.classList.add('is-open');
        toggle.setAttribute('aria-expanded', 'true');
        menu.querySelector('.theme-option.is-active')?.focus();
      }
    });

    picker.append(toggle, menu);
  }

  function syncControls(mode, resolved) {
    document.querySelectorAll('[data-theme-control]').forEach((control) => {
      control.value = mode;
      control.setAttribute('aria-label', `حالت نمایش: ${labels[mode]}`);
      control.setAttribute('title', `حالت ${labels[mode]}؛ تم فعلی ${labels[resolved]}`);
      const picker = control.closest('.theme-picker');
      if (!picker) return;
      picker.dataset.mode = mode;
      picker.dataset.resolvedTheme = resolved;
      picker.setAttribute('title', `حالت نمایش: ${labels[mode]}`);
      const icon = picker.querySelector('.theme-picker-icon');
      if (icon) {
        icon.textContent = icons[mode];
        icon.setAttribute('aria-hidden', 'true');
      }
      const valueNode = picker.querySelector('.theme-dropdown-value');
      if (valueNode) valueNode.textContent = labels[mode];
      picker.querySelectorAll('.theme-option').forEach((option) => {
        const isActive = option.dataset.value === mode;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    });
  }

  function applyTheme(mode, persist = false) {
    const safeMode = validModes.has(mode) ? mode : 'auto';
    const resolved = resolveTheme(safeMode);
    document.documentElement.dataset.themeMode = safeMode;
    document.documentElement.dataset.theme = resolved;
    if (document.body) {
      document.body.dataset.themeMode = safeMode;
      document.body.dataset.theme = resolved;
    }
    if (persist) localStorage.setItem(STORAGE_KEY, safeMode);
    syncControls(safeMode, resolved);
    document.dispatchEvent(new CustomEvent('aaal:themechange', { detail: { mode: safeMode, resolved } }));
  }

  applyTheme(getMode());

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-theme-control]').forEach((control) => buildCustomPicker(control));
    applyTheme(getMode());

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.theme-picker')) closeAllPickers();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeAllPickers();
    });
  });

  media.addEventListener?.('change', () => {
    if (getMode() === 'auto') applyTheme('auto');
  });

  window.AaalTheme = { applyTheme, getMode };
})();
