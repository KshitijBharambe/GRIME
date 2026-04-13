"use client";

import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Clock, X } from "lucide-react";
import { useState } from "react";

export function GuestBanner() {
  const { data: session } = useSession();
  const [dismissed, setDismissed] = useState(false);

  if (
    !session?.user?.accountType ||
    session.user.accountType !== "guest" ||
    dismissed
  ) {
    return null;
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 text-amber-800 text-sm">
        <Clock className="h-4 w-4" />
        <span>Guest sandbox — your data expires after 1 hour.</span>
        <Link href="/auth/register">
          <Button
            variant="outline"
            size="sm"
            className="ml-2 border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            Sign up free
          </Button>
        </Link>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
