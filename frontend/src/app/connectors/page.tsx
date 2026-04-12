"use client";

import { useState } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Cable,
  Database,
  Cloud,
  Sheet,
  Webhook,
  Plus,
  Check,
  X,
  Loader2,
  ChevronRight,
  Plug,
  Settings2,
  Zap,
} from "lucide-react";

interface ConnectorDef {
  id: string;
  name: string;
  category: string;
  icon: React.ElementType;
  status: "available" | "coming_soon";
  description: string;
  fields: string[];
  color: string;
  href?: string;
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: "snowflake",
    name: "Snowflake",
    category: "Data Warehouse",
    icon: Database,
    status: "available",
    description:
      "Connect to Snowflake data warehouse. Query tables and views directly.",
    fields: [
      "Account URL",
      "Username",
      "Password",
      "Database",
      "Warehouse",
      "Schema",
    ],
    color: "#29B5E8",
  },
  {
    id: "mongodb",
    name: "MongoDB",
    category: "Document DB",
    icon: Database,
    status: "available",
    description:
      "Stream documents from MongoDB collections. Supports filters and projections.",
    fields: ["Connection URI", "Database", "Collection"],
    color: "#00ED64",
  },
  {
    id: "google_sheets",
    name: "Google Sheets",
    category: "Spreadsheet",
    icon: Sheet,
    status: "available",
    description:
      "Import data directly from Google Sheets. OAuth2 authentication.",
    fields: ["Spreadsheet URL", "Sheet Name", "Service Account JSON"],
    color: "#34A853",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    category: "SQL Database",
    icon: Database,
    status: "available",
    description: "Connect to any PostgreSQL-compatible database.",
    fields: ["Host", "Port", "Database", "Username", "Password", "SSL Mode"],
    color: "#336791",
  },
  {
    id: "s3",
    name: "Amazon S3",
    category: "Object Storage",
    icon: Cloud,
    status: "available",
    description: "Read CSV/JSON/Parquet files from S3 buckets.",
    fields: [
      "Bucket Name",
      "AWS Access Key",
      "AWS Secret Key",
      "Region",
      "Prefix",
    ],
    color: "#FF9900",
  },
  {
    id: "bigquery",
    name: "BigQuery",
    category: "Data Warehouse",
    icon: Database,
    status: "coming_soon",
    description: "Connect to Google BigQuery datasets and tables.",
    fields: [],
    color: "#4285F4",
  },
  {
    id: "kafka",
    name: "Apache Kafka",
    category: "Streaming",
    icon: Zap,
    status: "coming_soon",
    description: "Stream real-time data from Kafka topics for live validation.",
    fields: [],
    color: "#000000",
  },
  {
    id: "webhook_in",
    name: "HTTP Webhook",
    category: "Webhook",
    icon: Webhook,
    status: "available",
    description: "Receive data payloads via HTTP POST webhooks.",
    fields: [],
    href: "/connectors/webhooks",
    color: "#FF5C00",
  },
];

function StatusBadge({
  isConnected,
  isConnecting,
  isSoon,
}: Readonly<{
  isConnected: boolean;
  isConnecting: boolean;
  isSoon: boolean;
}>) {
  const label = isSoon
    ? "Coming soon"
    : isConnecting
      ? "Connecting"
      : isConnected
        ? "Connected"
        : "Ready";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        isSoon && "border-border bg-muted/40 text-muted-foreground",
        isConnecting && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        isConnected && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
        !isSoon &&
          !isConnecting &&
          !isConnected &&
          "border-border bg-background text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function CardFooterActions({
  connector,
  isConnected,
  isConnecting,
  isConfiguring,
  onConnect,
}: Readonly<{
  connector: ConnectorDef;
  isConnected: boolean;
  isConnecting: boolean;
  isConfiguring: boolean;
  onConnect: () => void;
}>) {
  if (connector.status === "coming_soon") {
    return (
      <span className="inline-flex rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
        Planned
      </span>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          Connection active
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-3"
          onClick={onConnect}
        >
          <Settings2 className="mr-1.5 h-4 w-4" />
          Configure
        </Button>
      </div>
    );
  }

  if (connector.href) {
    return (
      <Link href={connector.href}>
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Manage webhooks
          </span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </Link>
    );
  }

  return (
    <Button
      size="sm"
      variant={isConfiguring ? "outline" : "default"}
      className="h-9 w-full"
      onClick={onConnect}
      disabled={isConnecting}
    >
      {isConnecting && (
        <>
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          Connecting...
        </>
      )}
      {!isConnecting && isConfiguring && (
        <>
          <X className="mr-1.5 h-4 w-4" />
          Cancel
        </>
      )}
      {!isConnecting && !isConfiguring && (
        <>
          <Plus className="mr-1.5 h-4 w-4" />
          Connect
        </>
      )}
    </Button>
  );
}

function ConnectorCard({
  connector,
  isConnected,
  isConnecting,
  isConfiguring,
  onConnect,
  onCancelConfig,
  onSave,
}: Readonly<{
  connector: ConnectorDef;
  isConnected: boolean;
  isConnecting: boolean;
  isConfiguring: boolean;
  onConnect: () => void;
  onCancelConfig: () => void;
  onSave: () => void;
}>) {
  const Icon = connector.icon;
  const isSoon = connector.status === "coming_soon";

  return (
    <div
      className={cn(
        "flex h-full flex-col rounded-xl border border-border bg-card shadow-sm transition-shadow",
        isConfiguring && "ring-2 ring-primary/15",
        isSoon && "opacity-70",
      )}
    >
      <div className="flex h-full flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
              style={{
                background: `color-mix(in srgb, ${connector.color} 12%, var(--card))`,
                borderColor: `color-mix(in srgb, ${connector.color} 28%, var(--border))`,
              }}
            >
              <Icon className="h-5 w-5" style={{ color: connector.color }} />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">
                {connector.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {connector.category}
              </p>
            </div>
          </div>

          <StatusBadge
            isConnected={isConnected}
            isConnecting={isConnecting}
            isSoon={isSoon}
          />
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {connector.description}
        </p>

        {isConfiguring && !isSoon && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-foreground">
                Connection settings
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter credentials to complete the connection.
              </p>
            </div>

            <div className="space-y-3">
              {connector.fields.map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {field}
                  </Label>
                  <Input
                    type={
                      field.toLowerCase().includes("password") ||
                      field.toLowerCase().includes("secret") ||
                      field.toLowerCase().includes("key")
                        ? "password"
                        : "text"
                    }
                    placeholder={field}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <Button size="sm" className="h-9 px-4" onClick={onSave}>
                <Check className="mr-1.5 h-4 w-4" />
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-4"
                onClick={onCancelConfig}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="mt-auto border-t border-border pt-4">
          <CardFooterActions
            connector={connector}
            isConnected={isConnected}
            isConnecting={isConnecting}
            isConfiguring={isConfiguring}
            onConnect={onConnect}
          />
        </div>
      </div>
    </div>
  );
}

export default function ConnectorsPage() {
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<string[]>([]);
  const [configuring, setConfiguring] = useState<string | null>(null);

  const availableCount = CONNECTORS.filter(
    (connector) => connector.status === "available",
  ).length;

  function handleConnect(id: string) {
    if (configuring === id) {
      setConfiguring(null);
      return;
    }

    setConfiguring(id);
  }

  function handleCancelConfig() {
    setConfiguring(null);
  }

  function handleSave(id: string) {
    setConfiguring(null);
    setConnecting(id);
    setTimeout(() => {
      setConnecting(null);
      setConnected((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }, 1400);
  }

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/30">
                  <Cable className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Connectors
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    Data sources
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Connect external data sources for validation, ingestion, and
                ongoing quality checks. Each connector keeps status and actions
                visible without adding extra UI noise.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Connected
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {connected.length}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Available
                </p>
                <p className="mt-2 text-2xl font-semibold text-foreground">
                  {availableCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Available integrations
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose a source, enter credentials, and save when ready.
              </p>
            </div>
            <span className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {connected.length} of {availableCount} connected
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CONNECTORS.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                isConnected={connected.includes(connector.id)}
                isConnecting={connecting === connector.id}
                isConfiguring={configuring === connector.id}
                onConnect={() => handleConnect(connector.id)}
                onCancelConfig={handleCancelConfig}
                onSave={() => handleSave(connector.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
