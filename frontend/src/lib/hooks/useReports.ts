'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { QUERY_KEYS } from '@/lib/constants/queryKeys'
import { ENTITY_STALE_TIME } from '@/lib/constants'

// Quality Reports Hooks
export function useQualitySummary(datasetId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.qualitySummary(datasetId),
    queryFn: () => apiClient.getQualitySummary(datasetId),
    enabled: !!datasetId,
  })
}

export function useQualityTrends(days: number = 30) {
  return useQuery({
    queryKey: QUERY_KEYS.qualityTrends(days),
    queryFn: () => apiClient.getQualityTrends(days),
  })
}

export function useIssuePatterns() {
  return useQuery({
    queryKey: QUERY_KEYS.issuePatterns,
    queryFn: () => apiClient.getIssuePatterns(),
  })
}

export function useAllDatasetsQualityScores() {
  return useQuery({
    queryKey: QUERY_KEYS.allDatasetsQualityScores,
    queryFn: () => apiClient.getAllDatasetsQualityScores(),
    staleTime: ENTITY_STALE_TIME,
  })
}

export function useGenerateQualityReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      datasetId,
      includeCharts = false,
    }: {
      datasetId: string
      includeCharts?: boolean
    }) => apiClient.generateQualityReport(datasetId, includeCharts),
    onSuccess: () => {
      // Optionally invalidate related queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.exports })
    },
  })
}

// Export Data Hooks
export function useExportHistory(datasetId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.exportHistory(datasetId),
    queryFn: () => apiClient.getExportHistory(datasetId),
    enabled: !!datasetId,
  })
}

export function useExportDataset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      datasetId,
      format,
      includeMetadata = true,
      includeIssues = false,
      executionId,
    }: {
      datasetId: string
      format: string
      includeMetadata?: boolean
      includeIssues?: boolean
      executionId?: string
    }) =>
      apiClient.exportDataset(
        datasetId,
        format,
        includeMetadata,
        includeIssues,
        executionId
      ),
    onSuccess: (_, variables) => {
      // Invalidate export history for this dataset
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.exportHistory(variables.datasetId),
      })
    },
  })
}

export function useDownloadExport() {
  return useMutation({
    mutationFn: async (exportId: string) => {
      const blob = await apiClient.downloadExportFile(exportId)
      return { blob, exportId }
    },
  })
}

export function useDeleteExport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (exportId: string) => apiClient.deleteExport(exportId),
    onSuccess: () => {
      // Invalidate all export history queries
      queryClient.invalidateQueries({ queryKey: ['export-history'] })  // prefix: invalidates all exportHistory(datasetId) keys
    },
  })
}
