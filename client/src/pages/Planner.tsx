import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import type { ReactNode } from 'react';
import { useProfile } from '../services/profileService';
import {
  planErrorMessage,
  useDeletePlan,
  useGeneratePlan,
  usePlan,
  usePlans,
} from '../services/planService';
import { PlanHeader } from '../components/planner/PlanHeader';
import { WeekOverview } from '../components/planner/WeekOverview';
import { WorkoutDayCard } from '../components/planner/WorkoutDayCard';
import { GeneratePlanButton } from '../components/planner/GeneratePlanButton';
import { formatDate, formatGoal, pluralise } from '../components/planner/format';
import { AlertIcon, BoltIcon, SpinnerIcon } from '../components/icons';

/* ------------------------------------------------------------ shared bits */

const CenteredSpinner = ({ message }: { message: string }) => (
  <div className="flex min-h-[50vh] items-center justify-center text-slate-500" role="status">
    <SpinnerIcon className="mr-2.5 h-5 w-5 text-brand-600" />
    <span className="text-sm font-medium">{message}</span>
  </div>
);

const CenteredState = ({ children }: { children: ReactNode }) => (
  <div className="flex min-h-[50vh] items-center justify-center px-4 py-10 text-center">
    <div className="af-card max-w-md p-8">
      <span className="af-brand-mark mx-auto mb-5">
        <BoltIcon />
      </span>
      {children}
    </div>
  </div>
);

const ErrorAlert = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <div role="alert" className="af-alert-error">
    <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
    <div className="flex-1">{message}</div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-lg px-2 py-1 font-semibold underline underline-offset-4 hover:bg-red-100 focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:outline-none"
      >
        Retry
      </button>
    )}
  </div>
);

/* ---------------------------------------------------------- plan history */

const PlanListView = () => {
  const navigate = useNavigate();
  const { profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } =
    useProfile();
  const {
    data: plans = [],
    isLoading: plansLoading,
    error: plansError,
    refetch: refetchPlans,
  } = usePlans();
  const generateMutation = useGeneratePlan();
  const deleteMutation = useDeletePlan();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleGenerate = async () => {
    try {
      const plan = await generateMutation.mutateAsync();
      navigate(`/planner/${plan._id}`);
    } catch {
      // Surface the failure through generateMutation.error below.
    }
  };

  const handleDelete = async (planId: string) => {
    if (!window.confirm('Delete this workout plan? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(planId);
    } catch {
      // Surface the failure through deleteMutation.error below.
    } finally {
      setIsDeleting(false);
    }
  };

  if (profileLoading) {
    return <CenteredSpinner message="Loading your fitness profile…" />;
  }

  if (profileError) {
    return (
      <div className="mx-auto w-full max-w-2xl py-16">
        <ErrorAlert
          message={planErrorMessage(profileError, 'We could not load your fitness profile.')}
          onRetry={() => void refetchProfile()}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <CenteredState>
        <span className="af-badge mb-4">Step 1 of 2</span>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Complete your fitness profile first
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Your plan is built from your goals, training days, equipment and preferences, so we need
          those details before we can generate it.
        </p>
        <Link to="/onboarding" className="af-btn-primary mt-6">
          Complete Profile
        </Link>
      </CenteredState>
    );
  }

  const generationError = generateMutation.error
    ? planErrorMessage(generateMutation.error, 'We could not generate your plan. Please try again.')
    : null;
  const deletionError = deleteMutation.error
    ? planErrorMessage(deleteMutation.error, 'We could not delete that plan.')
    : null;

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Page heading */}
      <header className="mb-7">
        <p className="text-sm font-medium text-brand-600">Planner</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Your AI Workout Planner
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
          Generate a weekly plan built around your goals, training schedule, available equipment
          and preferences. You can create a new plan whenever your routine changes.
        </p>
      </header>

      {/* Generation */}
      <section aria-label="Generate a workout plan" className="af-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Generate a new plan
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
              Uses your saved profile: {formatGoal(profile.goal)} ·{' '}
              {pluralise(profile.availableDays.length, 'available day')} ·{' '}
              {profile.sessionDuration} min sessions
            </p>
          </div>
          <GeneratePlanButton onGenerate={handleGenerate} isGenerating={generateMutation.isPending} />
        </div>

        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-sm font-medium text-slate-600"
        >
          {generateMutation.isPending
            ? 'Creating your personalized plan… this can take up to a minute.'
            : ''}
        </p>

        {generationError && (
          <div className="mt-3">
            <ErrorAlert message={generationError} />
          </div>
        )}
      </section>

      {/* History */}
      <section aria-label="Plan history" className="mt-6">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Plan history</h2>
          {!plansLoading && !plansError && plans.length > 0 && (
            <span className="text-sm text-slate-500">{pluralise(plans.length, 'plan')}</span>
          )}
        </div>

        {deletionError && (
          <div className="mb-4">
            <ErrorAlert message={deletionError} />
          </div>
        )}

        {plansLoading ? (
          <div
            className="flex min-h-[20vh] items-center justify-center text-slate-500"
            role="status"
          >
            <SpinnerIcon className="mr-2.5 h-5 w-5 text-brand-600" />
            <span className="text-sm font-medium">Loading your plans…</span>
          </div>
        ) : plansError ? (
          <ErrorAlert
            message={planErrorMessage(plansError, 'We could not load your plans.')}
            onRetry={() => void refetchPlans()}
          />
        ) : plans.length === 0 ? (
          <div className="af-panel text-center">
            <p className="text-sm font-medium text-slate-700">No plans yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Generate your first plan above and it will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {plans.map((plan) => {
              const workoutDays = plan.days.filter((day) => !day.restDay).length;
              return (
                <li key={plan._id} className="af-panel transition-shadow hover:shadow-md">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-900">
                        <Link to={`/planner/${plan._id}`} className="af-link">
                          {plan.title}
                        </Link>
                      </h3>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">{plan.summary}</p>
                      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                        <span className="af-badge">{formatGoal(plan.goal)}</span>
                        <span className="af-badge">Week {plan.weekNumber}</span>
                        <span className="af-badge">{pluralise(workoutDays, 'workout day')}</span>
                        <span>Generated {formatDate(plan.createdAt)}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link to={`/planner/${plan._id}`} className="af-btn-secondary">
                        View plan
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDelete(plan._id)}
                        disabled={isDeleting}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:ring-4 focus-visible:ring-red-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

/* ------------------------------------------------------------- plan detail */

const PlanDetailView = ({ planId }: { planId: string }) => {
  const navigate = useNavigate();
  const { data: plan, isLoading, error, refetch } = usePlan(planId);
  const deleteMutation = useDeletePlan();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm('Delete this workout plan? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync(planId);
      navigate('/planner');
    } catch {
      // Surface the failure through deleteMutation.error below.
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <CenteredSpinner message="Loading your plan…" />;
  }

  const notFound = isAxiosError(error) && error.response?.status === 404;

  if (error) {
    return (
      <CenteredState>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {notFound ? 'Plan not found' : 'We could not load this plan'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {notFound
            ? 'It may have been deleted, or the link is no longer valid.'
            : planErrorMessage(error, 'Something went wrong while loading this plan.')}
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3">
          <Link to="/planner" className="af-btn-primary">
            Back to all plans
          </Link>
          {!notFound && (
            <button type="button" onClick={() => void refetch()} className="af-btn-secondary">
              Try again
            </button>
          )}
        </div>
      </CenteredState>
    );
  }

  if (!plan) {
    return (
      <CenteredState>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Plan not found</h1>
        <Link to="/planner" className="af-btn-primary mt-6">
          Back to all plans
        </Link>
      </CenteredState>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link to="/planner" className="af-link">
          ← Back to all plans
        </Link>
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={isDeleting}
          className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:ring-4 focus-visible:ring-red-500/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? 'Deleting…' : 'Delete plan'}
        </button>
      </div>

      {deleteMutation.error && (
        <div className="mb-5">
          <ErrorAlert
            message={planErrorMessage(deleteMutation.error, 'We could not delete that plan.')}
          />
        </div>
      )}

      <div className="space-y-5">
        <PlanHeader plan={plan} />
        <WeekOverview days={plan.days} />

        <section aria-label="Daily plan">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Daily plan</h2>
          <div className="mt-3 space-y-4">
            {plan.days.map((day) => (
              <WorkoutDayCard key={`${day.dayIndex}-${day.dayName}`} day={day} planId={plan._id} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- page */

const Planner = () => {
  const { id } = useParams<{ id: string }>();
  return id ? <PlanDetailView planId={id} /> : <PlanListView />;
};

export default Planner;
