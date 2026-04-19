"use client";

import { useState } from "react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Cable,
  Database,
  Cloud,
  Sheet,
  Webhook,
  Plus,
  Check,
  Loader2,
  ChevronRight,
  Plug,
  Settings2,
  Zap,
  RefreshCw,
  Eye,
  FlaskConical,
} from "lucide-react";
import {
  useDataSources,
  useCreateDataSource,
  useTestDataSourceConnection,
  useSyncDataSourceCatalog,
} from "@/lib/hooks/useDataSources";
import { DataSource, DataSourceType } from "@/types/api";

interface ConnectorDef {
  id: string;
  sourceType: DataSourceType | null; // null = coming soon / no backend type yet
  name: string;
  category: string;
  icon: React.ElementType;
  status: "available" | "coming_soon";
  description: string;
  fields: { key: string; label: string; type?: string }[];
  color: string;
  href?: string;
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: "local_simulator",
    sourceType: "local_simulator",
    name: "Local Simulator",
    category: "Development",
    icon: FlaskConical,
    status: "available",
    description:
      "Built-in sample data (customers, orders, products). No credentials needed — perfect for testing rule execution.",
    fields: [],
    color: "#7C3AED",
  },
  {
    id: "postgresql",
    sourceType: "postgresql",
    name: "PostgreSQL",
    category: "SQL Database",
    icon: Database,
    status: "available",
    description: "Connect to any PostgreSQL-compatible database.",
    fields: [
      { key: "host", label: "Host" },
      { key: "port", label: "Port" },
      { key: "database", label: "Database" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", type: "password" },
    ],
    color: "#336791",
  },
  {
    id: "snowflake",
    sourceType: "snowflake",
    name: "Snowflake",
    category: "Data Warehouse",
    icon: Database,
    status: "available",
    description:
      "Connect to Snowflake data warehouse. Query tables and views directly.",
    fields: [
      { key: "account", label: "Account URL" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", type: "password" },
      { key: "database", label: "Database" },
      { key: "warehouse", label: "Warehouse" },
      { key: "schema", label: "Schema" },
    ],
    color: "#29B5E8",
  },
  {
    id: "mysql",
    sourceType: "mysql",
    name: "MySQL",
    category: "SQL Database",
    icon: Database,
    status: "available",
    description: "Connect to MySQL or MariaDB databases.",
    fields: [
      { key: "host", label: "Host" },
      { key: "port", label: "Port" },
      { key: "database", label: "Database" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", type: "password" },
    ],
    color: "#00758F",
  },
  {
    id: "s3_csv",
    sourceType: "s3_csv",
    name: "Amazon S3",
    category: "Object Storage",
    icon: Cloud,
    status: "available",
    description: "Read CSV/JSON/Parquet files from S3 buckets.",
    fields: [
      { key: "bucket", label: "Bucket Name" },
      { key: "aws_access_key", label: "AWS Access Key" },
      { key: "aws_secret_key", label: "AWS Secret Key", type: "password" },
      { key: "region", label: "Region" },
      { key: "prefix", label: "Prefix" },
    ],
    color: "#FF9900",
  },
  {
    id: "google_sheets",
    sourceType: null,
    name: "Google Sheets",
    category: "Spreadsheet",
    icon: Sheet,
    status: "coming_soon",
    description:
      "Import data directly from Google Sheets. OAuth2 authentication.",
    fields: [],
    color: "#34A853",
  },
  {
    id: "bigquery",
    sourceType: null,
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
    sourceType: null,
    name: "Apache Kafka",
    category: "Streaming",
    icon: Zap,
    status: "coming_soon",
    description:
      "Stream real-time data from Kafka topics for live validation.",
    fields: [],
    color: "#000000",
  },
  {
    id: "webhook_in",
    sourceType: null,
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
  connectionCount,
}: Readonly<{
  isConnected: boolean;
  isConnecting: boolean;
  isSoon: boolean;
  connectionCount: number;
}>) {
  const label = isSoon
    ? "Coming soon"
    : isConnecting
      ? "Connecting"
      : connectionCount > 1
        ? `${connectionCount} connected`
        : isConnected
          ? "Connected"
          : "Ready";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        isSoon && "border-border bg-muted/40 text-muted-foreground",
        isConnecting &&
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
        isConnected &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
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

function ConnectedSourceRow({
  source,
}: Readonly<{ source: DataSource }>) {
  const testMutation = useTestDataSourceConnection();
  const syncMutation = useSyncDataSourceCatalog();
  const [testMsg, setTestMsg] = useState<string | null>(null);

  async function handleTest() {
    const r = await testMutation.mutateAsync(source.id);
    setTestMsg(r.success ? `OK (${r.latency_ms?.toFixed(0)}ms)` : r.message);
    setTimeout(() => setTestMsg(null), 4000);
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      <span className="min-w-0 flex-1 truncate font-medium text-foreground">
        {source.name}
      </span>
      {testMsg && (
        <span className="text-xs text-muted-foreground">{testMsg}</span>
      )}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={handleTest}
          disabled={testMutation.isPending}
        >
          {testMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Zap className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => syncMutation.mutate(source.id)}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" asChild>
          <Link href={`/data-sources/${source.id}`}>
            <Eye className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function ConnectorCard({
  connector,
  connectedSources,
}: Readonly<{
  connector: ConnectorDef;
  connectedSources: DataSource[];
}>) {
  const createMutation = useCreateDataSource();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [params, setParams] = useState<Record<string, string>>({});

  const isSoon = connector.status === "coming_soon";
  const isConnected = connectedSources.length > 0;
  const Icon = connector.icon;

  async function handleSave() {
    await createMutation.mutateAsync({
      name: name || connector.name,
      source_type: connector.sourceType!,
      connection_params: params,
    });
    setDialogOpen(false);
    setName("");
    setParams({});
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setName("");
      setParams({});
    }
    setDialogOpen(open);
  }

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  background: `color-mix(in srgb, ${connector.color} 12%, var(--card))`,
                  borderColor: `color-mix(in srgb, ${connector.color} 28%, var(--border))`,
                }}
              >
                <Icon className="h-4 w-4" style={{ color: connector.color }} />
              </div>
              <DialogTitle>Connect {connector.name}</DialogTitle>
            </div>
            <DialogDescription>
              Enter credentials to add a new {connector.name} connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Connection name
              </Label>
              <Input
                placeholder={connector.name}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            {connector.fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {f.label}
                </Label>
                <Input
                  type={f.type ?? "text"}
                  placeholder={f.label}
                  value={params[f.key] ?? ""}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, [f.key]: e.target.value }))
                  }
                  className="h-9 text-sm"
                />
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-1.5 h-4 w-4" />
              )}
              Save connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div
        className={cn(
          "flex h-full flex-col rounded-xl border border-border bg-card shadow-sm transition-shadow",
          isSoon && "opacity-70",
        )}
      >
        <div className="flex h-full flex-col gap-4 p-5">
          {/* Header */}
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
              isConnecting={createMutation.isPending}
              isSoon={isSoon}
              connectionCount={connectedSources.length}
            />
          </div>

          {/* Description */}
          <p className="text-sm leading-6 text-muted-foreground">
            {connector.description}
          </p>

          {/* Connected instances */}
          {connectedSources.length > 0 && (
            <div className="space-y-1.5">
              {connectedSources.map((s) => (
                <ConnectedSourceRow key={s.id} source={s} />
              ))}
            </div>
          )}

          {/* Footer actions */}
          <div className="mt-auto border-t border-border pt-4">
            {isSoon ? (
              <span className="inline-flex rounded-full border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                Planned
              </span>
            ) : connector.href ? (
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
            ) : isConnected ? (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Connection active
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={() => setDialogOpen(true)}
                >
                  <Settings2 className="mr-1.5 h-4 w-4" />
                  Add another
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-9 w-full"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Connect
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function DataSourcesPage() {
  const { data: sources = [], isLoading } = useDataSources();

  const availableCount = CONNECTORS.filter(
    (c) => c.status === "available" && c.sourceType !== null,
  ).length;

  const connectedCount = sources.length;

  function getSourcesForConnector(connector: ConnectorDef): DataSource[] {
    if (!connector.sourceType) return [];
    return sources.filter((s) => s.source_type === connector.sourceType);
  }

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {/* Hero section */}
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
                  {isLoading ? "—" : connectedCount}
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

        {/* Grid */}
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
              {connectedCount} of {availableCount} connected
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CONNECTORS.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                connectedSources={getSourcesForConnector(connector)}
              />
            ))}
          </div>
        </section>
      </div>
    </MainLayout>
  );
}
