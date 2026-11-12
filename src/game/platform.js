/**
 * Runtime surface for packaging differences.
 * Browser SPA → 'web'. Future native shells may set window.__FEICAI_PLATFORM__
 * to 'app' | 'steam' (or pass via build define) without changing web behavior.
 */
export function getPlatform() {
  if (typeof window !== 'undefined' && window.__FEICAI_PLATFORM__) {
    return String(window.__FEICAI_PLATFORM__);
  }
  return 'web';
}

/**
 * Whether dismissing the welcome / first-run guide should survive reload.
 * - web: every page load / refresh shows the guide again (session-only dismiss).
 * - app / steam (future): once-per-install or per-session can persist without conflicting.
 */
export function persistFirstRunGuideDismiss() {
  return getPlatform() !== 'web';
}
