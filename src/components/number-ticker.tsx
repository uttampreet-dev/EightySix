"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue } from "motion/react";

export function NumberTicker({
  value,
  format,
}: {
  value: number;
  format?: (n: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const mv = useMotionValue(value);

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (ref.current)
          ref.current.textContent = format
            ? format(v)
            : Math.round(v).toString();
      },
    });
    return () => controls.stop();
  }, [value, mv, format]);

  return (
    <span ref={ref} className="tabular-nums">
      {format ? format(value) : value}
    </span>
  );
}
