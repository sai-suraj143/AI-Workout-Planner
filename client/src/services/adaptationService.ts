import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import apiClient from '../api/client';
import type { AdaptivePlanResponse, AdaptationResponse } from '../types/adaptation';
import type { WorkoutPlan } from '../types/workoutPlan';
import { useAuth } from './authService';

export const fetchAdaptationSummaryAPI = async (): Promise<AdaptationResponse> => {
  const response = await apiClient.get<AdaptationResponse>('/adaptation/summary');
  return response.data;
};

export const generateAdaptivePlanAPI = async (): Promise<{ plan: WorkoutPlan; adaptation: AdaptivePlanResponse['adaptation'] }> => {
  const response = await apiClient.post<AdaptivePlanResponse>('/plans/generate-adaptive');
  return {
    plan: response.data.plan,
    adaptation: response.data.adaptation,
  };
};

export const adaptationErrorMessage = (error: unknown, fallback: string): string => {
  if (isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    if (typeof message === 'string' && message.trim().length > 0) {
      return message.trim();
    }
    if (!error.response) {
      return 'We could not reach the server. Check your connection and try again.';
    }
  }
  return fallback;
};

export const useAdaptationSummary = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['adaptation', 'summary', user?.id],
    queryFn: fetchAdaptationSummaryAPI,
    enabled: !!user,
    staleTime: 60_000,
  });
};

export const useGenerateAdaptivePlan = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generateAdaptivePlanAPI,
    onSuccess: (result) => {
      queryClient.setQueryData(['plan', user?.id, result.plan._id], result.plan);
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
      void queryClient.invalidateQueries({ queryKey: ['adaptation', 'summary'] });
    },
  });
};
