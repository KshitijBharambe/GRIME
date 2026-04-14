"use client";

import { useEffect, useState } from "react";
import { Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuestModeIndicatorProps {
  remainingMs: number;
  isExpiresSoon: boolean;
}

export function GuestModeIndicator({
  remainingMs,
  isExpiresSoon,
}: GuestModeIndicatorProps) {
  const [displayTime, setDisplayTime] = useState<string>("");

  useEffect(() => {
    const formatTime = (ms: number) => {
      if (ms <= 0) return "";

      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      } else {
        return `${seconds}s`;
      }
    };

    setDisplayTime(formatTime(remainingMs));

    const interval = setInterval(() => {
      setDisplayTime(formatTime(remainingMs));
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [remainingMs]);

  if (remainingMs <= 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
        isExpiresSoon
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      )}
    >
      {isExpiresSoon ? (
        <>
          <AlertCircle className="h-4 w-4" />
          <span className="font-semibold">Guest Mode - {displayTime} ⚠️</span>
        </>
      ) : (
        <>
          <Clock className="h-4 w-4" />
          <span>🕐 Guest Mode - {displayTime}</span>
        </>
      )}
    </div>
  );
}
