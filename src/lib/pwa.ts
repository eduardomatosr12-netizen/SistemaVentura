type UpdateListener = (applyUpdate: () => void) => void;

let waitingWorker: ServiceWorker | null = null;
let reloading = false;
let updateRequested = false;
const listeners = new Set<UpdateListener>();

function notify() {
  if (!waitingWorker) return;
  listeners.forEach((fn) => fn(applyUpdate));
}

export function applyUpdate() {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  // Only a user-initiated skipWaiting may trigger the reload below; on a first
  // install the worker also claims clients and fires `controllerchange`, and
  // reloading there would throw the user out of the app they just opened.
  updateRequested = true;
  waitingWorker.postMessage('SKIP_WAITING');
}

export function onUpdateAvailable(listener: UpdateListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Registers the service worker that makes the app installable and offline-capable.
 *
 * Only runs in production builds: caching hashed dev modules would serve stale
 * code and mask HMR.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('[PWA] Falha ao registrar o service worker:', err);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Fires once the new worker takes over after skipWaiting. Reload so the page
    // picks up the new asset URLs; the flag stops any chance of a reload loop.
    if (reloading || !updateRequested) return;
    reloading = true;
    window.location.reload();
  });

  navigator.serviceWorker.addEventListener('updatefound', (event) => {
    // `installing` lives on the registration, not the container.
    const registration = event.target as ServiceWorkerRegistration | null;
    const worker = registration?.installing;
    if (!worker) return;

    worker.addEventListener('statechange', () => {
      // An existing controller means this is an update, not a first install.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        waitingWorker = worker;
        notify();
      }
    });
  });
}
