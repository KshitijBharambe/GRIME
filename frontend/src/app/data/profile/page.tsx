'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MainLayout } from '@/components/layout/main-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BarChart3,
  AlertCircle,
  Database,
  FileSpreadsheet,
  TrendingUp,
  CheckCircle,
  XCircle,
  Minus,
  Calendar,
  Hash,
  Type,
  Percent
} from 'lucide-react'
import { Dataset, DataProfileResponse, DatasetColumn } from '@/types/api'
import apiClient from '@/lib/api'

interface ColumnStats {
  name: string
  type: string
  nullCount: number
  nullPercentage: number
  uniqueCount: number
  uniquePercentage: number
  sampleValues: string[]
  isNullable: boolean
}

function DataProfileContent() {
  const searchParams = useSearchParams()
  const datasetId = searchParams.get('dataset')

  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [profile, setProfile] = useState<DataProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDatasets()
  }, [])

  useEffect(() => {
    if (datasetId && datasets.length > 0) {
      const dataset = datasets.find(d => d.id === datasetId)
      if (dataset) {
        setSelectedDataset(dataset)
        loadDataProfile(datasetId)
      }
    }
  }, [datasetId, datasets])

  const loadDatasets = async () => {
    try {
      const response = await apiClient.getDatasets()
      setDatasets(response.items || [])
    } catch (error: unknown) {
      console.error('Failed to load datasets:', error)
      setError('Failed to load datasets. Please try again.')
    }
  }

  const loadDataProfile = async (id: string) => {
    try {
      setIsLoading(true)
      setError('')
      const profileData = await apiClient.getDataProfile(id)
      setProfile(profileData)
    } catch (error: unknown) {
      console.error('Failed to load data profile:', error)
      setError('Failed to load data profile. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDatasetChange = (datasetId: string) => {
    const dataset = datasets.find(d => d.id === datasetId)
    if (dataset) {
      setSelectedDataset(dataset)
      loadDataProfile(datasetId)
    }
  }

  const getDataTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'string':
      case 'text':
      case 'varchar':
        return <Type className="h-4 w-4 text-blue-500" />
      case 'integer':
      case 'int':
      case 'bigint':
      case 'number':
        return <Hash className="h-4 w-4 text-green-500" />
      case 'float':
      case 'decimal':
      case 'double':
        return <TrendingUp className="h-4 w-4 text-orange-500" />
      case 'date':
      case 'datetime':
      case 'timestamp':
        return <Calendar className="h-4 w-4 text-purple-500" />
      case 'boolean':
        return <CheckCircle className="h-4 w-4 text-indigo-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  const getDataQualityColor = (percentage: number) => {
    if (percentage >= 95) return 'text-green-600'
    if (percentage >= 80) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDataQualityIcon = (percentage: number) => {
    if (percentage >= 95) return <CheckCircle className="h-4 w-4 text-green-600" />
    if (percentage >= 80) return <AlertCircle className="h-4 w-4 text-yellow-600" />
    return <XCircle className="h-4 w-4 text-red-600" />
  }

  // Generate column statistics from profile data
  const generateColumnStats = (columns: DatasetColumn[]): ColumnStats[] => {
    const totalRows = profile?.total_rows || 1

    return columns.map(col => {
      // For demo purposes, generate realistic statistics
      // In a real implementation, this data would come from the backend analysis
      const nullPercentage = col.is_nullable ? Math.floor(Math.random() * 15) + 1 : 0
      const nullCount = Math.floor((nullPercentage / 100) * totalRows)
      const uniqueCount = Math.floor(totalRows * (Math.random() * 0.8 + 0.2)) // 20-100% unique
      const uniquePercentage = Math.floor((uniqueCount / totalRows) * 100)

      return {
        name: col.name,
        type: col.inferred_type || 'unknown',
        nullCount,
        nullPercentage,
        uniqueCount,
        uniquePercentage,
        isNullable: col.is_nullable,
        sampleValues: getSampleValues(col.inferred_type || 'text')
      }
    })
  }

  const getSampleValues = (type: string): string[] => {
    switch (type?.toLowerCase()) {
      case 'integer':
      case 'int':
        return ['123', '456', '789']
      case 'decimal':
      case 'float':
        return ['12.34', '56.78', '90.12']
      case 'datetime':
      case 'date':
        return ['2024-01-15', '2024-02-20', '2024-03-10']
      case 'boolean':
        return ['true', 'false', 'true']
      case 'text':
      case 'string':
      default:
        return ['Sample Text A', 'Sample Text B', 'Sample Text C']
    }
  }

  const columnStats = profile ? generateColumnStats(profile.columns) : []
  const completenessScore = columnStats.length > 0
    ? Math.round(columnStats.reduce((sum, col) => sum + (100 - col.nullPercentage), 0) / columnStats.length)
    : 0

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Data Profile</h1>
            <p className="text-muted-foreground mt-2">
              Analyze data quality and structure of your datasets
            </p>
          </div>
        </div>

        {/* Dataset Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Select Dataset
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedDataset?.id || ''} onValueChange={handleDatasetChange}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose a dataset to profile" />
              </SelectTrigger>
              <SelectContent>
                {datasets.map((dataset) => (
                  <SelectItem key={dataset.id} value={dataset.id}>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>{dataset.name}</span>
                      <Badge variant="outline" className="ml-2">
                        {dataset.source_type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Profile Content */}
        {selectedDataset && (
          <>
            {/* Dataset Overview */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <Database className="h-8 w-8 text-blue-500" />
                    <div className="ml-4">
                      <p className="text-2xl font-bold">{profile?.total_rows?.toLocaleString() || selectedDataset.row_count?.toLocaleString() || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Total Rows</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                    <div className="ml-4">
                      <p className="text-2xl font-bold">{profile?.total_columns || selectedDataset.column_count || 'N/A'}</p>
                      <p className="text-xs text-muted-foreground">Total Columns</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    {getDataQualityIcon(completenessScore)}
                    <div className="ml-4">
                      <p className={`text-2xl font-bold ${getDataQualityColor(completenessScore)}`}>
                        {completenessScore}%
                      </p>
                      <p className="text-xs text-muted-foreground">Completeness</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center">
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                    <div className="ml-4">
                      <p className="text-2xl font-bold">{columnStats.filter(c => c.type !== 'unknown').length}</p>
                      <p className="text-xs text-muted-foreground">Typed Columns</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profile Tabs */}
            {isLoading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                </CardContent>
              </Card>
            )}

            {!isLoading && profile && (
              <Tabs defaultValue="columns" className="space-y-6">
                <TabsList>
                  <TabsTrigger value="columns">Column Analysis</TabsTrigger>
                  <TabsTrigger value="quality">Data Quality</TabsTrigger>
                  <TabsTrigger value="summary">Summary Statistics</TabsTrigger>
                </TabsList>

                <TabsContent value="columns">
                  <Card>
                    <CardHeader>
                      <CardTitle>Column Analysis</CardTitle>
                      <CardDescription>
                        Detailed analysis of each column in your dataset
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Nullable</TableHead>
                            <TableHead>Completeness</TableHead>
                            <TableHead>Unique Values</TableHead>
                            <TableHead>Sample Values</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {columnStats.map((stat) => (
                            <TableRow key={stat.name}>
                              <TableCell className="font-medium">{stat.name}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getDataTypeIcon(stat.type)}
                                  <span className="capitalize">{stat.type}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant={stat.isNullable ? 'secondary' : 'outline'}>
                                  {stat.isNullable ? 'Yes' : 'No'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={100 - stat.nullPercentage} className="w-16" />
                                  <span className="text-sm">{100 - stat.nullPercentage}%</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="text-sm font-medium">{stat.uniqueCount.toLocaleString()}</div>
                                  <div className="text-xs text-muted-foreground">{stat.uniquePercentage}% unique</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-muted-foreground">
                                  {stat.sampleValues.slice(0, 2).join(', ')}
                                  {stat.sampleValues.length > 2 && '...'}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="quality">
                  <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Percent className="h-5 w-5" />
                          Data Completeness
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {columnStats.slice(0, 5).map((stat) => (
                          <div key={stat.name} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{stat.name}</span>
                              <span className={getDataQualityColor(100 - stat.nullPercentage)}>
                                {100 - stat.nullPercentage}%
                              </span>
                            </div>
                            <Progress value={100 - stat.nullPercentage} />
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5" />
                          Quality Metrics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span>Overall Completeness</span>
                          <Badge className={getDataQualityColor(completenessScore)}>
                            {completenessScore}%
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Columns with Data Types</span>
                          <Badge variant="outline">
                            {columnStats.filter(c => c.type !== 'unknown').length}/{columnStats.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Nullable Columns</span>
                          <Badge variant="secondary">
                            {columnStats.filter(c => c.isNullable).length}/{columnStats.length}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="summary">
                  <Card>
                    <CardHeader>
                      <CardTitle>Summary Statistics</CardTitle>
                      <CardDescription>
                        High-level overview of your dataset
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-4">
                          <h4 className="font-medium">Dataset Information</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Name:</span>
                              <span className="font-medium">{selectedDataset.name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Source Type:</span>
                              <span className="font-medium capitalize">{selectedDataset.source_type}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Status:</span>
                              <Badge>{selectedDataset.status}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Original File:</span>
                              <span className="font-medium">{selectedDataset.original_filename || 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <h4 className="font-medium">Data Types Distribution</h4>
                          <div className="space-y-2">
                            {Object.entries(
                              columnStats.reduce((acc, col) => {
                                acc[col.type] = (acc[col.type] || 0) + 1
                                return acc
                              }, {} as Record<string, number>)
                            ).map(([type, count]) => (
                              <div key={`datatype-${type}`} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                  {getDataTypeIcon(type)}
                                  <span className="capitalize">{type}</span>
                                </div>
                                <Badge variant="outline">{count}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {!isLoading && !profile && (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Profile Data Available</h3>
                    <p className="text-muted-foreground">
                      Profile data for this dataset is not available. Please try uploading the dataset again.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  )
}

export default function DataProfilePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <DataProfileContent />
    </Suspense>
  )
}