import type { WorkoutDay } from '../../types/workoutDay';
import { planErrorMessage, useRegenerateDay } from '../../services/planService';
import { ExerciseCard } from './ExerciseCard';
import { RestDayCard } from './RestDayCard';
import { formatDay, formatMinutes, pluralise } from './format';
import { useNavigate } from 'react-router-dom';

interface WorkoutDayCardProps {
  day: WorkoutDay;
  planId: string;
}

/** One day of the week: either a recovery day or a full training session. */
export const WorkoutDayCard = ({ day, planId }: WorkoutDayCardProps) => {
  const navigate = useNavigate();
  const regenerateMutation = useRegenerateDay();

  if (day.restDay) {
    return <RestDayCard day={day} />;
  }

  const handleViewWorkout = () => {
    navigate(`/workout/${planId}/${day.dayIndex}`);
  };

  const handleRegenerateDay = async () => {
    if (!window.confirm(`Regenerate ${formatDay(day.dayName)}?\n\nThis will replace the planned exercises for this day. Completed workout history will not be changed.`)) {
      return;
    }

    try {
      await regenerateMutation.mutateAsync({
        planId,
        dayIndex: day.dayIndex,
        reason: 'user_requested_regeneration',
        notes: 'Refresh this day while preserving the rest of the plan.',
      });
    } catch {
      // Error is surfaced inline below.
    }
  };

  return (
    <section
      aria-label={`${formatDay(day.dayName)} workout`}
      className="af-panel"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold tracking-tight text-slate-900">
            {formatDay(day.dayName)}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">{day.focus}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
          <span className="af-badge">{formatMinutes(day.estimatedDuration)}</span>
          <span className="af-badge">{pluralise(day.exercises.length, 'exercise')}</span>
        </div>
      </header>

      {regenerateMutation.error && (
        <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {planErrorMessage(regenerateMutation.error, 'We could not regenerate this day.')}
        </div>
      )}

      {day.exercises.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {day.exercises.map((exercise, index) => (
            <ExerciseCard
              key={`${exercise.name}-${index}`}
              exercise={exercise}
              planId={planId}
              dayIndex={day.dayIndex}
              exerciseIndex={index}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No exercises listed for this day.</p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={handleRegenerateDay}
          disabled={regenerateMutation.isPending}
          className="rounded-xl border border-brand-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 focus-visible:ring-4 focus-visible:ring-brand-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {regenerateMutation.isPending ? 'Regenerating…' : 'Regenerate Day'}
        </button>
        <button
          type="button"
          onClick={handleViewWorkout}
          className="flex-1 af-btn-primary"
        >
          View Workout
        </button>
      </div>
    </section>
  );
};
