import test from 'node:test';
import assert from 'node:assert/strict';

import { WorkoutPlanService, PlanServiceError } from './services/workoutPlan.service';
import { ProfileService } from './services/profileService';
import { WorkoutLog } from './models/WorkoutLog';
import { WorkoutPlan } from './models/WorkoutPlan';

test('exercise substitution updates only the targeted exercise', async () => {
  const originalPlan = {
    _id: '66a000000000000000000001',
    userId: '66a000000000000000000099',
    days: [
      {
        dayIndex: 0,
        dayName: 'monday',
        focus: 'Upper body',
        estimatedDuration: 45,
        restDay: false,
        exercises: [
          {
            name: 'Bench Press',
            category: 'strength',
            equipment: 'barbell',
            sets: 4,
            reps: 8,
            instructions: 'Press the barbell from the chest.',
            restSeconds: 90,
            alternatives: ['Dumbbell Press'],
          },
          {
            name: 'Barbell Row',
            category: 'strength',
            equipment: 'barbell',
            sets: 3,
            reps: 10,
            instructions: 'Row the barbell with a neutral spine.',
            restSeconds: 60,
          },
        ],
      },
    ],
  } as any;

  const oldFindOne = WorkoutPlan.findOne;
  const oldFindOneAndUpdate = (WorkoutPlan as any).findOneAndUpdate;
  const oldLogFind = (WorkoutLog as any).find;
  const oldGetProfile = ProfileService.getProfileByUserId;

  try {
    (WorkoutPlan as any).findOne = async () => originalPlan;
    (WorkoutPlan as any).findOneAndUpdate = async () => ({
      ...originalPlan,
      days: [
        {
          ...originalPlan.days[0],
          exercises: [
            {
              name: 'Dumbbell Press',
              category: 'strength',
              equipment: 'dumbbells',
              sets: 4,
              reps: 8,
              instructions: 'Press the dumbbells while seated.',
              restSeconds: 75,
              alternatives: ['Bench Press'],
            },
            originalPlan.days[0].exercises[1],
          ],
        },
      ],
      aiMetadata: { generationType: 'exercise_substitution' },
    });
    (WorkoutLog as any).find = async () => [];
    ProfileService.getProfileByUserId = async () => ({
      goal: 'strength',
      experienceLevel: 'intermediate',
      trainingLocation: 'gym',
      equipment: ['barbell', 'dumbbells'],
      availableDays: ['monday'],
      sessionDuration: 45,
      preferredActivities: [],
      excludedExercises: [],
      sport: 'none',
      sportName: '',
      additionalNotes: '',
    } as any);

    const service = new WorkoutPlanService(async () => ({
      data: { exercise: { name: 'Dumbbell Press', category: 'strength', equipment: 'dumbbells', sets: 4, reps: 8, instructions: 'Press the dumbbells while seated.', restSeconds: 75, alternatives: ['Bench Press'] } },
      model: 'gemini-1.5-flash',
      durationMs: 100,
    }));

    const result = await service.substituteExerciseForUser('66a000000000000000000099', '66a000000000000000000001', 0, 0, {
      reason: 'equipment_unavailable',
      notes: 'The barbell is unavailable today.',
    });

    assert.equal(result.day.exercises[0].name, 'Dumbbell Press');
    assert.equal(result.day.exercises[1].name, 'Barbell Row');
    assert.equal(result.plan.aiMetadata?.generationType, 'exercise_substitution');
  } finally {
    (WorkoutPlan as any).findOne = oldFindOne;
    (WorkoutPlan as any).findOneAndUpdate = oldFindOneAndUpdate;
    (WorkoutLog as any).find = oldLogFind;
    ProfileService.getProfileByUserId = oldGetProfile;
  }
});

test('day regeneration preserves other days and rejects completed days', async () => {
  const originalPlan = {
    _id: '66a000000000000000000002',
    userId: '66a000000000000000000099',
    days: [
      { dayIndex: 0, dayName: 'monday', focus: 'Push', estimatedDuration: 45, restDay: false, exercises: [{ name: 'Push-up', category: 'strength', instructions: 'Do 10 reps', restSeconds: 60 }] },
      { dayIndex: 1, dayName: 'tuesday', focus: 'Pull', estimatedDuration: 45, restDay: false, exercises: [{ name: 'Pull-up', category: 'strength', instructions: 'Do 8 reps', restSeconds: 60 }] },
    ],
  } as any;

  const oldFindOne = WorkoutPlan.findOne;
  const oldFindOneAndUpdate = (WorkoutPlan as any).findOneAndUpdate;
  const oldLogFind = (WorkoutLog as any).find;
  const oldGetProfile = ProfileService.getProfileByUserId;

  try {
    (WorkoutPlan as any).findOne = async () => originalPlan;
    (WorkoutPlan as any).findOneAndUpdate = async () => originalPlan;
    (WorkoutLog as any).find = async () => [{ status: 'completed' }];
    ProfileService.getProfileByUserId = async () => ({
      goal: 'general_fitness',
      experienceLevel: 'beginner',
      trainingLocation: 'home',
      equipment: ['bodyweight'],
      availableDays: ['monday', 'tuesday'],
      sessionDuration: 45,
      preferredActivities: [],
      excludedExercises: [],
      sport: 'none',
      sportName: '',
      additionalNotes: '',
    } as any);

    const service = new WorkoutPlanService(async () => ({
      data: { day: { dayIndex: 1, dayName: 'tuesday', focus: 'Pull', estimatedDuration: 40, restDay: false, exercises: [{ name: 'Band Row', category: 'strength', equipment: 'resistance_bands', sets: 3, reps: 12, instructions: 'Row the band.', restSeconds: 60 }] } },
      model: 'gemini-1.5-flash',
      durationMs: 100,
    }));

    await assert.rejects(
      () => service.regenerateDayForUser('66a000000000000000000099', '66a000000000000000000002', 1, { notes: 'Need variation' }),
      (error) => error instanceof PlanServiceError && /completed/.test(error.message),
    );
  } finally {
    (WorkoutPlan as any).findOne = oldFindOne;
    (WorkoutPlan as any).findOneAndUpdate = oldFindOneAndUpdate;
    (WorkoutLog as any).find = oldLogFind;
    ProfileService.getProfileByUserId = oldGetProfile;
  }
});
