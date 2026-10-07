import { ExperienceLevel } from '../../types/fitnessProfile';
import type { StepProps } from '../../types/onboarding';
import SelectionCard from './SelectionCard';

const EXPERIENCE_OPTIONS: ReadonlyArray<{
  value: ExperienceLevel;
  label: string;
  description: string;
}> = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'New to structured training, or getting back into it after a break.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'You train most weeks and know your way around the basics.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'You have been training consistently for a long time and want more challenge.',
  },
];

const StepExperience = ({ value, onChange }: StepProps) => (
  <div className="space-y-6">
    <div>
      <h2
        id="onboarding-experience-heading"
        className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
      >
        What&apos;s your experience level?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        This sets the starting intensity and complexity of your sessions. There is no right answer
        — we will progress you at a sensible pace.
      </p>
    </div>

    <div
      role="radiogroup"
      aria-labelledby="onboarding-experience-heading"
      className="grid gap-3 sm:grid-cols-3"
    >
      {EXPERIENCE_OPTIONS.map((option) => (
        <SelectionCard
          key={option.value}
          name="onboarding-experience"
          value={option.value}
          label={option.label}
          description={option.description}
          checked={value.experienceLevel === option.value}
          onChange={(experienceLevel) => onChange({ experienceLevel })}
        />
      ))}
    </div>
  </div>
);

export default StepExperience;
