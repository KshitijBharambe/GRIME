'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import {
  UserCreate,
  UserRole
} from '@/types/api'
import { QUERY_KEYS } from '@/lib/constants/queryKeys'

// Hooks for users (admin only)
export function useUsers() {
  return useQuery({
    queryKey: QUERY_KEYS.users,
    queryFn: () => apiClient.getUsers(),
  })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: QUERY_KEYS.currentUser,
    queryFn: () => apiClient.getCurrentUser(),
  })
}

// Mutation hooks
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userData: UserCreate) => apiClient.createUser(userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users })
    },
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      apiClient.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users })
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => apiClient.deleteUser(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.users })
    },
  })
}