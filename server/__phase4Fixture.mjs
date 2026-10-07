/**
 * TEMPORARY — Phase 4 verification fixture.
 *
 * Inserts a deterministic 7-day WorkoutPlan for a given test user so the
 * Start Workout → log → complete flow can be verified without depending on
 * Gemini availability. Exercises intentionally omit `exerciseId`, exactly like
 * typical AI-generated plans (that omission was the Phase-3 Start Workout bug).
 *
 * Usage: node __phase4Fixture.mjs <user-email>
 * Cleanup: delete the printed plan (or the whole test user) when done.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const exercise = (name, category, sets, reps) => ({
  name,
  category,
  muscleGroup: 'legs',
  equipment: 'bodyweight',
  sets,
  reps,
  restSeconds: 60,
  intensity: 'moderate',
  instructions: `Perform ${sets} sets of ${reps} reps of ${name} with controlled form.`,
  safetyNotes: 'Stop if you feel pain.',
  alternatives: [],
});

const days = DAYS.map((dayName, dayIndex) => {
  const restDay = dayIndex === 3 || dayIndex === 6; // thursday + sunday rest
  return {
    dayIndex,
    dayName,
    focus: restDay ? 'Rest & Recovery' : dayIndex % 2 === 0 ? 'Full Body Strength' : 'Cardio & Core',
    estimatedDuration: restDay ? 0 : 45,
    restDay,
    exercises: restDay
      ? []
      : [
          exercise('Bodyweight Squat', 'strength', 3, 12),
          exercise('Push-Up', 'strength', 3, 10),
          exercise('Plank', 'core', 3, 1),
          exercise('Lunge', 'strength', 3, 10),
        ],
  };
});

async function main() {
  const email = (process.argv[2] || readFileSync('/tmp/opencode/phase4_test_email.txt', 'utf8')).trim().toLowerCase();

  await mongoose.connect(process.env.MONGODB_URI);

  const db = mongoose.connection.db;
  const users = db.collection('users');
  const plans = db.collection('workoutplans');

  const user = await users.findOne({ email });
  if (!user) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  // Idempotent: drop any previous fixture plan for this user.
  await plans.deleteMany({ userId: user._id, title: 'Phase4 Fixture Plan' });

  const doc = {
    userId: user._id,
    title: 'Phase4 Fixture Plan',
    summary: 'Deterministic fixture plan used to verify workout logging and analytics.',
    goal: 'general_fitness',
    experienceLevel: 'beginner',
    totalWeeks: 1,
    weekNumber: 1,
    status: 'generated',
    days,
    aiMetadata: {
      model: 'fixture',
      promptVersion: 'v1',
      generatedAt: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await plans.insertOne(doc);
  console.log(JSON.stringify({ planId: result.insertedId.toString(), userId: user._id.toString(), email }));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
