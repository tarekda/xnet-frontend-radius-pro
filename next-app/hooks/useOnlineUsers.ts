import { apiClient } from '@/api/client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/lib/notify';
import { MESSAGES } from '@/constants/messages';

export interface OnlineUser {
  session_username: string;
  session_mac_address: string;
  session_start_time: string;
  session_last_update: string | null;
  session_status: string;
  session_session_time: number;
  profile_profile_name: string;
  /** Original plan when current profile is Fallback (FUP); otherwise same as profile_profile_name */
  original_profile_name?: string;
  profile_daily_quota: string;
  profile_monthly_quota: string;
  monthly_usage: string;
  total_bytes_in: string;
  total_bytes_out: string;
  total_daily_usage: string;
  total_daily_bytes_in?: string;
  total_daily_bytes_out?: string;
  real_time_data_usage: string;
  remaining_daily_quota: string;
  remaining_monthly_quota: string;
  monthly_cycle_start?: string | null;
  monthly_cycle_reset_at?: string | null;
  quota_reset_day?: number | null;
  quota_cycle_start_date?: string | null;
  is_monthly_exceeded?: number;
  monthly_usage_pct?: number;
  userDetails_full_name: string;
  /** NAS device that terminated the session (returned by the online-users endpoint). */
  session_nas_ip?: string | null;
  session_nas_name?: string | null;
  is_fallback: number;
}

interface OnlineUsersResponse {
  success: boolean;
  message: string;
  totalPages: number;
  currentPage: number;
  limit: number;
  totalUsers: number;
  data: OnlineUser[];
}

interface ResetDailyQuotaResponse {
  success: boolean;
  message: string;
}

interface ResetMonthlyQuotaResponse {
  success: boolean;
  message: string;
}

interface DisconnectSessionResponse {
  success: boolean;
  message: string;
}

const fetchOnlineUsers = async (page: number = 1, limit: number = 10, search: string): Promise<OnlineUsersResponse> => {
  const response = await apiClient.get<OnlineUsersResponse>(`/online-users?page=${page}&limit=${limit}&search=${search}`);
  return response.data;
};

// Define the API call for resetting the daily quota
const resetDailyQuota = async ({ username }: { username: string }): Promise<ResetDailyQuotaResponse> => {
  const response = await apiClient.put<ResetDailyQuotaResponse>(`/radius/users/resetQuota/${username}`);
  return response.data;
};

// Define the API call for resetting the monthly quota/traffic
const resetMonthlyQuota = async ({ username }: { username: string }): Promise<ResetMonthlyQuotaResponse> => {
  const response = await apiClient.put<ResetMonthlyQuotaResponse>(`/radius/users/resetMonthlyQuota/${username}`);
  return response.data;
};

const resetMacAddress = async ({ username }: { username: string }): Promise<ResetDailyQuotaResponse> => {
  // endpoint used in Users module
  const response = await apiClient.post<ResetDailyQuotaResponse>(`/radius/users/resetAddress/${username}`);
  return response.data;
};

const changeUserProfile = async ({
  username,
  profileId,
}: {
  username: string;
  profileId: number;
}): Promise<{ success: boolean; message: string }> => {
  // Reuse existing update-user endpoint
  const response = await apiClient.put<{ success: boolean; message: string }>(
    `/radius/users/${encodeURIComponent(username)}`,
    { username, profileId }
  );
  return response.data;
};

const disconnectSession = async ({
  username,
}: {
  username: string;
}): Promise<DisconnectSessionResponse> => {
  const response = await apiClient.post<DisconnectSessionResponse>(`/sessions/disconnect`, {
    username,
  });
  return response.data;
};

export const useOnlineUsers = (
  search = "",
  initialPage: number = 1,
  initialLimit: number = 100,
  options?: { enabled?: boolean; refetchInterval?: number }
) => {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  //const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const userQuery = useQuery({
    queryKey: ['onlineUsers', page, limit, search],
    queryFn: () => fetchOnlineUsers(page, limit, search),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });

  const resetDailyUserQuotaMutation = useMutation<ResetDailyQuotaResponse, Error, { username: string }>({
    mutationFn: resetDailyQuota,
    onSuccess: () => {
      // Optionally, you can invalidate queries that need updating, e.g., the online users list
      queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
      notify.success("Success", MESSAGES.users.quotaReset);
    },
    onError: (error) => notify.error("Action failed", error.message),
  });

  const resetMonthlyUserQuotaMutation = useMutation<ResetMonthlyQuotaResponse, Error, { username: string }>({
    mutationFn: resetMonthlyQuota,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
      notify.success("Success", MESSAGES.users.monthlyQuotaReset);
    },
    onError: (error) => notify.error("Action failed", error.message),
  });

  const resetMacAddressMutation = useMutation<ResetDailyQuotaResponse, Error, { username: string }>({
    mutationFn: resetMacAddress,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
      notify.success("Success", MESSAGES.users.macReset);
    },
    onError: (error) => notify.error("Action failed", error.message),
  });

  const disconnectUserSessionMutation = useMutation<DisconnectSessionResponse, Error, { username: string }>({
    mutationFn: disconnectSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
      notify.success("Success", MESSAGES.onlineUsers.disconnected);
    },
    onError: (error) => notify.error("Action failed", error.message),
  });

  const changeUserProfileMutation = useMutation<
    { success: boolean; message: string },
    Error,
    { username: string; profileId: number }
  >({
    mutationFn: changeUserProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onlineUsers'] });
      notify.success("Saved", MESSAGES.common.updated);
    },
    onError: (error) => notify.error("Action failed", error.message),
  });

  return {
    ...userQuery,
    resetDailyUserQuotaMutation,
    resetMonthlyUserQuotaMutation,
    resetMacAddressMutation,
    disconnectUserSessionMutation,
    changeUserProfileMutation,
    page,
    setPage,
    limit,
    setLimit,
  };
};
