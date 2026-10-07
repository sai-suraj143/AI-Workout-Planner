export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  // Optional: password hash should not be exposed in client types
  // fitnessProfile?: FitnessProfile;
  // workoutPlans?: WorkoutPlan[];
  // workoutLogs?: WorkoutLog[];
}