import { SpinnerIcon } from '../icons';

interface GeneratePlanButtonProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

/**
 * Single entry point for generation. Disabled while a request is in flight so a
 * double click cannot start two AI generations (the server guards too).
 */
export const GeneratePlanButton = ({ onGenerate, isGenerating }: GeneratePlanButtonProps) => (
  <button
    type="button"
    onClick={onGenerate}
    disabled={isGenerating}
    aria-busy={isGenerating}
    className="af-btn-primary w-full sm:w-auto"
  >
    {isGenerating ? (
      <>
        <SpinnerIcon className="h-4 w-4 animate-spin" />
        Creating your personalized plan…
      </>
    ) : (
      <>Generate My Plan</>
    )}
  </button>
);
