import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import apiClient from '../api/client';
import type { AnalyticsRange, AnalyticsResponse } from '../types/analytics';
import { useAuth } from './authService';

export const fetchAnalyticsAPI = async (range: AnalyticsRange): Promise<AnalyticsResponse['analytics']> => {
  const response = await apiClient.get<AnalyticsResponse>('/analytics', {
    params: { range },
  });

  return response.data.analytics;
};

export const analyticsErrorMessage = (error: unknown, fallback: string): string => {
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

export const useAnalytics = (range: AnalyticsRange = '7d') => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics', range],
    queryFn: () => fetchAnalyticsAPI(range),
    enabled: !!user,
    staleTime: 60_000,
  });
};
