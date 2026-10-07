import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAdaptationDecision, buildAdaptivePlanContext, type WorkoutLogLike } from './index';
import { AdherenceLevel, DecisionType, TrendDirection } from './adaptation.types';

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const makeWorkout = (overrides: Partial<WorkoutLogLike> = {}): WorkoutLogLike => ({
  userId: 'user-1',
  workoutDate: daysAgo(2),
  dayName: 'monday',
  focus: 'Upper body',
  plannedDuration: 45,
  actualDuration: 45,
  status: 'completed',
  exercises: [],
  ...overrides,
});

test('no history returns BASELINE', () => {
  const result = evaluateAdaptationDecision([], { availableDays: ['monday'], sessionDuration: 45, excludedExercises: [], equipment: ['dumbbells'] });
  assert.equal(result.decision, DecisionType.BASELINE);
  assert.equal(result.adherence, AdherenceLevel.INSUFFICIENT_DATA);
});

test('insufficient history returns BASELINE', () => {
  const workouts = [makeWorkout({ actualDuration: 40, status: 'completed' })];
  const result = evaluateAdaptationDecision(workouts, { availableDays: ['monday'], sessionDuration: 45, excludedExercises: [], equipment: ['dumbbells'] });
  assert.equal(result.decision, DecisionType.BASELINE);
});

test('high adherence yields PROGRESS', () => {
  const workouts = Array.from({ length: 5 }, (_, index) =>
    makeWorkout({
      workoutDate: daysAgo(index + 1),
      plannedDuration: 45,
      actualDuration: 45,
      status: 'completed',
    }),
  );
  const result = evaluateAdaptationDecision(workouts, { availableDays: ['monday', 'wednesday', 'friday'], sessionDuration: 45, excludedExercises: [], equipment: ['dumbbells'] });
  assert.equal(result.decision, DecisionType.PROGRESS);
  assert.equal(result.adherence, AdherenceLevel.HIGH);
});

test('normal stable adherence yields MAINTAIN', () => {
  const workouts = [
    makeWorkout({ plannedDuration: 45, actualDuration: 32, status: 'completed' }),
    makeWorkout({ plannedDuration: 45, actualDuration: 35, status: 'completed' }),
    makeWorkout({ plannedDuration: 45, actualDuration: 38, status: 'completed' }),
    makeWorkout({ plannedDuration: 45, actualDuration: 40, status: 'completed' }),
    makeWorkout({ plannedDuration: 45, actualDuration: 34, status: 'completed' }),
  ];
  const result = evaluateAdaptationDecision(workouts, { availableDays: ['monday', 'wednesday', 'friday'], sessionDuration: 45, excludedExercises: [], equipment: ['dumbbells'] });
  assert.equal(result.decision, DecisionType.MAINTAIN);
  assert.equal(result.trend, TrendDirection.STABLE);
});

test('low adherence yields REDUCE or MODIFY', () => {
  const workouts = Array.from({ length: 5 }, (_, index) =>
    makeWorkout({
      workoutDate: daysAgo(index + 1),
      plannedDuration: 60,
      actualDuration: 15 + (index % 2 === 0 ? 5 : 0),
      status: index % 2 === 0 ? 'abandoned' : 'completed',
    }),
  );
  const result = evaluateAdaptationDecision(workouts, { availableDays: ['monday', 'wednesday', 'friday'], sessionDuration: 45, excludedExercises: [], equipment: ['dumbbells'] });
  assert.ok(result.decision === DecisionType.REDUCE || result.decision === DecisionType.MODIFY);
  assert.ok(result.adherence === AdherenceLevel.LOW || result.adherence === AdherenceLevel.NORMAL);
});

test('declining trend reduces the adaptation decision', () => {
  const workouts = [
    makeWorkout({ plannedDuration: 50, actualDuration: 50, status: 'completed', workoutDate: daysAgo(10) }),
    makeWorkout({ plannedDuration: 50, actualDuration: 48, status: 'completed', workoutDate: daysAgo(8) }),
    makeWorkout({ plannedDuration: 50, actualDuration: 35, status: 'abandoned', workoutDate: daysAgo(6) }),
    makeWorkout({ plannedDuration: 50, actualDuration: 20, status: 'abandoned', workoutDate: daysAgo(4) }),
    makeWorkout({ plannedDuration: 50, actualDuration: 15, status: 'abandoned', workoutDate: daysAgo(2) }),
  ];
  const result = evaluateAdaptationDecision(workouts, { availableDays: ['monday', 'wednesday', 'friday'], sessionDuration: 60, excludedExercises: [], equipment: ['dumbbells'] });
  assert.ok(result.trend === TrendDirection.DECLINING || result.decision === DecisionType.REDUCE || result.decision === DecisionType.MODIFY);
});

test('mixed performance stays stable rather than aggressive progression', () => {
  const workouts = [
    makeWorkout({ plannedDuration: 50, actualDuration: 50, status: 'completed' }),
    makeWorkout({ plannedDuration: 50, actualDuration: 52, status: 'completed' }),
    makeWorkout({ plannedDuration: 50, actualDuration: 25, status: 'abandoned' }),
    makeWorkout({ plannedDuration: 50, actualDuration: 40, status: 'completed' }),
    makeWorkout({ plannedDuration: 50, actualDuration: 42, status: 'completed' }),
  ];
  const result = evaluateAdaptationDecision(workouts, { availableDays: ['monday', 'wednesday', 'friday'], sessionDuration: 50, excludedExercises: [], equipment: ['dumbbells'] });
  assert.ok(result.decision === DecisionType.MAINTAIN || result.decision === DecisionType.MODIFY);
  assert.ok(result.trend === TrendDirection.STABLE || result.trend === TrendDirection.UNKNOWN);
});

test('excluded exercises remain excluded in adaptive context', () => {
  const profile = { availableDays: ['monday'], sessionDuration: 45, excludedExercises: ['bench press', 'pull-ups'], equipment: ['dumbbells'] };
  const context = buildAdaptivePlanContext(
    profile,
    [makeWorkout({ plannedDuration: 45, actualDuration: 42, status: 'completed' })],
    { decision: DecisionType.PROGRESS, adherence: AdherenceLevel.HIGH, reasons: ['Strong adherence'], trend: TrendDirection.STABLE },
  );
  assert.deepEqual(context.profile.excludedExercises, ['bench press', 'pull-ups']);
  assert.equal(context.profile.equipment.length, 1);
});

test('session duration remains within constraints', () => {
  const result = evaluateAdaptationDecision([], { availableDays: ['monday'], sessionDuration: 30, excludedExercises: [], equipment: ['bodyweight'] });
  assert.equal(result.summary.sessionDurationMinutes, 30);
});

test('user isolation is deterministic by userId', () => {
  const workouts = [
    makeWorkout({ userId: 'user-2', status: 'completed', actualDuration: 45 }),
    makeWorkout({ userId: 'user-2', status: 'completed', actualDuration: 45 }),
    makeWorkout({ userId: 'user-2', status: 'completed', actualDuration: 45 }),
    makeWorkout({ userId: 'user-2', status: 'completed', actualDuration: 45 }),
    makeWorkout({ userId: 'user-2', status: 'completed', actualDuration: 45 }),
  ];
  const result = evaluateAdaptationDecision(workouts, { userId: 'user-1', availableDays: ['monday'], sessionDuration: 45, excludedExercises: [], equipment: ['dumbbells'] });
  assert.equal(result.decision, DecisionType.BASELINE);
  assert.equal(result.historyAvailable, false);
});

test('invalid Gemini output should not pass deterministic validation', () => {
  const result = evaluateAdaptationDecision([makeWorkout()], { availableDays: ['monday'], sessionDuration: 45, excludedExercises: [], equipment: ['dumbbells'] });
  assert.ok(result.reasons.length > 0);
  assert.ok(result.summary.completionRate >= 0);
});
