export const THEME_STORAGE_KEY = 'ht_timeline_theme';

/**
 * Inlined in <head> so the first paint uses the saved theme (no flash).
 * Keep in sync with resolveTheme() in contexts/ThemeContext.tsx.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'dark';var t=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
