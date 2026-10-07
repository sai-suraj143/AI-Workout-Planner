import type { WorkoutPlan } from '../../types/workoutPlan';
import { formatDate, formatGoal, pluralise } from './format';

interface PlanHeaderProps {
  plan: WorkoutPlan;
}

/** Title, summary and the plan's key facts (shown on the detail page). */
export const PlanHeader = ({ plan }: PlanHeaderProps) => {
  const workoutDays = plan.days.filter((day) => !day.restDay).length;
  const generatedAt = plan.aiMetadata?.generatedAt ?? plan.createdAt;

  const facts: Array<{ label: string; value: string }> = [
    { label: 'Goal', value: formatGoal(plan.goal) },
    { label: 'Experience', value: formatGoal(plan.experienceLevel) },
    { label: 'Programme', value: `${plan.totalWeeks} week${plan.totalWeeks === 1 ? '' : 's'}` },
    { label: 'Current week', value: `Week ${plan.weekNumber}` },
    { label: 'Training days', value: pluralise(workoutDays, 'day') },
    { label: 'Generated', value: formatDate(generatedAt) },
  ];

  const isAdaptive = plan.aiMetadata?.generationType === 'adaptive_plan';

  return (
    <header className="af-panel">
      <span className="af-badge">{isAdaptive ? 'Adaptive AI plan' : 'AI generated plan'}</span>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {plan.title}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{plan.summary}</p>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {fact.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
};
