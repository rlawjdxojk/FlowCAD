import { useEffect, useRef, useState } from "react";

/** 숫자가 바뀔 때 0.42초 동안 부드럽게 올라가는 표시값. 출처: 데모 FlowCADDemo.jsx:24-34 */
export function useCountUp(target: number): number {
  const [v, setV] = useState(target);
  const raf = useRef<number>(0);
  const current = useRef(target);
  current.current = v;

  useEffect(() => {
    const from = current.current;
    const to = target;
    const t0 = performance.now();
    const dur = 420;
    cancelAnimationFrame(raf.current);
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(from + (to - from) * e);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return v;
}
