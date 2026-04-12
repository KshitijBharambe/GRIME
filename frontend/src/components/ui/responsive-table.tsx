import { cn } from "@/lib/utils";

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
  minWidth?: string;
}

export function ResponsiveTable({
  children,
  className,
  minWidth = "640px",
}: ResponsiveTableProps) {
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}
