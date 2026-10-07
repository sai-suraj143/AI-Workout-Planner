import type { ChangeEvent } from 'react';
import { SportOption } from '../../types/fitnessProfile';
import type { StepProps } from '../../types/onboarding';
import SelectionCard from './SelectionCard';

const SPORT_OPTIONS: ReadonlyArray<{ value: SportOption; label: string; description?: string }> = [
  { value: 'none', label: 'None', description: 'General training with no specific sport.' },
  { value: 'cricket', label: 'Cricket' },
  { value: 'football', label: 'Football' },
  { value: 'basketball', label: 'Basketball' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'other', label: 'Other', description: 'Tell us which sport below.' },
];

const StepSport = ({ value, onChange }: StepProps) => {
  const handleSportChange = (sport: SportOption) => {
    // sportName is only meaningful for "other" — clearing it here guarantees we
    // never submit a sport together with a contradictory name.
    onChange({ sport, sportName: sport === 'other' ? value.sportName : '' });
  };

  const needsSportName = value.sport === 'other';
  const sportNameMissing = needsSportName && value.sportName.trim() === '';

  return (
    <div className="space-y-6">
      <div>
        <h2 id="onboarding-sport-heading" className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Do you want your plan to support a specific sport?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          We will add relevant conditioning and movement work alongside your main training.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="onboarding-sport-heading"
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {SPORT_OPTIONS.map((option) => (
          <SelectionCard
            key={option.value}
            name="onboarding-sport"
            value={option.value}
            label={option.label}
            description={option.description}
            checked={value.sport === option.value}
            onChange={handleSportChange}
          />
        ))}
      </div>

      {needsSportName ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <label htmlFor="onboarding-sport-name" className="af-label">
            Which sport?
          </label>
          <input
            id="onboarding-sport-name"
            type="text"
            value={value.sportName}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({ sportName: event.target.value })
            }
            placeholder="e.g. Badminton, Rowing, Martial arts"
            maxLength={60}
            aria-required={true}
            aria-invalid={sportNameMissing ? true : undefined}
            aria-describedby={
              sportNameMissing ? 'onboarding-sport-name-error' : 'onboarding-sport-name-hint'
            }
            className={`af-input ${sportNameMissing ? 'af-input-error' : ''}`}
          />
          {sportNameMissing ? (
            <p id="onboarding-sport-name-error" className="af-field-error" role="alert">
              Enter the name of your sport.
            </p>
          ) : (
            <p id="onboarding-sport-name-hint" className="af-hint">
              Required — this is what your plan will be built around.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default StepSport;
