import { useState, type FormEvent } from 'react';
import type { Exercise } from '../../types/workoutDay';
import { planErrorMessage, useSubstituteExercise } from '../../services/planService';
import { AlertIcon } from '../icons';
import { formatSeconds, titleCase } from './format';

interface ExerciseCardProps {
  exercise: Exercise;
  planId: string;
  dayIndex: number;
  exerciseIndex: number;
}

const replacementReasons = [
  { value: 'equipment_unavailable', label: 'Equipment unavailable' },
  { value: 'dont_prefer', label: 'Don\'t prefer' },
  { value: 'too_difficult', label: 'Too difficult' },
  { value: 'too_easy', label: 'Too easy' },
  { value: 'different_variation', label: 'Different variation' },
  { value: 'other', label: 'Other' },
] as const;

/**
 * One exercise inside a workout day: name, prescription (sets × reps OR a
 * duration), rest, equipment, instructions and any safety note.
 */
export const ExerciseCard = ({ exercise, planId, dayIndex, exerciseIndex }: ExerciseCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<(typeof replacementReasons)[number]['value']>('equipment_unavailable');
  const [notes, setNotes] = useState('');
  const substituteMutation = useSubstituteExercise();

  const prescription: string[] = [];

  if (exercise.sets && exercise.reps) {
    prescription.push(`${exercise.sets} × ${exercise.reps} reps`);
  } else if (exercise.sets) {
    prescription.push(`${exercise.sets} sets`);
  } else if (exercise.reps) {
    prescription.push(`${exercise.reps} reps`);
  }

  if (exercise.durationSeconds !== undefined) {
    prescription.push(formatSeconds(exercise.durationSeconds));
  }

  if (exercise.restSeconds > 0) {
    prescription.push(`${formatSeconds(exercise.restSeconds)} rest`);
  }

  const meta: string[] = [titleCase(exercise.category)];
  if (exercise.muscleGroup) meta.push(titleCase(exercise.muscleGroup));
  if (exercise.equipment) meta.push(titleCase(exercise.equipment));
  if (exercise.intensity) meta.push(`${titleCase(exercise.intensity)} intensity`);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await substituteMutation.mutateAsync({
        planId,
        dayIndex,
        exerciseIndex,
        reason,
        notes: notes.trim() || undefined,
      });
      setIsOpen(false);
      setNotes('');
    } catch {
      // The error is surfaced inline below.
    }
  };

  return (
    <>
      <li className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h4 className="text-sm font-semibold text-slate-900">{exercise.name}</h4>
          <p className="text-xs font-medium text-slate-500">{meta.join(' · ')}</p>
        </div>

        {prescription.length > 0 && (
          <p className="mt-1.5 text-sm font-medium text-brand-700">{prescription.join(' · ')}</p>
        )}

        <p className="mt-2 text-sm leading-relaxed text-slate-600">{exercise.instructions}</p>

        {exercise.safetyNotes && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-800">
            <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>
              <span className="font-semibold">Safety: </span>
              {exercise.safetyNotes}
            </span>
          </p>
        )}

        {exercise.alternatives && exercise.alternatives.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            <span className="font-semibold">Alternatives: </span>
            {exercise.alternatives.join(', ')}
          </p>
        )}

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none"
          >
            Replace
          </button>
        </div>
      </li>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">Replace exercise</h3>
            <p className="mt-1 text-sm text-slate-500">Find a suitable alternative for {exercise.name}.</p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor={`reason-${exerciseIndex}`} className="mb-1 block text-sm font-medium text-slate-700">
                  Reason
                </label>
                <select
                  id={`reason-${exerciseIndex}`}
                  value={reason}
                  onChange={(event) => setReason(event.target.value as (typeof replacementReasons)[number]['value'])}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                >
                  {replacementReasons.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`notes-${exerciseIndex}`} className="mb-1 block text-sm font-medium text-slate-700">
                  Notes (optional)
                </label>
                <textarea
                  id={`notes-${exerciseIndex}`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={300}
                  rows={4}
                  placeholder="Add any context for the replacement."
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-700 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              {substituteMutation.error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {planErrorMessage(substituteMutation.error, 'We could not find a replacement for this exercise.')}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={substituteMutation.isPending}
                  className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
                >
                  {substituteMutation.isPending ? 'Finding a suitable replacement...' : 'Find Replacement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
