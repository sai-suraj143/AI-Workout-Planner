interface OnboardingProgressProps {
  /** 1-based index of the step being shown. */
  currentStep: number;
  totalSteps: number;
  /** Name of the current step, e.g. "Goal". */
  stepLabel: string;
}

/**
 * "Step X of Y" plus a bar and per-step dots.
 *
 * The bar uses `currentStep / totalSteps`, so it always matches the text
 * beside it, and exposes `role="progressbar"` with `aria-valuetext` for screen
 * readers. The dots are decorative — all real information lives in the text and
 * the progressbar attributes, so the indicator never depends on colour alone.
 */
const OnboardingProgress = ({ currentStep, totalSteps, stepLabel }: OnboardingProgressProps) => {
  const safeTotal = Math.max(totalSteps, 1);
  const safeCurrent = Math.min(Math.max(currentStep, 1), safeTotal);
  const percentage = Math.round((safeCurrent / safeTotal) * 100);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold text-slate-700">
          Step {safeCurrent} of {safeTotal}
          <span className="ml-2 font-normal text-slate-500">{stepLabel}</span>
        </p>
        <p className="text-xs font-medium text-slate-400">{percentage}% complete</p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={safeTotal}
        aria-valuenow={safeCurrent}
        aria-valuetext={`Step ${safeCurrent} of ${safeTotal}, ${stepLabel}`}
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div
          className="h-full rounded-full bg-brand-600 transition-[width] duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Decorative stepper dots mirroring the bar above. */}
      <ol aria-hidden="true" className="flex items-center gap-1.5">
        {Array.from({ length: safeTotal }, (_, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === safeCurrent;
          const isComplete = stepNumber < safeCurrent;

          return (
            <li key={stepNumber} className="flex min-w-0 flex-1 items-center">
              <span
                className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
                  isCurrent
                    ? 'bg-brand-600 ring-4 ring-brand-600/20'
                    : isComplete
                      ? 'bg-brand-400'
                      : 'bg-slate-300'
                }`}
              />
              {stepNumber < safeTotal ? (
                <span
                  className={`h-0.5 min-w-0 flex-1 ${isComplete ? 'bg-brand-300' : 'bg-slate-200'}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default OnboardingProgress;
