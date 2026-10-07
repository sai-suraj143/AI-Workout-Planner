export interface AnalyticsSummary {
  userId: string;
  period: 'weekly' | 'monthly' | 'yearly';
  startDate: Date;
  endDate: Date;
  totalWorkouts: number;
  totalDuration: number; // minutes
  totalCaloriesBurned: number;
  averageWorkoutDuration: number;
  workoutFrequency: number; // workouts per week
  muscleGroupDistribution: Record<string, number>; // e.g., { chest: 20, back: 15, ... }
  progress: {
    strength: number; // percentage change
    endurance: number; // percentage change
    flexibility: number; // percentage change
  };
}