import type { WorkoutDay } from '../../types/workoutDay';
import { formatDay } from './format';

interface RestDayCardProps {
  day: WorkoutDay;
}

/** Recovery day: deliberately quiet, clearly not a training session. */
export const RestDayCard = ({ day }: RestDayCardProps) => (
  <section
    aria-label={`${formatDay(day.dayName)} is a rest day`}
    className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"
  >
    <div className="flex items-center gap-2">
      <span className="af-badge bg-slate-100 text-slate-600">Rest day</span>
      <h3 className="text-sm font-semibold text-slate-700">{formatDay(day.dayName)}</h3>
    </div>
    <p className="mt-2 text-sm leading-relaxed text-slate-600">
      {day.focus || 'Recovery and light movement.'}
    </p>
    <p className="mt-1 text-xs leading-relaxed text-slate-500">
      Recovery is when your body adapts. Stretch, take a walk, or rest completely — whatever
      feels good today.
    </p>
  </section>
);
