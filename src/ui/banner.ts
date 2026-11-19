const ENTER_MS = 300;
const HOLD_MS = 1_600;
const EXIT_MS = 420;

let clearBanner = () => {};

/** Big area title shown when entering a map, then fading away. `subtitle` is optional flavour text. */
export function showAreaBanner(name: string, subtitle?: string): void {
  clearBanner();
  const banner = document.createElement('section');
  banner.id = 'area-banner';
  banner.className = 'area-banner';
  banner.setAttribute('aria-hidden', 'true');

  const ruleBefore = document.createElement('i');
  const title = document.createElement('strong');
  const ruleAfter = document.createElement('i');
  title.textContent = name;
  banner.append(ruleBefore, title, ruleAfter);
  if (subtitle) {
    const detail = document.createElement('span');
    detail.textContent = subtitle;
    banner.append(detail);
  }

  (document.getElementById('app') ?? document.body).append(banner);
  const leaveTimer = window.setTimeout(() => banner.classList.add('is-leaving'), ENTER_MS + HOLD_MS);
  const removeTimer = window.setTimeout(() => banner.remove(), ENTER_MS + HOLD_MS + EXIT_MS);
  clearBanner = () => {
    window.clearTimeout(leaveTimer);
    window.clearTimeout(removeTimer);
    banner.remove();
    clearBanner = () => {};
  };
}
