import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import apiClient from '../api/client';
import { useAuth } from './authService';
import type { WorkoutPlan } from '../types/workoutPlan';

/**
 * Plan API + TanStack Query hooks.
 *
 * Every call goes through the shared `apiClient` (base URL + credentials) and
 * unwraps the server envelope `{ success, plan | plans }`, so components only
 * ever see `WorkoutPlan` values — never response wrappers.
 */

interface PlanEnvelope {
  success: boolean;
  plan: WorkoutPlan;
}

interface PlansEnvelope {
  success: boolean;
  plans: WorkoutPlan[];
}

interface ErrorEnvelope {
  message?: unknown;
}

/** Defensive: never hand components a non-array and let `plans.map` explode. */
const asPlanArray = (plans: WorkoutPlan[]): WorkoutPlan[] => (Array.isArray(plans) ? plans : []);

export const listPlansAPI = async (): Promise<WorkoutPlan[]> => {
  const response = await apiClient.get<PlansEnvelope>('/plans');
  return asPlanArray(response.data.plans);
};

export const getPlanAPI = async (planId: string): Promise<WorkoutPlan> => {
  const response = await apiClient.get<PlanEnvelope>(`/plans/${planId}`);
  return response.data.plan;
};

export const generatePlanAPI = async (): Promise<WorkoutPlan> => {
  const response = await apiClient.post<PlanEnvelope>('/plans/generate');
  return response.data.plan;
};

export const deletePlanAPI = async (planId: string): Promise<void> => {
  await apiClient.delete(`/plans/${planId}`);
};

/**
 * Turns a plan API error into one short, user-facing sentence.
 *
 * Only a server-authored `message` is shown — never stack traces, response
 * bodies or Axios internals.
 */
export const planErrorMessage = (err: unknown, fallback: string): string => {
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

export const usePlans = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['plans', user?.id],
    queryFn: listPlansAPI,
    enabled: !!user,
    staleTime: 60_000,
  });
};

export const usePlan = (planId?: string) => {
  const { user } = useAuth();
  return useQuery({
    // Empty id is never fetched (see `enabled`), so the placeholder keeps the
    // hook's types honest without a non-null assertion.
    queryKey: ['plan', user?.id, planId ?? ''],
    queryFn: () => getPlanAPI(planId ?? ''),
    enabled: !!user && !!planId,
    staleTime: 60_000,
  });
};

export const useGeneratePlan = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: generatePlanAPI,
    onSuccess: (plan) => {
      // Show the new plan immediately, then refresh the history list.
      queryClient.setQueryData(['plan', user?.id, plan._id], plan);
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};

export const useDeletePlan = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlanAPI,
    onSuccess: (_data, planId) => {
      queryClient.removeQueries({ queryKey: ['plan', user?.id, planId] });
      void queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });
};
