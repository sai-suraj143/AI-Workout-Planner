import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { StepProps } from '../../types/onboarding';
import SelectionCard from './SelectionCard';

const ACTIVITY_OPTIONS = [
  'Strength training',
  'Cardio',
  'Walking',
  'Running',
  'Cycling',
  'Mobility',
  'Bodyweight training',
  'Sports',
  'HIIT',
  'Yoga',
  'Pilates',
  'Dance',
  'Swimming',
] as const;

const COMMON_EXERCISES = [
  'Burpees',
  'Jumping jacks',
  'Push-ups',
  'Pull-ups',
  'Squats',
  'Lunges',
  'Plank',
  'Sit-ups',
] as const;

const toggleFrom = (list: string[], item: string): string[] =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

const StepPreferences = ({ value, onChange }: StepProps) => {
  const [exerciseToAdd, setExerciseToAdd] = useState('');

  const handleAddExercise = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = exerciseToAdd.trim();
    if (!name) return;

    const alreadyExcluded = value.excludedExercises.some(
      (entry) => entry.toLowerCase() === name.toLowerCase(),
    );
    if (!alreadyExcluded) {
      onChange({ excludedExercises: [...value.excludedExercises, name] });
    }
    setExerciseToAdd('');
  };

  const handleRemoveExercise = (item: string) => {
    onChange({ excludedExercises: value.excludedExercises.filter((entry) => entry !== item) });
  };

  return (
    <div className="space-y-7">
      <div>
        <h2
          id="onboarding-activities-heading"
          className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
        >
          What types of activities do you enjoy?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          We will lean your plan towards the things you actually like doing.
        </p>
      </div>

      <section className="space-y-3">
        <h3 id="onboarding-activities-label" className="text-base font-semibold text-slate-900">
          Preferred activities
        </h3>
        <p className="text-sm text-slate-500">Optional — select any that apply.</p>

        <div
          role="group"
          aria-labelledby="onboarding-activities-label"
          className="flex flex-wrap gap-2"
        >
          {ACTIVITY_OPTIONS.map((activity) => (
            <SelectionCard
              key={activity}
              type="checkbox"
              name="onboarding-activities"
              variant="chip"
              value={activity}
              label={activity}
              checked={value.preferredActivities.includes(activity)}
              onChange={(selected) =>
                onChange({ preferredActivities: toggleFrom(value.preferredActivities, selected) })
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 id="onboarding-exclusions-heading" className="text-base font-semibold text-slate-900">
          Exercises you would rather avoid
        </h3>
        <p className="text-sm text-slate-500">
          Optional — anything you pick here will be left out of your plan entirely.
        </p>

        <div
          role="group"
          aria-labelledby="onboarding-exclusions-heading"
          className="flex flex-wrap gap-2"
        >
          {COMMON_EXERCISES.map((exercise) => (
            <SelectionCard
              key={exercise}
              type="checkbox"
              name="onboarding-exclusions"
              variant="chip"
              value={exercise}
              label={exercise}
              checked={value.excludedExercises.includes(exercise)}
              onChange={(selected) =>
                onChange({ excludedExercises: toggleFrom(value.excludedExercises, selected) })
              }
            />
          ))}
        </div>

        <form
          onSubmit={handleAddExercise}
          className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4"
        >
          <label htmlFor="custom-exclusion" className="af-label">
            Add your own
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="custom-exclusion"
              type="text"
              value={exerciseToAdd}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setExerciseToAdd(event.target.value)
              }
              placeholder="e.g. Barbell bench press"
              maxLength={80}
              className="af-input sm:flex-1"
            />
            <button
              type="submit"
              disabled={exerciseToAdd.trim() === ''}
              className="af-btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add
            </button>
          </div>

          {value.excludedExercises.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {value.excludedExercises.map((exercise) => (
                <li key={exercise}>
                  <button
                    type="button"
                    onClick={() => handleRemoveExercise(exercise)}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-2 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none"
                  >
                    <span className="truncate">{exercise}</span>
                    <span aria-hidden="true" className="text-sm leading-none text-slate-400">
                      ×
                    </span>
                    <span className="sr-only">Stop excluding {exercise}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="af-hint">Nothing excluded yet.</p>
          )}
        </form>
      </section>
    </div>
  );
};

export default StepPreferences;
