import type { Exercise } from '../../types/workoutDay';
import { AlertIcon } from '../icons';
import { formatSeconds, titleCase } from './format';

interface ExerciseCardProps {
  exercise: Exercise;
}

/**
 * One exercise inside a workout day: name, prescription (sets × reps OR a
 * duration), rest, equipment, instructions and any safety note.
 */
export const ExerciseCard = ({ exercise }: ExerciseCardProps) => {
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

  return (
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
    </li>
  );
};
