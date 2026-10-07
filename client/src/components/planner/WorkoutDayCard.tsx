import type { WorkoutDay } from '../../types/workoutDay';
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

  if (day.restDay) {
    return <RestDayCard day={day} />;
  }

  const handleViewWorkout = () => {
    navigate(`/workout/${planId}/${day.dayIndex}`);
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

      {day.exercises.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {day.exercises.map((exercise, index) => (
            <ExerciseCard
              key={`${exercise.name}-${index}`}
              exercise={exercise}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No exercises listed for this day.</p>
      )}
      
      {/* View the planned workout before creating a session log. */}
      <div className="mt-4">
        <button
          onClick={handleViewWorkout}
          className="w-full af-btn-primary"
        >
          View Workout
        </button>
      </div>
    </section>
  );
};
