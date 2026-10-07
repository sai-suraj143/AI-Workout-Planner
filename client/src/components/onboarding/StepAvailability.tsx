import { AvailableDay } from '../../types/fitnessProfile';
import { SESSION_DURATIONS } from '../../types/onboarding';
import type { StepProps } from '../../types/onboarding';
import SelectionCard from './SelectionCard';

const DAY_OPTIONS: ReadonlyArray<{ value: AvailableDay; label: string }> = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

const DURATION_DETAILS: Record<number, string> = {
  15: 'A short, focused session.',
  30: 'The most common session length.',
  45: 'Room for a fuller workout.',
  60: 'Warm-up, main work and cool-down.',
  90: 'Long, unhurried training.',
};

const StepAvailability = ({ value, onChange }: StepProps) => {
  const toggleDay = (day: AvailableDay) => {
    onChange({
      availableDays: value.availableDays.includes(day)
        ? value.availableDays.filter((entry) => entry !== day)
        : [...value.availableDays, day],
    });
  };

  return (
    <div className="space-y-7">
      <div>
        <h2
          id="onboarding-days-heading"
          className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
        >
          When can you train?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Pick the days you can realistically train and how long you want each session to last.
        </p>
      </div>

      <section className="space-y-3">
        <h3 id="onboarding-days-label" className="text-base font-semibold text-slate-900">
          Available days
        </h3>
        <p className="text-sm text-slate-500">
          Select at least one. Remaining days become rest days in your plan.
        </p>

        <div
          role="group"
          aria-labelledby="onboarding-days-label"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
        >
          {DAY_OPTIONS.map((day) => (
            <SelectionCard
              key={day.value}
              type="checkbox"
              name="onboarding-days"
              variant="chip"
              value={day.value}
              label={day.label}
              checked={value.availableDays.includes(day.value)}
              onChange={toggleDay}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 id="onboarding-duration-heading" className="text-base font-semibold text-slate-900">
          Session duration
        </h3>
        <p className="text-sm text-slate-500">
          How long would you like a typical workout to take?
        </p>

        <div
          role="radiogroup"
          aria-labelledby="onboarding-duration-heading"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {SESSION_DURATIONS.map((minutes) => (
            <SelectionCard
              key={minutes}
              name="onboarding-duration"
              value={minutes}
              label={`${minutes} minutes`}
              description={DURATION_DETAILS[minutes]}
              checked={value.sessionDuration === minutes}
              onChange={(sessionDuration) => onChange({ sessionDuration })}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default StepAvailability;
