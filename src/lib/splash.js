const SPLASH_SESSION_KEY = "geshtenja-splash-seen";
const MIN_SPLASH_MS = 1800;
const FADE_MS = 650;

export function hasSeenSplash() {
  try {
    return sessionStorage.getItem(SPLASH_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function markSplashSeen() {
  try {
    sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
  } catch {
    /* private browsing */
  }
}

function dismissSplash() {
  const splash = document.getElementById("splash");
  if (!splash || splash.classList.contains("is-dismissed")) return Promise.resolve();

  return new Promise((resolve) => {
    splash.classList.add("is-dismissed");
    document.body.classList.remove("splash-active");

    const finish = () => {
      splash.remove();
      resolve();
    };

    splash.addEventListener("transitionend", finish, { once: true });
    setTimeout(finish, FADE_MS + 80);
  });
}

/**
 * Shows the splash until `readyPromise` settles and a minimum display time passes.
 * Skips on repeat visits in the same browser session.
 *
 * @param {Promise<unknown>} readyPromise
 */
export async function runSplashUntilReady(readyPromise) {
  const splash = document.getElementById("splash");
  if (!splash || hasSeenSplash()) {
    splash?.remove();
    document.body.classList.remove("splash-active");
    await readyPromise;
    return;
  }

  document.body.classList.add("splash-active");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    splash.classList.add("is-lit");
  } else {
    requestAnimationFrame(() => splash.classList.add("is-lit"));
  }

  const minWait = reducedMotion ? 400 : MIN_SPLASH_MS;
  const start = performance.now();

  await readyPromise;

  const remaining = minWait - (performance.now() - start);
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }

  markSplashSeen();
  await dismissSplash();
}
