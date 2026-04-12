'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import { Rule, RuleCreate, RuleUpdate, PaginatedResponse, RuleTestRequest } from '@/types/api'
import { useAuthenticatedApi } from './useAuthenticatedApi'
import { QUERY_KEYS } from '@/lib/constants/queryKeys'
import { LIST_STALE_TIME, ENTITY_STALE_TIME, STATIC_STALE_TIME } from '@/lib/constants'

export function useRules(page: number = 1, size: number = 20) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()

  return useQuery<PaginatedResponse<Rule>>({
    queryKey: QUERY_KEYS.rules(page, size),
    queryFn: () => apiClient.getRules(),
    enabled: isAuthenticated && hasToken,
    staleTime: LIST_STALE_TIME,
  })
}

export function useRule(id: string) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()

  return useQuery<Rule>({
    queryKey: QUERY_KEYS.rule(id),
    queryFn: () => apiClient.getRule(id),
    enabled: isAuthenticated && hasToken && !!id,
    staleTime: ENTITY_STALE_TIME,
  })
}

export function useCreateRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ruleData: RuleCreate) => apiClient.createRule(ruleData),
    onSuccess: () => {
      // Invalidate rules list to refresh the cache
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rules() })
    },
  })
}

export function useUpdateRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RuleUpdate }) =>
      apiClient.updateRule(id, data),
    onSuccess: (updatedRule) => {
      // Update the specific rule in cache
      queryClient.setQueryData(QUERY_KEYS.rule(updatedRule.id), updatedRule)
      // Also invalidate the rules list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rules() })
    },
  })
}

export function useDeleteRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteRule(id),
    onSuccess: () => {
      // Invalidate rules list to refresh the cache
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rules() })
    },
  })
}

export function useTestRule() {
  return useMutation({
    mutationFn: ({ ruleId, testData }: { ruleId: string; testData: RuleTestRequest }) =>
      apiClient.testRule(ruleId, testData),
  })
}

export function useRuleKinds() {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()

  return useQuery({
    queryKey: QUERY_KEYS.ruleKinds,
    queryFn: () => apiClient.getRuleKinds(),
    enabled: isAuthenticated && hasToken,
    staleTime: STATIC_STALE_TIME,
  })
}

export function useActivateRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.activateRule(id),
    onSuccess: (_, id) => {
      // Update the specific rule in cache
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rule(id) })
      // Also invalidate the rules list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rules() })
    },
  })
}

export function useDeactivateRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.deactivateRule(id),
    onSuccess: (_, id) => {
      // Update the specific rule in cache
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rule(id) })
      // Also invalidate the rules list
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.rules() })
    },
  })
}

export function useRuleVersions(ruleId: string) {
  const { isAuthenticated, hasToken } = useAuthenticatedApi()

  return useQuery<Rule[]>({
    queryKey: QUERY_KEYS.ruleVersions(ruleId),
    queryFn: () => apiClient.getRuleVersions(ruleId),
    enabled: isAuthenticated && hasToken && !!ruleId,
    staleTime: ENTITY_STALE_TIME,
  })
}