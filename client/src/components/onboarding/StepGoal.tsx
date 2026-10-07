import { FitnessGoal } from '../../types/fitnessProfile';
import type { StepProps } from '../../types/onboarding';
import SelectionCard from './SelectionCard';

const GOAL_OPTIONS: ReadonlyArray<{ value: FitnessGoal; label: string; description: string }> = [
  {
    value: 'general_fitness',
    label: 'General Fitness',
    description: 'Build a consistent routine and feel better day to day.',
  },
  {
    value: 'strength',
    label: 'Strength',
    description: 'Get stronger and build muscle over time.',
  },
  {
    value: 'endurance',
    label: 'Endurance',
    description: 'Improve stamina and cardiovascular fitness.',
  },
  {
    value: 'sports_performance',
    label: 'Sports Performance',
    description: 'Train to perform better in the sport you play.',
  },
  {
    value: 'mobility',
    label: 'Mobility',
    description: 'Move more freely and support healthy joints.',
  },
  {
    value: 'weight_management',
    label: 'Healthy Weight Management',
    description: 'Use regular, sustainable training to support your goals.',
  },
];

const StepGoal = ({ value, onChange }: StepProps) => (
  <div className="space-y-6">
    <div>
      <h2 id="onboarding-goal-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
        What is your main fitness goal?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Pick the one that matters most right now — you can change it any time.
      </p>
    </div>

    <div
      role="radiogroup"
      aria-labelledby="onboarding-goal-heading"
      className="grid gap-3 sm:grid-cols-2"
    >
      {GOAL_OPTIONS.map((option) => (
        <SelectionCard
          key={option.value}
          name="onboarding-goal"
          value={option.value}
          label={option.label}
          description={option.description}
          checked={value.goal === option.value}
          onChange={(goal) => onChange({ goal })}
        />
      ))}
    </div>
  </div>
);

export default StepGoal;
