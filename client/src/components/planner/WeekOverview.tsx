import type { WorkoutDay } from '../../types/workoutDay';
import { formatDay, formatMinutes, pluralise } from './format';

interface WeekOverviewProps {
  days: WorkoutDay[];
}

/** Scannable one-glance summary of the whole week. */
export const WeekOverview = ({ days }: WeekOverviewProps) => (
  <section aria-label="Week overview" className="af-panel">
    <h2 className="text-lg font-bold tracking-tight text-slate-900">Week overview</h2>
    <p className="mt-1 text-sm text-slate-500">
      Your training days, recovery days and session focus at a glance.
    </p>

    <ol className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((day) => (
        <li
          key={`${day.dayIndex}-${day.dayName}`}
          className={
            day.restDay
              ? 'rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3'
              : 'rounded-xl border border-slate-200 bg-white p-3 shadow-sm'
          }
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {formatDay(day.dayName)}
          </p>

          {day.restDay ? (
            <p className="mt-1.5 text-sm font-medium text-slate-500">Rest</p>
          ) : (
            <>
              <p className="mt-1.5 line-clamp-2 text-sm font-medium text-slate-800">
                {day.focus}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatMinutes(day.estimatedDuration)} · {pluralise(day.exercises.length, 'exercise')}
              </p>
            </>
          )}
        </li>
      ))}
    </ol>
  </section>
);
