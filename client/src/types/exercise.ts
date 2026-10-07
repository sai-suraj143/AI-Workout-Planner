export interface Exercise {
  id: string;
  name: string;
  description: string;
  muscleGroups: string[];
  equipmentNeeded: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  // Instructions or video URL could be added
}