import { useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../services/authService';
import { useAnalytics } from '../services/analyticsService';
import { useProfile } from '../services/profileService';
import {
  FitnessGoal,
  ExperienceLevel,
  TrainingLocation,
} from '../types/fitnessProfile';
import { BoltIcon, SpinnerIcon } from '../components/icons';

const titleCase = (value: string) =>
  value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

/** Guards against a missing/unknown enum value instead of crashing the render. */
const safeFormat = (value: string | undefined, fallback = 'Not set'): string =>
  typeof value === 'string' && value.trim() ? titleCase(value) : fallback;

const formatGoal = (goal: FitnessGoal) => safeFormat(goal);
const formatLevel = (level: ExperienceLevel) => safeFormat(level);
const formatLocation = (loc: TrainingLocation) => safeFormat(loc);

const formatDays = (days: string[] | undefined) =>
  Array.isArray(days) && days.length > 0 ? days.map((day) => safeFormat(day)).join(', ') : 'Not set';

const formatDuration = (minutes: number | undefined) =>
  typeof minutes === 'number' && minutes > 0 ? `${minutes} min` : 'Not set';

const formatEquipment = (equipment: string[] | undefined) =>
  Array.isArray(equipment) && equipment.length > 0
    ? equipment.map((item) => safeFormat(item)).join(', ')
    : 'None';

const CenteredState = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[60vh] items-center justify-center px-4 py-16 text-center">
    <div className="af-card max-w-md p-8">
      <span className="af-brand-mark mx-auto mb-5">
        <BoltIcon />
      </span>
      {children}
    </div>
  </div>
);

const Dashboard = () => {
  const { user, isLoading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useProfile();
  const { data: analyticsSnapshot, isLoading: analyticsLoading } = useAnalytics('7d');
  const navigate = useNavigate();

  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <SpinnerIcon className="mr-2.5 h-5 w-5 text-brand-600" />
        <span className="text-sm font-medium">Loading your dashboard…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <CenteredState>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Please log in</h2>
        <p className="mt-2 text-sm text-slate-500">
          You need an account to view your dashboard.
        </p>
      </CenteredState>
    );
  }

  // If profile is null or undefined (i.e., 404 from API), redirect to onboarding
  // to complete the profile.
  if (!profile) {
    return (
      <CenteredState>
        <span className="af-badge mb-4">Step 1 of 2</span>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          Complete your fitness profile
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Tell us your goals, experience and schedule so the planner can build the right
          workout for you.
        </p>
        <button onClick={() => navigate('/onboarding')} className="af-btn-primary mt-6">
          Go to onboarding
        </button>
      </CenteredState>
    );
  }

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Goal', value: formatGoal(profile.goal) },
    { label: 'Experience level', value: formatLevel(profile.experienceLevel) },
    { label: 'Training location', value: formatLocation(profile.trainingLocation) },
    { label: 'Available days', value: formatDays(profile.availableDays) },
    { label: 'Session duration', value: formatDuration(profile.sessionDuration) },
    { label: 'Equipment', value: formatEquipment(profile.equipment) },
  ];

  const firstName = user.name?.trim().split(/\s+/)[0] || 'there';

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Page heading */}
      <header className="mb-7">
        <p className="text-sm font-medium text-brand-600">Dashboard</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Welcome back, {firstName}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Here&apos;s a summary of your fitness profile. You can update it any time.
        </p>
      </header>

      {/* Profile summary cards */}
      <section aria-label="Fitness profile summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="af-panel transition-shadow hover:shadow-md"
          >
            <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {stat.label}
            </h3>
            <p className="mt-2 text-lg font-semibold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="af-panel mt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-600">Progress snapshot</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">Your 7-day analytics</h2>
          </div>
          <button type="button" onClick={() => navigate('/analytics')} className="af-btn-secondary sm:w-auto">
            View Analytics
          </button>
        </div>

        {analyticsLoading ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-slate-100 p-4">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="mt-4 h-8 w-16 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-28 rounded bg-slate-200" />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Completed</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{analyticsSnapshot?.completedWorkouts ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Completion rate</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{Math.round(analyticsSnapshot?.completionRate ?? 0)}%</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current streak</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{analyticsSnapshot?.streaks?.currentStreak ?? 0}d</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Recent</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{analyticsSnapshot?.recentActivity.length ?? 0}</p>
            </div>
          </div>
        )}
      </section>

      {/* Next steps */}
      <section className="af-panel mt-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <span className="af-badge">Step 2 of 2</span>
            <h2 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
              Generate your workout plan
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Your profile is complete. Open the planner to generate an AI workout plan built from
              these details, or update your profile at any time.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <button onClick={() => navigate('/onboarding')} className="af-btn-secondary">
              Edit profile
            </button>
            <button onClick={() => navigate('/planner')} className="af-btn-primary sm:w-auto">
              <BoltIcon className="h-4 w-4 shrink-0" />
              Generate plan
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;