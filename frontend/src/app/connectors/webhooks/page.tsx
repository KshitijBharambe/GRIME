"use client";

import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Webhook,
  Plus,
  Copy,
  Trash2,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  Clock,
  Activity,
} from "lucide-react";

interface WebhookConfig {
  id: string;
  name: string;
  endpoint: string;
  secret: string;
  status: "active" | "inactive";
  events_received: number;
  last_ping: string | null;
  created_at: string;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatPing(iso: string | null): string {
  if (!iso) return "Never";

  const date = new Date(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const INITIAL_WEBHOOKS: WebhookConfig[] = [
  {
    id: "wh_a1b2c3d4",
    name: "LLM Output Validator",
    endpoint: "https://api.dataforge.io/ingest/wh_a1b2c3d4",
    secret: "whs_9f8e7d6c5b4a3210fedcba9876543210",
    status: "active",
    events_received: 1247,
    last_ping: "2026-04-11T10:42:00Z",
    created_at: "2026-03-15T08:00:00Z",
  },
  {
    id: "wh_e5f6g7h8",
    name: "Annotation Pipeline",
    endpoint: "https://api.dataforge.io/ingest/wh_e5f6g7h8",
    secret: "whs_1234567890abcdef1234567890abcdef",
    status: "inactive",
    events_received: 89,
    last_ping: "2026-04-02T14:17:00Z",
    created_at: "2026-04-01T12:00:00Z",
  },
];

function WebhookStatusBadge({ isActive }: Readonly<{ isActive: boolean }>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}

function WebhookCard({
  wh,
  showSecret,
  copied,
  onToggleSecret,
  onCopy,
  onToggleStatus,
  onRegenSecret,
  onDelete,
}: Readonly<{
  wh: WebhookConfig;
  showSecret: boolean;
  copied: string | null;
  onToggleSecret: () => void;
  onCopy: (text: string, key: string) => void;
  onToggleStatus: () => void;
  onRegenSecret: () => void;
  onDelete: () => void;
}>) {
  const isActive = wh.status === "active";

  return (
    <article className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-base font-semibold text-foreground">
              {wh.name}
            </h3>
            <WebhookStatusBadge isActive={isActive} />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-4 w-4" />
              {wh.events_received.toLocaleString()} events
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              Last ping {formatPing(wh.last_ping)}
            </span>
            <span>
              Created{" "}
              {new Date(wh.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3"
            onClick={onRegenSecret}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Regenerate secret
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3"
            onClick={onToggleStatus}
          >
            {isActive ? "Deactivate" : "Activate"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-3 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Endpoint URL
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this URL as the POST target for incoming payloads.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 shrink-0 p-0"
              onClick={() => onCopy(wh.endpoint, `ep-${wh.id}`)}
              title="Copy endpoint"
            >
              {copied === `ep-${wh.id}` ? (
                <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <code className="mt-3 block break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
            {wh.endpoint}
          </code>
        </section>

        <section className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Shield className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Signing secret
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Include this value in the X-Webhook-Secret header.
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={onToggleSecret}
                title={showSecret ? "Hide secret" : "Reveal secret"}
              >
                {showSecret ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0"
                onClick={() => onCopy(wh.secret, `sec-${wh.id}`)}
                title="Copy secret"
              >
                {copied === `sec-${wh.id}` ? (
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <code className="mt-3 block break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
            {showSecret
              ? wh.secret
              : "*".repeat(Math.min(wh.secret.length, 32))}
          </code>
        </section>
      </div>
    </article>
  );
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>(INITIAL_WEBHOOKS);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newWebhookName, setNewWebhookName] = useState("");

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  function handleToggleSecret(id: string) {
    setShowSecret((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleToggleStatus(id: string) {
    setWebhooks((prev) =>
      prev.map((webhook) =>
        webhook.id === id
          ? {
              ...webhook,
              status: webhook.status === "active" ? "inactive" : "active",
            }
          : webhook,
      ),
    );
  }

  function handleRegenSecret(id: string) {
    const newSecret = `whs_${randomId("")}${randomId("")}`;
    setWebhooks((prev) =>
      prev.map((webhook) =>
        webhook.id === id ? { ...webhook, secret: newSecret } : webhook,
      ),
    );
  }

  function handleDelete(id: string) {
    setWebhooks((prev) => prev.filter((webhook) => webhook.id !== id));
  }

  function handleCreate() {
    if (!newWebhookName.trim()) return;

    const id = randomId("wh");
    const newWebhook: WebhookConfig = {
      id,
      name: newWebhookName.trim(),
      endpoint: `https://api.dataforge.io/ingest/${id}`,
      secret: `whs_${randomId("")}${randomId("")}`,
      status: "active",
      events_received: 0,
      last_ping: null,
      created_at: new Date().toISOString(),
    };

    setWebhooks((prev) => [newWebhook, ...prev]);
    setNewWebhookName("");
    setCreating(false);
  }

  const activeCount = webhooks.filter(
    (webhook) => webhook.status === "active",
  ).length;

  return (
    <MainLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/30">
                  <Webhook className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Connectors
                  </p>
                  <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                    Webhooks
                  </h1>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Manage inbound HTTP endpoints for real-time ingestion. Endpoint
                details, delivery status, and credential actions stay visible in
                a single clean view.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:min-w-[320px]">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Active
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {activeCount}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Total
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-foreground">
                    {webhooks.length}
                  </p>
                </div>
              </div>

              <Button
                className="h-10"
                onClick={() => setCreating(true)}
                  >
                <Plus className="mr-1.5 h-4 w-4" />
                New webhook
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Configured endpoints
              </h2>
              <p className="text-sm text-muted-foreground">
                Review endpoint URLs, secrets, and delivery health for each
                webhook.
              </p>
            </div>

            {webhooks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center shadow-sm">
                <Webhook className="mx-auto h-8 w-8 text-muted-foreground" />
                <h3 className="mt-4 text-base font-semibold text-foreground">
                  No webhooks configured
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Create your first endpoint to start receiving payloads.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setCreating(true)}
                      >
                  <Plus className="mr-1.5 h-4 w-4" />
                  New webhook
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {webhooks.map((wh) => (
                  <WebhookCard
                    key={wh.id}
                    wh={wh}
                    showSecret={!!showSecret[wh.id]}
                    copied={copied}
                    onToggleSecret={() => handleToggleSecret(wh.id)}
                    onCopy={handleCopy}
                    onToggleStatus={() => handleToggleStatus(wh.id)}
                    onRegenSecret={() => handleRegenSecret(wh.id)}
                    onDelete={() => handleDelete(wh.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  Create endpoint
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a named webhook and the endpoint URL and secret are
                  generated automatically.
                </p>
              </div>

              {creating ? (
                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Webhook name
                    </Label>
                    <Input
                      autoFocus
                      value={newWebhookName}
                                onChange={(event) =>
                        setNewWebhookName(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter") handleCreate();
                        if (event.key === "Escape") {
                          setCreating(false);
                          setNewWebhookName("");
                        }
                      }}
                      placeholder="Production ingest"
                      className="h-10"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreate}
                      disabled={!newWebhookName.trim()}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Create
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreating(false);
                        setNewWebhookName("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setCreating(true)}
                      >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add webhook
                </Button>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/30">
                  <Shield className="h-4 w-4 text-foreground" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    Delivery details
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send JSON payloads to the endpoint URL and authenticate each
                    request with the signing secret.
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>Use POST requests with application/json content.</p>
                <p>Pass the secret in the X-Webhook-Secret header.</p>
                <p>Store endpoint and secret separately for safer rotation.</p>
              </div>

              <pre className="mt-4 overflow-x-auto rounded-lg border border-border bg-muted/20 p-4 text-xs leading-6 text-foreground">
                {`POST /ingest/{endpoint}
Content-Type: application/json
X-Webhook-Secret: {secret}

{"rows": [...], "dataset_id": "..."}`}
              </pre>
            </section>
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}
