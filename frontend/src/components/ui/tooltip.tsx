"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/lib/utils";

function TooltipProvider(
  props: Readonly<React.ComponentProps<typeof TooltipPrimitive.Provider>>,
) {
  const { delayDuration = 200, ...providerProps } = props;

  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...providerProps}
    />
  );
}

function Tooltip(
  props: Readonly<React.ComponentProps<typeof TooltipPrimitive.Root>>,
) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />;
}

function TooltipTrigger(
  props: Readonly<React.ComponentProps<typeof TooltipPrimitive.Trigger>>,
) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

function TooltipContent(
  props: Readonly<React.ComponentProps<typeof TooltipPrimitive.Content>>,
) {
  const { className, sideOffset = 8, ...contentProps } = props;

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-50 max-w-xs origin-(--radix-tooltip-content-transform-origin) overflow-hidden rounded-md border px-3 py-1.5 text-xs shadow-md",
          className,
        )}
        {...contentProps}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
