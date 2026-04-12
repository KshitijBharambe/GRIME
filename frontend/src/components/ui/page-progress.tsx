"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function PageProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasMountedRef = useRef(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Skip initial mount to avoid a flash on first paint.
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    setIsNavigating(true);
    setProgress(10);

    const t1 = setTimeout(() => setProgress(60), 100);
    const t2 = setTimeout(() => setProgress(80), 300);
    const t3 = setTimeout(() => {
      setProgress(100);
      const t4 = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 200);

      return () => clearTimeout(t4);
    }, 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pathname, searchParams]);

  if (!isNavigating) return null;

  return (
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-[3px] bg-transparent">
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
