'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { DataSourceCreate, DataSourceUpdate, CatalogImportRequest } from '@/types/api'
import { useAuthenticatedApi } from './useAuthenticatedApi'
import { QUERY_KEYS } from '@/lib/constants/queryKeys'
import { LIST_STALE_TIME, ENTITY_STALE_TIME } from '@/lib/constants'

export function useDataSources() {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()
  return useQuery({
    queryKey: QUERY_KEYS.dataSources,
    queryFn: () => apiClient.getDataSources(),
    enabled: isAuthenticated && hasToken,
    staleTime: LIST_STALE_TIME,
  })
}

export function useDataSource(id: string) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()
  return useQuery({
    queryKey: QUERY_KEYS.dataSource(id),
    queryFn: () => apiClient.getDataSource(id),
    enabled: isAuthenticated && hasToken && !!id,
    staleTime: ENTITY_STALE_TIME,
  })
}

export function useDataSourceCatalog(sourceId: string) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()
  return useQuery({
    queryKey: QUERY_KEYS.dataSourceCatalog(sourceId),
    queryFn: () => apiClient.getDataSourceCatalog(sourceId),
    enabled: isAuthenticated && hasToken && !!sourceId,
    staleTime: LIST_STALE_TIME,
  })
}

export function useAllCatalogEntries() {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()
  return useQuery({
    queryKey: QUERY_KEYS.dataCatalogAll,
    queryFn: () => apiClient.getAllCatalogEntries(),
    enabled: isAuthenticated && hasToken,
    staleTime: LIST_STALE_TIME,
  })
}

export function useCreateDataSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: DataSourceCreate) => apiClient.createDataSource(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dataSources })
    },
  })
}

export function useUpdateDataSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DataSourceUpdate }) =>
      apiClient.updateDataSource(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dataSources })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dataSource(id) })
    },
  })
}

export function useDeleteDataSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.deleteDataSource(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dataSources })
    },
  })
}

export function useTestDataSourceConnection() {
  return useMutation({
    mutationFn: (id: string) => apiClient.testDataSourceConnection(id),
  })
}

export function useSyncDataSourceCatalog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.syncDataSourceCatalog(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dataSourceCatalog(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dataCatalogAll })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.dataSource(id) })
    },
  })
}

export function useImportCatalogEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceId, payload }: { sourceId: string; payload: CatalogImportRequest }) =>
      apiClient.importCatalogEntry(sourceId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.datasets })
    },
  })
}
