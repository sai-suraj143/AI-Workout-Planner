import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import apiClient from '../api/client';
import type { FitnessProfile } from '../types/fitnessProfile';

// Shape of the API response envelope: { success: true, profile: {...} }
interface ProfileEnvelope {
  success: boolean;
  profile: FitnessProfile;
}

// Shape of an error envelope: { success: false, message: "..." }
interface ErrorEnvelope {
  message?: unknown;
}

// API functions
export const getProfileAPI = async (): Promise<FitnessProfile | null> => {
  try {
    const response = await apiClient.get<ProfileEnvelope>('/profile');
    return response.data.profile;
  } catch (err) {
    // 404 simply means "no profile saved yet" — a normal state for new users.
    if (isAxiosError(err) && err.response?.status === 404) {
      return null;
    }
    throw err;
  }
};

export const updateProfileAPI = async (data: Partial<FitnessProfile>): Promise<FitnessProfile> => {
  const response = await apiClient.put<ProfileEnvelope>('/profile', data);
  return response.data.profile;
};

/**
 * Turns any error thrown by the profile API into a short, friendly sentence.
 *
 * Never leaks stack traces, response bodies or Axios internals: only a server
 * authored `message` (which is already user facing) or a generic fallback is
 * shown.
 */
export const profileErrorMessage = (err: unknown, fallback: string): string => {
  if (isAxiosError(err)) {
    const message = (err.response?.data as ErrorEnvelope | undefined)?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
    if (!err.response) {
      return 'We could not reach the server. Check your connection and try again.';
    }
  }
  return fallback;
};

// Hooks
export const useGetProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfileAPI,
    // The profile only changes when this page (or the API) changes it.
    staleTime: 60_000,
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProfileAPI,
    onSuccess: (data) => {
      // Keep the cache in sync immediately and refetch so nothing else in the
      // app reads a stale profile. Navigation is left to the caller.
      queryClient.setQueryData(['profile'], data);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

export const useProfile = () => {
  const { data: profile, isLoading, isPending, error, refetch } = useGetProfile();
  const updateMutation = useUpdateProfile();

  return {
    profile,
    isLoading,
    /** True until the very first profile value (profile or null) is available. */
    isPending,
    error,
    refetch,
    update: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
  };
};
