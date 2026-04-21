'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useDataSource,
  useDataSourceCatalog,
  useSyncDataSourceCatalog,
  useImportCatalogEntry,
} from '@/lib/hooks/useDataSources'
import {
  ArrowLeft,
  RefreshCw,
  Download,
  Loader2,
  Table2,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'
import { DataCatalogEntry } from '@/types/api'
import { formatDate } from '@/lib/utils/date'
import { toast } from 'sonner'

export default function DataSourceCatalogPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: source, isLoading: sourceLoading } = useDataSource(id)
  const { data: entries = [], isLoading: catalogLoading } = useDataSourceCatalog(id)
  const syncMutation = useSyncDataSourceCatalog()
  const importMutation = useImportCatalogEntry()

  const [importEntry, setImportEntry] = useState<DataCatalogEntry | null>(null)
  const [importName, setImportName] = useState('')
  const [rowLimit, setRowLimit] = useState('')

  async function handleSync() {
    await syncMutation.mutateAsync(id)
    toast.success('Catalog synced')
  }

  async function handleImport() {
    if (!importEntry) return
    const result = await importMutation.mutateAsync({
      sourceId: id,
      payload: {
        catalog_entry_id: importEntry.id,
        dataset_name: importName || undefined,
        row_limit: rowLimit ? parseInt(rowLimit) : undefined,
      },
    })
    toast.success(`Imported as dataset. ${result.rows} rows ready for rule execution.`)
    setImportEntry(null)
    router.push(`/executions/new?dataset_version_id=${result.dataset_version_id}`)
  }

  if (sourceLoading) {
    return (
      <MainLayout>
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/data-sources">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{source?.name}</h1>
            <p className="text-sm text-muted-foreground">
              {source?.source_type} · Last synced: {source?.last_synced_at ? formatDate(source.last_synced_at) : 'Never'}
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncMutation.isPending} variant="outline">
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Catalog
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table2 className="h-5 w-5" />
              Catalog ({entries.length} tables)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {catalogLoading ? (
              <div className="flex items-center gap-2 p-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading catalog…
              </div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <p>No catalog entries. Click <strong>Sync Catalog</strong> to discover tables.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead>Schema</TableHead>
                    <TableHead>Columns</TableHead>
                    <TableHead>Estimated Rows</TableHead>
                    <TableHead>Discovered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry: DataCatalogEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.table_name}</TableCell>
                      <TableCell className="text-muted-foreground">{entry.schema_name ?? '—'}</TableCell>
                      <TableCell>{entry.column_count ?? '—'}</TableCell>
                      <TableCell>
                        {entry.row_estimate != null ? entry.row_estimate.toLocaleString() : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(entry.discovered_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setImportEntry(entry)
                            setImportName(`${source?.name}/${entry.table_name}`)
                            setRowLimit('')
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Import & Run Rules
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!importEntry} onOpenChange={open => !open && setImportEntry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Table as Dataset</DialogTitle>
              <DialogDescription>
                Fetches <strong>{importEntry?.table_name}</strong> from the source and creates a
                dataset ready for rule execution.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>Dataset Name</Label>
                <Input
                  value={importName}
                  onChange={e => setImportName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Row Limit (optional)</Label>
                <Input
                  type="number"
                  placeholder="Leave blank for all rows"
                  value={rowLimit}
                  onChange={e => setRowLimit(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportEntry(null)}>Cancel</Button>
              <Button onClick={handleImport} disabled={importMutation.isPending}>
                {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                Import
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  )
}
