import { parseStoredForm } from '../validation/onboarding';
import type { OnboardingFormData } from '../types/onboarding';

/**
 * Best-effort local draft of the in-progress onboarding wizard.
 *
 * Purpose: a browser refresh (or a stray back-navigation) should not throw away
 * several minutes of answers. It is only read when the user has no saved
 * profile on the server, and it is cleared as soon as that profile loads or
 * saves successfully — so a draft can never overwrite newer server data.
 *
 * Only non-sensitive preferences are stored (goal, schedule, equipment, …) and
 * entries are scoped per user id so a shared machine never leaks a draft
 * between accounts. Every read is re-validated through the same schema the form
 * uses, so a stale or corrupt entry simply degrades to the default form.
 */

const STORAGE_KEY_PREFIX = 'adaptivedrift.onboarding.draft.';

const storageKey = (userId: string): string => `${STORAGE_KEY_PREFIX}${userId}`;

/** Returns `null` when storage is unavailable, empty, stale or malformed. */
export const loadOnboardingDraft = (userId: string): OnboardingFormData | null => {
  if (!userId) return null;

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    return parseStoredForm(parsed);
  } catch {
    // Private mode, quota errors or corrupt JSON — never block the wizard.
    return null;
  }
};

export const saveOnboardingDraft = (userId: string, form: OnboardingFormData): void => {
  if (!userId) return;

  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(form));
  } catch {
    // Storage unavailable / quota exceeded — losing the draft is acceptable.
  }
};

export const clearOnboardingDraft = (userId: string): void => {
  if (!userId) return;

  try {
    window.localStorage.removeItem(storageKey(userId));
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
};
