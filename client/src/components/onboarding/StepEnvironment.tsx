import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { TrainingLocation } from '../../types/fitnessProfile';
import type { StepProps } from '../../types/onboarding';
import SelectionCard from './SelectionCard';

const LOCATION_OPTIONS: ReadonlyArray<{
  value: TrainingLocation;
  label: string;
  description: string;
}> = [
  { value: 'home', label: 'Home', description: 'Train where you live.' },
  { value: 'gym', label: 'Gym', description: 'Train at a gym or club.' },
  {
    value: 'both',
    label: 'Home + Gym',
    description: 'Split your training between home and a gym.',
  },
];

/** Values the backend accepts as plain strings — free-form entries are allowed too. */
const EQUIPMENT_OPTIONS = [
  'No equipment',
  'Dumbbells',
  'Resistance bands',
  'Pull-up bar',
  'Bench',
  'Barbell',
  'Machines',
  'Other',
] as const;

const NO_EQUIPMENT = 'No equipment';

const StepEnvironment = ({ value, onChange }: StepProps) => {
  const [customEquipment, setCustomEquipment] = useState('');

  const isKnown = (item: string): boolean =>
    (EQUIPMENT_OPTIONS as readonly string[]).includes(item);

  const customItems = value.equipment.filter((item) => !isKnown(item));

  const toggleEquipment = (item: string) => {
    const isSelected = value.equipment.includes(item);

    if (item === NO_EQUIPMENT) {
      // "No equipment" and everything else are mutually exclusive.
      onChange({ equipment: isSelected ? [] : [NO_EQUIPMENT] });
      return;
    }

    if (isSelected) {
      onChange({ equipment: value.equipment.filter((entry) => entry !== item) });
      return;
    }

    onChange({
      equipment: [...value.equipment.filter((entry) => entry !== NO_EQUIPMENT), item],
    });
  };

  const handleAddCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = customEquipment.trim();
    if (!name) return;

    const alreadyPresent = value.equipment.some(
      (entry) => entry.toLowerCase() === name.toLowerCase(),
    );
    if (!alreadyPresent) {
      onChange({ equipment: [...value.equipment, name] });
    }
    setCustomEquipment('');
  };

  const removeCustom = (item: string) => {
    onChange({ equipment: value.equipment.filter((entry) => entry !== item) });
  };

  return (
    <div className="space-y-7">
      <div>
        <h2
          id="onboarding-location-heading"
          className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
        >
          Where will you train?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Choose the place you use most — we will keep every workout doable there.
        </p>
      </div>

      <section className="space-y-3">
        <div
          role="radiogroup"
          aria-labelledby="onboarding-location-heading"
          className="grid gap-3 sm:grid-cols-3"
        >
          {LOCATION_OPTIONS.map((option) => (
            <SelectionCard
              key={option.value}
              name="onboarding-location"
              value={option.value}
              label={option.label}
              description={option.description}
              checked={value.trainingLocation === option.value}
              onChange={(trainingLocation) => onChange({ trainingLocation })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 id="onboarding-equipment-heading" className="text-base font-semibold text-slate-900">
          What equipment do you have access to?
        </h3>
        <p className="text-sm text-slate-500">
          Select all that apply. Only exercises you can actually do will be planned.
        </p>

        <div
          role="group"
          aria-labelledby="onboarding-equipment-heading"
          className="flex flex-wrap gap-2"
        >
          {EQUIPMENT_OPTIONS.map((item) => (
            <SelectionCard
              key={item}
              type="checkbox"
              name="onboarding-equipment"
              variant="chip"
              value={item}
              label={item}
              checked={value.equipment.includes(item)}
              onChange={toggleEquipment}
            />
          ))}
        </div>

        {/* Free-form additions for anything not listed above. */}
        <form
          onSubmit={handleAddCustom}
          className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4"
        >
          <label htmlFor="custom-equipment" className="af-label">
            Other equipment (optional)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="custom-equipment"
              type="text"
              value={customEquipment}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setCustomEquipment(event.target.value)
              }
              placeholder="e.g. Kettlebell, cable machine"
              maxLength={60}
              className="af-input sm:flex-1"
            />
            <button
              type="submit"
              disabled={customEquipment.trim() === ''}
              className="af-btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add
            </button>
          </div>

          {customItems.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {customItems.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    onClick={() => removeCustom(item)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-2 text-xs font-semibold text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-100 focus-visible:ring-4 focus-visible:ring-brand-500/30 focus-visible:outline-none"
                  >
                    <span className="max-w-[14rem] truncate">{item}</span>
                    <span aria-hidden="true" className="text-sm leading-none text-brand-500">
                      ×
                    </span>
                    <span className="sr-only">Remove {item}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="af-hint">Anything you own that is not listed can be added here.</p>
          )}
        </form>
      </section>
    </div>
  );
};

export default StepEnvironment;
