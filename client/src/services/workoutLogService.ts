import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WorkoutLog } from '../types/workoutLog';
import { useAuth } from './authService';

// API base URL — must match the axios base used by api/client.ts so auth calls
// and workout calls always talk to the same backend.
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Start a workout session from a specific plan/day
 */
export const useStartWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ planId, dayIndex }: { planId: string; dayIndex: number }) => {
      const response = await fetch(`${API_BASE}/workouts/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId, dayIndex }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start workout');
      }

      const data = await response.json();
      return data.workoutLog;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['activeWorkout', data.planId, data.dayIndex], data);
      void queryClient.invalidateQueries({ queryKey: ['activeWorkout', data.planId, data.dayIndex] });
      void queryClient.invalidateQueries({ queryKey: ['workoutHistory'] });
    },
  });
};

/** Find an active workout for a plan day without creating a new log. */
export const useActiveWorkout = (planId: string, dayIndex: number) => {
  const { user } = useAuth();

  return useQuery<WorkoutLog | null>({
    queryKey: ['activeWorkout', planId, dayIndex],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/workouts/active/${planId}/${dayIndex}`, {
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to find active workout');

      const data = await response.json();
      return data.workoutLog ?? null;
    },
    enabled: !!user && !!planId && dayIndex >= 0 && dayIndex <= 6,
  });
};

/**
 * Get a workout log by ID
 */
export const useWorkout = (id: string) => {
  const { user } = useAuth();

  return useQuery<WorkoutLog>({
    queryKey: ['workout', id],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const response = await fetch(`${API_BASE}/workouts/${id}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Workout not found');
        throw new Error('Failed to fetch workout');
      }

      const data = await response.json();
      return data.workoutLog;
    },
    enabled: !!user && !!id,
  });
};

/**
 * Update an in-progress workout.
 *
 * The workout page saves on every keystroke (reps, notes), so two guards are
 * needed to stop typed values from being lost:
 *  - the query cache is updated optimistically before the request; otherwise
 *    the controlled inputs snap back to the previous server value while the
 *    save is in flight and characters get eaten mid-typing;
 *  - PUTs for the same log are serialized, otherwise out-of-order responses
 *    can leave MongoDB holding a stale value.
 */
const updateQueues = new Map<string, Promise<unknown>>();

export const useUpdateWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates
    }: {
      id: string;
      updates: Partial<WorkoutLog>;
    }) => {
      const send = async (): Promise<WorkoutLog> => {
        const response = await fetch(`${API_BASE}/workouts/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update workout');
        }

        const data = await response.json();
        return data.workoutLog;
      };

      const previous = updateQueues.get(id) ?? Promise.resolve();
      const next = previous.then(send, send);
      // Swallow failures in the queue itself so one failed save cannot block
      // the saves queued behind it.
      updateQueues.set(id, next.then(() => undefined, () => undefined));
      return next;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['workout', id] });

      const previousWorkout = queryClient.getQueryData(['workout', id]);
      queryClient.setQueryData(['workout', id], (old) => (old ? { ...old, ...updates } : old));

      const activeKeys = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['activeWorkout'] })
        .filter((q) => (q.state.data as WorkoutLog | null)?._id === id)
        .map((q) => q.queryKey as readonly ['activeWorkout', string, number]);
      const previousActive = activeKeys.map((key) => queryClient.getQueryData(key));
      for (const key of activeKeys) {
        queryClient.setQueryData(key, (old) => (old ? { ...old, ...updates } : old));
      }

      return { previousWorkout, activeKeys, previousActive };
    },
    onError: (_error, { id }, context) => {
      if (!context) return;
      queryClient.setQueryData(['workout', id], context.previousWorkout);
      context.activeKeys.forEach((key, i) =>
        queryClient.setQueryData(key, context.previousActive[i]),
      );
    },
    onSuccess: () => {
      // The optimistic cache already holds exactly what the user typed and the
      // writes are serialized, so overwriting or refetching here would only
      // risk snapping the inputs back to an older value mid-typing. Other
      // views that read the log refetch on mount instead.
      void queryClient.invalidateQueries({ queryKey: ['workoutHistory'] });
    },
  });
};

/**
 * Mark workout as completed
 */
export const useCompleteWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE}/workouts/${id}/complete`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete workout');
      }

      const data = await response.json();
      return data.workoutLog;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['workout', variables], data);
      queryClient.setQueryData(['activeWorkout', data.planId, data.dayIndex], null);
      void queryClient.invalidateQueries({ queryKey: ['workout', variables] });
      void queryClient.invalidateQueries({ queryKey: ['activeWorkout', data.planId, data.dayIndex] });
      void queryClient.invalidateQueries({ queryKey: ['workoutHistory'] });
    },
  });
};

/**
 * Mark workout as abandoned
 */
export const useAbandonWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`${API_BASE}/workouts/${id}/abandon`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to abandon workout');
      }

      const data = await response.json();
      return data.workoutLog;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['workout', variables], data);
      queryClient.setQueryData(['activeWorkout', data.planId, data.dayIndex], null);
      void queryClient.invalidateQueries({ queryKey: ['workout', variables] });
      void queryClient.invalidateQueries({ queryKey: ['activeWorkout', data.planId, data.dayIndex] });
      void queryClient.invalidateQueries({ queryKey: ['workoutHistory'] });
    },
  });
};

/**
 * Get workout history for the current user
 */
export const useWorkoutHistory = (limit: number = 20, offset: number = 0) => {
  const { user } = useAuth();

  return useQuery<WorkoutLog[]>({
    queryKey: ['workoutHistory', limit, offset],
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');
      
      const response = await fetch(
        `${API_BASE}/workouts?limit=${limit}&offset=${offset}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch workout history');
      }

      const data = await response.json();
      return data.workoutLogs;
    },
    enabled: !!user,
  });
};