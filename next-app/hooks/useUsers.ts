import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from "axios";
import { UsersApiResponse, User } from '../types/api';
import { apiClient } from '@/api/client';
import { useState } from 'react';
import { notify } from '@/lib/notify';
import { MESSAGES } from '@/constants/messages';

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
  EXPIRED = 'expired',
}

interface UserMutationData {
  username: string;
  password: string;
  profileId: number;
  accountStatus?: AccountStatus;
  /** ISO 8601 datetime, or null to clear */
  expiresAt?: string | null;
  expiryFramedIp?: string | null;
  freenight?: boolean;
  quotaResetDay?: number;
  /** YYYY-MM-DD manual cycle anchor, or null to clear */
  quotaCycleStartDate?: string | null;
  fullName?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}

// const fetchUsers = async (page: number, pageSize: number): Promise<UsersApiResponse> => {
//   const response = await apiClient.get<UsersApiResponse>('/radius/users',{
//     params: { page, pageSize }
//   });
//   return response.data;
// };
type UserListFilters = {
  accountStatus?: string;
  connectivityStatus?: string;
  /** Profile name to match (exact, case-insensitive). */
  profile?: string;
  quotaExceeded?: boolean;
  hasMacAddress?: boolean;
  hasContactInfo?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

const fetchUsers = async (
  page: number,
  pageSize: number,
  searchQuery: string,
  filters: UserListFilters
): Promise<UsersApiResponse> => {
  const filterParams = {
    ...(filters.accountStatus ? { accountStatus: filters.accountStatus } : {}),
    ...(filters.connectivityStatus === 'online'
      ? { online: true }
      : filters.connectivityStatus === 'offline'
        ? { online: false }
        : {}),
    ...(filters.profile && filters.profile !== 'all' ? { profile: filters.profile } : {}),
    ...(filters.quotaExceeded ? { quotaExceeded: true } : {}),
    ...(filters.hasMacAddress ? { hasMacAddress: true } : {}),
    ...(filters.hasContactInfo ? { hasContactInfo: true } : {}),
    ...(filters.sortBy ? { sortBy: filters.sortBy } : {}),
    ...(filters.sortDir ? { sortDir: filters.sortDir } : {}),
  };
  if (searchQuery) {
    const response = await apiClient.get<UsersApiResponse>('/radius/users/search', {
      params: { query: searchQuery, ...filterParams }
    });
    return response.data;
  } else {
    const response = await apiClient.get<UsersApiResponse>('/radius/users', {
      params: { page, pageSize, ...filterParams }
    });
    return response.data;
  }
};

const createUser = async ({ username, ...userData }:  UserMutationData & { username: string }): Promise<User> => {
  const response = await apiClient.post<User>('/radius/users', { username, ...userData });
  return response.data;
};

const updateUser = async ({ username, ...userData }: UserMutationData & { username: string }): Promise<User> => {
  const response = await apiClient.put<User>(`/radius/users/${encodeURIComponent(username)}`, { username, ...userData });
  return response.data;
};

const deleteUser = async (username: string): Promise<void> => {
  await apiClient.delete(`/radius/users/${encodeURIComponent(username)}`);
};

const resetMacAddress = async (username: string): Promise<User> => {
  const response = await apiClient.post<User>(`/radius/users/resetAddress/${encodeURIComponent(username)}`);
  return response.data;
};


const useUsers = (initialPage = 1, pageSize = 10, filters: UserListFilters = {}) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const usersQuery = useQuery<UsersApiResponse, Error>({
    queryKey: ['users', currentPage, pageSize, searchQuery, filters.accountStatus ?? '', filters.connectivityStatus ?? '', filters.profile ?? '', filters.quotaExceeded ? 'quota' : '', filters.hasMacAddress ? 'mac' : '', filters.hasContactInfo ? 'contact' : '', filters.sortBy ?? '', filters.sortDir ?? ''],
    queryFn: () => fetchUsers(currentPage, pageSize, searchQuery, filters),
  });

  const createUserMutation = useMutation<User, Error, UserMutationData & { username: string }>({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success("Created", MESSAGES.common.created);
    },
    onError: (error) => {
      notify.error("Create failed", error.message);
    },
  });

  const updateUserMutation = useMutation<User, Error, UserMutationData & { username: string }>({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success("Saved", MESSAGES.common.updated);
    },
    onError: (error) => {
      notify.error("Save failed", error.message);
    },
  });
  

  const deleteUserMutation = useMutation<void, Error, string>({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success("Deleted", MESSAGES.users.deleted);
    },
    onError: (error) => {
      notify.error("Delete failed", error.message);
    },
  });

  const resetMacAddressMutation = useMutation<User, Error, string>({
    mutationFn: resetMacAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      notify.success("Success", MESSAGES.users.macReset);
    },
    onError: (error: any) => {
      // Backend returns 404 if there is no MAC bound; treat as informational.
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message =
          (error.response?.data as any)?.message ||
          (error.response?.data as any)?.error ||
          error.message;
        if (status === 404) {
          notify.info("No MAC to reset", String(message || "MAC address not found for the user."));
          return;
        }
        notify.error("Action failed", String(message || "Request failed"));
        return;
      }
      notify.error("Action failed", error?.message ? String(error.message) : "Request failed");
    },
  });

  return {
    ...usersQuery,
    setSearchQuery,
    searchQuery,
    currentPage,
    setCurrentPage,
    deleteUserMutation,
    createUserMutation,
    updateUserMutation,
    resetMacAddressMutation
  };
};

export default useUsers;

