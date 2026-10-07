import {
  DayOfWeek,
  ExperienceLevel,
  ExerciseCategory,
  FitnessGoal,
  IntensityLevel,
} from '../models/WorkoutPlan';
import type { AIWorkoutPlanInput } from '../validators/workoutPlanValidators';

/**
 * Normalisation stage: runs AFTER Zod validation and BEFORE MongoDB.
 *
 * Responsibilities (Phase 2 §10):
 *  - trim / collapse whitespace in single-line text
 *  - turn `null` into "field absent"
 *  - give numeric fields their schema defaults (restSeconds)
 *  - make dayIndex consistent with dayName
 *  - strip exercises that are attached to a rest day
 *  - remove accidental duplicate exercises within a day
 *  - take goal / experienceLevel from the profile (the profile is the source
 *    of truth, so a plan can never contradict the profile it was made for)
 *
 * It does NOT repair structurally invalid output — that is rejected upstream by
 * the Zod schema and handled by the single controlled retry.
 */

export interface NormalizedExercise {
  name: string;
  category: ExerciseCategory;
  instructions: string;
  /** Always present after normalisation so the UI never reads undefined. */
  restSeconds: number;
  /** Always an array after normalisation. */
  alternatives: string[];
  exerciseId?: string;
  muscleGroup?: string;
  equipment?: string;
  sets?: number;
  reps?: number;
  durationSeconds?: number;
  intensity?: IntensityLevel;
  safetyNotes?: string;
}

export interface NormalizedWorkoutDay {
  dayIndex: number;
  dayName: DayOfWeek;
  focus: string;
  estimatedDuration: number;
  restDay: boolean;
  exercises: NormalizedExercise[];
}

export interface NormalizedWorkoutPlan {
  title: string;
  summary: string;
  goal: FitnessGoal;
  experienceLevel: ExperienceLevel;
  totalWeeks: number;
  weekNumber: number;
  days: NormalizedWorkoutDay[];
}

/** monday = 0 … sunday = 6, matching DayOfWeek order and availableDays order. */
export const DAY_ORDER: readonly DayOfWeek[] = DayOfWeek;

const singleLine = (value: string): string => value.replace(/\s+/g, ' ').trim();
const multiLine = (value: string): string =>
  value
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
};

const normalizeExercise = (
  exercise: AIWorkoutPlanInput['days'][number]['exercises'][number],
): NormalizedExercise => {
  const normalized: NormalizedExercise = {
    name: singleLine(exercise.name),
    category: exercise.category,
    instructions: multiLine(exercise.instructions) || singleLine(exercise.name),
    restSeconds: exercise.restSeconds ?? 60,
    alternatives: dedupe(
      (exercise.alternatives ?? []).map((alternative) => singleLine(alternative)),
    ),
  };

  if (exercise.exerciseId) normalized.exerciseId = singleLine(exercise.exerciseId);
  if (exercise.muscleGroup) normalized.muscleGroup = singleLine(exercise.muscleGroup);
  if (exercise.equipment) normalized.equipment = singleLine(exercise.equipment);
  if (exercise.intensity) normalized.intensity = exercise.intensity;
  if (exercise.safetyNotes) normalized.safetyNotes = singleLine(exercise.safetyNotes);
  if (exercise.sets != null) normalized.sets = exercise.sets;
  if (exercise.reps != null) normalized.reps = exercise.reps;
  if (exercise.durationSeconds != null) normalized.durationSeconds = exercise.durationSeconds;

  return normalized;
};

export const normalizeWorkoutPlan = (
  input: AIWorkoutPlanInput,
  source: { goal: FitnessGoal; experienceLevel: ExperienceLevel },
): NormalizedWorkoutPlan => {
  const days: NormalizedWorkoutDay[] = input.days.map((day) => {
    const restDay = day.restDay;

    // Rest days carry no exercise payload, whatever the model sent back.
    const seenNames = new Set<string>();
    const exercises = restDay
      ? []
      : day.exercises
          .map(normalizeExercise)
          .filter((exercise) => {
            const key = exercise.name.toLowerCase();
            if (seenNames.has(key)) return false;
            seenNames.add(key);
            return true;
          });

    return {
      dayIndex: DAY_ORDER.indexOf(day.dayName),
      dayName: day.dayName,
      focus: singleLine(day.focus),
      estimatedDuration: Math.max(0, day.estimatedDuration),
      restDay,
      exercises,
    };
  });

  // dayName values are unique and cover the full week (enforced by the schema),
  // so ordering by the canonical week keeps the UI's day mapping stable.
  days.sort((a, b) => a.dayIndex - b.dayIndex);

  return {
    title: singleLine(input.title),
    summary: multiLine(input.summary),
    goal: source.goal,
    experienceLevel: source.experienceLevel,
    totalWeeks: input.totalWeeks,
    weekNumber: input.weekNumber,
    days,
  };
};
