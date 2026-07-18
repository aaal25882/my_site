(function () {
  const STORAGE_KEY = "aaal-theme";
  const validModes = new Set(["auto", "light", "dark"]);
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function getMode() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return validModes.has(saved) ? saved : "auto";
  }

  function resolveTheme(mode) {
    return mode === "auto" ? (media.matches ? "dark" : "light") : mode;
  }

  function applyTheme(mode, persist = false) {
    const safeMode = validModes.has(mode) ? mode : "auto";
    const resolved = resolveTheme(safeMode);
    document.documentElement.dataset.themeMode = safeMode;
    document.documentElement.dataset.theme = resolved;
    if (document.body) {
      document.body.dataset.themeMode = safeMode;
      document.body.dataset.theme = resolved;
    }
    if (persist) localStorage.setItem(STORAGE_KEY, safeMode);
    document.querySelectorAll("[data-theme-control]").forEach((control) => {
      control.value = safeMode;
      control.setAttribute("aria-label", `حالت نمایش: ${safeMode}`);
    });
  }

  applyTheme(getMode());

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(getMode());
    document.querySelectorAll("[data-theme-control]").forEach((control) => {
      control.addEventListener("change", (event) => applyTheme(event.target.value, true));
    });
  });

  media.addEventListener?.("change", () => {
    if (getMode() === "auto") applyTheme("auto");
  });

  window.AaalTheme = { applyTheme, getMode };
})();
