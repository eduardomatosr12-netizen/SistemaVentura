import { useEffect, useRef, useState } from 'react';

/**
 * Eases a number up to `target` on mount, then snaps to any later change.
 * Lives outside `components/charts.tsx` so that file only exports components.
 */
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(() => target);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) {
      setValue(target);
      return;
    }
    startedRef.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
