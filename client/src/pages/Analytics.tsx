import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BoltIcon } from '../components/icons';
import { analyticsErrorMessage, useAnalytics } from '../services/analyticsService';
import type { AnalyticsRange, AnalyticsSummary, RecentActivityEntry } from '../types/analytics';

const RANGE_OPTIONS: AnalyticsRange[] = ['7d', '30d', '90d'];

const EMPTY_ANALYTICS: AnalyticsSummary = {
  totalWorkouts: 0,
  completedWorkouts: 0,
  abandonedWorkouts: 0,
  inProgressWorkouts: 0,
  completionRate: 0,
  totalPlannedMinutes: 0,
  totalActualMinutes: 0,
  averageActualMinutes: 0,
  frequency: [],
  plannedVsActual: [],
  completion: { completed: 0, abandoned: 0 },
  exercisePerformance: [],
  recentActivity: [],
  streaks: { currentStreak: 0, longestStreak: 0 },
};

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
};

const STATUS_COLORS: Record<string, string> = {
  completed: '#16a34a',
  abandoned: '#f59e0b',
  in_progress: '#4f46e5',
};

const PIE_COLORS = ['#4f46e5', '#f59e0b'];

const formatMinutes = (minutes: number | undefined): string => {
  const value = typeof minutes === 'number' && Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return `${Math.round(value)} min`;
};

const formatPercent = (value: number | undefined): string => {
  const safeValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return `${Math.round(safeValue)}%`;
};

const formatShortDate = (value: string | Date | undefined): string => {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const formatLongDate = (value: string | Date | undefined): string => {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const summaryStatusLabel = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'abandoned':
      return 'Abandoned';
    case 'in_progress':
      return 'In Progress';
    default:
      return 'Workout';
  }
};

const SummaryCard = ({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
}) => (
  <div className="af-panel">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        {icon}
      </span>
    </div>
    <p className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
    {helper ? <p className="mt-2 text-sm text-slate-500">{helper}</p> : null}
  </div>
);

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const [range, setRange] = useState<AnalyticsRange>('7d');
  const { data: analytics, isLoading, error, refetch } = useAnalytics(range);

  const data = analytics ?? EMPTY_ANALYTICS;
  const hasCompletedWorkouts = (data.completedWorkouts ?? 0) > 0;

  const frequencyData = useMemo(
    () =>
      Array.isArray(data.frequency)
        ? data.frequency.map((entry) => ({
            ...entry,
            label: formatShortDate(entry.date),
          }))
        : [],
    [data.frequency],
  );

  const plannedVsActualData = useMemo(
    () =>
      Array.isArray(data.plannedVsActual)
        ? data.plannedVsActual.map((entry) => ({
            ...entry,
            label: formatShortDate(entry.date),
          }))
        : [],
    [data.plannedVsActual],
  );

  const completionData = useMemo(
    () => {
      const completed = Number(data.completion?.completed ?? 0);
      const abandoned = Number(data.completion?.abandoned ?? 0);
      return [
        { name: 'Completed', value: completed },
        { name: 'Abandoned', value: abandoned },
      ];
    },
    [data.completion],
  );

  const completionChartHasData = completionData.some((entry) => Number(entry.value) > 0);
  const summaryCards = [
    {
      label: 'Completed Workouts',
      value: String(data.completedWorkouts ?? 0),
      helper: `${data.totalWorkouts ?? 0} total logged`,
      icon: <BoltIcon className="h-4 w-4" />,
    },
    {
      label: 'Completion Rate',
      value: formatPercent(data.completionRate),
      helper: `${data.completion?.completed ?? 0} completed / ${data.completion?.abandoned ?? 0} abandoned`,
      icon: <BoltIcon className="h-4 w-4" />,
    },
    {
      label: 'Total Workout Time',
      value: formatMinutes(data.totalActualMinutes),
      helper: `Planned ${formatMinutes(data.totalPlannedMinutes)}`,
      icon: <BoltIcon className="h-4 w-4" />,
    },
    {
      label: 'Current Streak',
      value: `${data.streaks?.currentStreak ?? 0} days`,
      helper: `Best ${data.streaks?.longestStreak ?? 0} days`,
      icon: <BoltIcon className="h-4 w-4" />,
    },
  ];

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-7">
          <p className="text-sm font-medium text-brand-600">Progress analytics</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Loading your stats…
          </h1>
        </header>
        <div className="mb-6 flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <div key={option} className="h-11 w-20 animate-pulse rounded-xl bg-slate-200" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`summary-${index}`} className="af-panel animate-pulse">
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="mt-4 h-8 w-20 rounded bg-slate-200" />
              <div className="mt-3 h-3 w-28 rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={`chart-${index}`} className="af-panel animate-pulse">
              <div className="h-5 w-32 rounded bg-slate-200" />
              <div className="mt-6 h-64 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="af-card p-8 text-center">
          <span className="af-brand-mark mx-auto mb-5">
            <BoltIcon />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Unable to load analytics right now.</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {analyticsErrorMessage(error, 'Something went wrong while loading your progress data.')}
          </p>
          <button type="button" onClick={() => void refetch()} className="af-btn-primary mt-6 mx-auto w-auto px-6">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl overflow-x-hidden">
      <header className="mb-7">
        <p className="text-sm font-medium text-brand-600">Progress analytics</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Progress Analytics
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-500">
          Track your consistency and compare planned workouts with what you actually completed.
        </p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2" aria-label="Date range selector">
        {RANGE_OPTIONS.map((option) => {
          const selected = option === range;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={selected}
              className={[
                'rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors',
                selected
                  ? 'border-brand-600 bg-brand-600 text-white shadow-lg shadow-brand-600/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              {RANGE_LABELS[option]}
            </button>
          );
        })}
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label="Analytics summary cards">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            icon={card.icon}
          />
        ))}
      </section>

      {!hasCompletedWorkouts ? (
        <section className="af-panel mt-6">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">No completed workouts yet.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
            Completing workouts will populate your progress analytics, including consistency trends,
            durations, and recent activity.
          </p>
        </section>
      ) : null}

      {hasCompletedWorkouts ? (
        <>
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="af-panel">
              <div className="mb-4">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Workout frequency</h2>
                <p className="text-sm text-slate-500">Workouts logged across the selected period.</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={frequencyData} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value) => [`${Number(value ?? 0)} workouts`, 'Workouts']}
                      labelFormatter={(label) => `${label}`}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="#4f46e5" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="af-panel">
              <div className="mb-4">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Planned vs actual</h2>
                <p className="text-sm text-slate-500">Comparing planned duration with completed session duration.</p>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={plannedVsActualData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value, name) => [`${Number(value ?? 0)} min`, name === 'plannedMinutes' ? 'Planned' : 'Actual']}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="plannedMinutes" name="Planned" stroke="#94a3b8" strokeWidth={3} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="actualMinutes" name="Actual" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1.9fr]">
            <div className="af-panel">
              <div className="mb-4">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Completion breakdown</h2>
                <p className="text-sm text-slate-500">Completed versus abandoned workouts.</p>
              </div>

              {completionChartHasData ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={completionData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3}>
                        {completionData.map((entry, index) => (
                          <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${Number(value ?? 0)}`, 'Workouts']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No completion data available for this range.</p>
              )}
            </div>

            <div className="af-panel">
              <div className="mb-4">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Exercise performance</h2>
                <p className="text-sm text-slate-500">Recent completed exercise data from your workouts.</p>
              </div>

              {Array.isArray(data.exercisePerformance) && data.exercisePerformance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="pb-3 pr-4 font-medium">Exercise</th>
                        <th className="pb-3 pr-4 font-medium">Planned</th>
                        <th className="pb-3 pr-4 font-medium">Actual</th>
                        <th className="pb-3 pr-4 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.exercisePerformance.slice(0, 8).map((exercise, index) => (
                        <tr key={`${exercise.exerciseName}-${exercise.date ?? index}`} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 pr-4 font-medium text-slate-900">{exercise.exerciseName}</td>
                          <td className="py-3 pr-4 text-slate-600">
                            {exercise.plannedSets} × {exercise.plannedReps}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">
                            {exercise.actualSets} × {exercise.actualReps}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">{formatShortDate(exercise.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No exercise performance data available yet.</p>
              )}
            </div>
          </section>

          <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="af-panel">
              <div className="mb-4">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Streaks</h2>
                <p className="text-sm text-slate-500">Your current and longest workout streaks.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current streak</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{data.streaks?.currentStreak ?? 0}</p>
                  <p className="mt-1 text-sm text-slate-500">days</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Longest streak</p>
                  <p className="mt-2 text-3xl font-bold text-slate-900">{data.streaks?.longestStreak ?? 0}</p>
                  <p className="mt-1 text-sm text-slate-500">days</p>
                </div>
              </div>
            </div>

            <div className="af-panel">
              <div className="mb-4">
                <h2 className="text-lg font-bold tracking-tight text-slate-900">Recent activity</h2>
                <p className="text-sm text-slate-500">Your latest logged workouts.</p>
              </div>

              {Array.isArray(data.recentActivity) && data.recentActivity.length > 0 ? (
                <ul className="space-y-3">
                  {data.recentActivity.map((workout: RecentActivityEntry) => (
                    <li key={workout._id}>
                      <button
                        type="button"
                        onClick={() => navigate('/history', { state: { openWorkoutId: workout._id } })}
                        className="flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900">{workout.dayName}</span>
                            <span
                              className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                              style={{
                                backgroundColor: `${STATUS_COLORS[workout.status] ?? '#e2e8f0'}22`,
                                color: STATUS_COLORS[workout.status] ?? '#475569',
                              }}
                            >
                              {summaryStatusLabel(workout.status)}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-sm text-slate-600">{workout.focus}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatLongDate(workout.workoutDate)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-slate-900">{formatMinutes(workout.actualDuration ?? 0)}</p>
                          <p className="text-[11px] text-slate-500">Planned {formatMinutes(workout.plannedDuration)}</p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No recent activity to show.</p>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
};

export default Analytics;