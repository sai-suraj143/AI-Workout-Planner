import { useId } from 'react';
import type { StepProps } from '../../types/onboarding';

const MAX_NOTES_LENGTH = 2000;

/**
 * Step 7 — Additional notes (optional free text).
 */
const StepAdditionalNotes = ({ value, onChange }: StepProps) => {
  const notesId = useId();
  const remaining = MAX_NOTES_LENGTH - value.additionalNotes.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          Anything else we should know?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Optional — injuries, a typical week, or what has (and hasn't) worked for you before.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor={notesId} className="af-label block">
          Additional notes
        </label>
        <textarea
          id={notesId}
          value={value.additionalNotes}
          onChange={(event) => onChange({ additionalNotes: event.target.value.slice(0, MAX_NOTES_LENGTH) })}
          rows={6}
          maxLength={MAX_NOTES_LENGTH}
          aria-describedby={`${notesId}-hint`}
          className="af-input resize-y"
          placeholder="e.g. I'm recovering from a knee injury and prefer low-impact sessions."
        />
        <p id={`${notesId}-hint`} className="af-hint">
          Optional · {remaining} character{remaining === 1 ? '' : 's'} left
        </p>
      </div>

      <div className="af-card space-y-3 bg-slate-50">
        <p className="text-sm font-semibold text-slate-900">A few ideas</p>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-600">
          <li>Any medical conditions, past injuries, or movement restrictions.</li>
          <li>Travel, shift work, or other busy periods we should plan around.</li>
          <li>Activities you already enjoy so we can build on them.</li>
        </ul>
      </div>
    </div>
  );
};

export default StepAdditionalNotes;
