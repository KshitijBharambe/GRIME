import { useQuery } from '@tanstack/react-query'
import { useAuthenticatedApi } from './useAuthenticatedApi'
import apiClient from '@/lib/api'
import { ENTITY_STALE_TIME, SEARCH_GC_TIME } from '@/lib/constants'
import { QUERY_KEYS } from '@/lib/constants/queryKeys'

export interface SearchResult {
  type: string
  id: string
  title: string
  description: string
  metadata: Record<string, unknown>
}

export interface SearchResponse {
  query: string
  total_results: number
  pages: SearchResult[]
  datasets: SearchResult[]
  rules: SearchResult[]
  executions: SearchResult[]
  issues: SearchResult[]
}

export function useSearch(query: string, enabled: boolean = true) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()

  return useQuery({
    queryKey: QUERY_KEYS.search(query),
    queryFn: async () => {
      if (!query || query.trim().length === 0) {
        return {
          query: '',
          total_results: 0,
          pages: [],
          datasets: [],
          rules: [],
          executions: [],
          issues: []
        }
      }

      const response = await apiClient.get<SearchResponse>('/search/', {
        params: { q: query, limit: 10 }
      })
      return response.data
    },
    enabled: enabled && query.trim().length > 0 && isAuthenticated && hasToken,
    staleTime: ENTITY_STALE_TIME,
    gcTime: SEARCH_GC_TIME,
  })
}