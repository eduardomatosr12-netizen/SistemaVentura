import { useEffect } from 'react';

/**
 * The app shell is `h-dvh overflow-y-hidden`, so the window itself never
 * scrolls: the real scroller is the `<main>` element rendered by MainLayout.
 * Locking only `document.body` therefore does nothing on touch devices.
 * We lock every scrollable ancestor we can find instead.
 *
 * `position: fixed` on body is deliberately not used: body is already sized to
 * 100dvh, so fixing it removes it from flow without preserving any scroll
 * offset, and `window.scrollY` is always 0 in this shell.
 */
function getScrollTargets(): HTMLElement[] {
  const targets = new Set<HTMLElement>([document.body]);
  const main = document.querySelector<HTMLElement>('main');
  if (main) targets.add(main);
  return [...targets];
}

export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    const targets = getScrollTargets();
    const saved = targets.map((el) => ({ el, overflow: el.style.overflow }));

    for (const el of targets) {
      el.style.overflow = 'hidden';
    }

    return () => {
      for (const { el, overflow } of saved) {
        el.style.overflow = overflow;
      }
    };
  }, [isLocked]);
}
