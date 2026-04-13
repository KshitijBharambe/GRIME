"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface GuestExpiryWarningModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onClose: () => void;
}

export function GuestExpiryWarningModal({
  isOpen,
  remainingSeconds,
  onClose,
}: GuestExpiryWarningModalProps) {
  const router = useRouter();
  const [displayTime, setDisplayTime] = useState<string>("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    const formatCountdownTime = (seconds: number) => {
      if (seconds <= 0) return "0s";

      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;

      if (minutes > 0) {
        return `${minutes}m ${secs}s`;
      } else {
        return `${secs}s`;
      }
    };

    setDisplayTime(formatCountdownTime(remainingSeconds));

    const interval = setInterval(() => {
      setDisplayTime(formatCountdownTime(remainingSeconds));
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, remainingSeconds]);

  const handleSignIn = () => {
    setIsSigningIn(true);
    router.push("/auth/login");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="sm:max-w-md border-2 border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/20"
        showCloseButton={false}
      >
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <DialogTitle className="text-xl font-semibold text-red-900 dark:text-red-300">
            Guest Session Expiring
          </DialogTitle>
          <DialogDescription className="text-red-800 dark:text-red-400 text-base font-medium mt-2">
            Your guest session expires in {displayTime}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-white dark:bg-slate-900 rounded-md p-4 my-4 border border-red-100 dark:border-red-900/30">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            After your session expires, you will be logged out and need to sign
            in again to continue.
          </p>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-3 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-red-200 hover:bg-red-50 dark:border-red-800/50 dark:hover:bg-red-900/20"
          >
            Continue as Guest
          </Button>
          <Button
            size="sm"
            className={cn(
              "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700",
              isSigningIn && "opacity-75 cursor-not-allowed",
            )}
            onClick={handleSignIn}
            disabled={isSigningIn}
          >
            {isSigningIn ? "Redirecting..." : "Sign In Now"}
          </Button>
        </DialogFooter>

        {/* Live countdown display */}
        <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-red-100 dark:border-red-900/30">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-600 dark:text-red-400 font-mono">
            {displayTime}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
