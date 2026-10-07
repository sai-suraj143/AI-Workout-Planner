import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../services/authService';
import { profileErrorMessage, useProfile } from '../services/profileService';
import {
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
} from '../services/onboardingDraftService';
import { buildProfilePayload, formFromProfile, validateStep } from '../validation/onboarding';
import { DEFAULT_ONBOARDING_FORM, STEP_ORDER } from '../types/onboarding';
import type { OnboardingFormData, StepId, StepProps } from '../types/onboarding';
import { FormError } from '../components/AuthField';
import { SpinnerIcon } from '../components/icons';
import OnboardingLayout from '../components/onboarding/OnboardingLayout';
import OnboardingProgress from '../components/onboarding/OnboardingProgress';
import StepGoal from '../components/onboarding/StepGoal';
import StepExperience from '../components/onboarding/StepExperience';
import StepEnvironment from '../components/onboarding/StepEnvironment';
import StepAvailability from '../components/onboarding/StepAvailability';
import StepPreferences from '../components/onboarding/StepPreferences';
import StepSport from '../components/onboarding/StepSport';
import StepAdditionalNotes from '../components/onboarding/StepAdditionalNotes';

const STEP_LABELS: Record<StepId, string> = {
  goal: 'Goal',
  experience: 'Experience',
  environment: 'Training Environment',
  availability: 'Availability',
  preferences: 'Preferences',
  sport: 'Sport',
  notes: 'Additional Notes',
};

const STEP_COMPONENTS: Record<StepId, ComponentType<StepProps>> = {
  goal: StepGoal,
  experience: StepExperience,
  environment: StepEnvironment,
  availability: StepAvailability,
  preferences: StepPreferences,
  sport: StepSport,
  notes: StepAdditionalNotes,
};

/** Wizard order comes straight from the validation layer so the two never drift. */
const STEPS = STEP_ORDER.map((id) => ({
  id,
  label: STEP_LABELS[id],
  Component: STEP_COMPONENTS[id],
}));

const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const {
    profile,
    isPending,
    error: profileError,
    refetch,
    update,
    isUpdating,
  } = useProfile();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [form, setForm] = useState<OnboardingFormData | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Seed the form the first time the profile query settles: an existing
  // profile always wins over a local draft, and a brand-new user falls back to
  // safe defaults. This is derived during render (React's "adjust state when
  // something changes" pattern) rather than from an effect, so there is no
  // extra render pass and no state update buried in an effect. While the query
  // is still pending — or has failed — the form stays `null` and the matching
  // loading / error state is shown instead.
  if (!seeded && !isPending && !profileError) {
    setSeeded(true);
    if (profile) {
      setForm(formFromProfile(profile));
    } else {
      const draft = userId ? loadOnboardingDraft(userId) : null;
      setForm(draft ?? DEFAULT_ONBOARDING_FORM);
    }
  }

  // A saved profile makes any leftover local draft obsolete.
  useEffect(() => {
    if (profile && userId) clearOnboardingDraft(userId);
  }, [profile, userId]);

  // Keep a per-user draft while there is no saved profile yet, so a refresh
  // does not throw away several minutes of answers.
  useEffect(() => {
    if (!form || profile || !userId) return;
    saveOnboardingDraft(userId, form);
  }, [form, profile, userId]);

  // Move focus to the step panel whenever the step actually changes, so
  // keyboard and screen-reader users land on the new content instead of on a
  // button that just unmounted. The initial mount is skipped on purpose.
  const lastFocusedStepRef = useRef(currentStepIndex);
  useEffect(() => {
    if (lastFocusedStepRef.current === currentStepIndex) return;
    lastFocusedStepRef.current = currentStepIndex;
    panelRef.current?.focus();
  }, [currentStepIndex]);

  const currentStep = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;
  const stepMessage = form ? validateStep(currentStep.id, form) : null;
  const isSubmitting = isUpdating;

  const handlePatch = (patch: Partial<OnboardingFormData>) => {
    setSubmitError(null);
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const goToStep = (index: number) => {
    setSubmitError(null);
    setCurrentStepIndex(index);
  };

  const handleBack = () => {
    if (!isFirstStep) goToStep(currentStepIndex - 1);
  };

  const handleContinue = () => {
    if (!form || stepMessage !== null) return;
    if (!isLastStep) goToStep(currentStepIndex + 1);
  };

  const handleSubmit = async () => {
    if (!form || isSubmitting) return;
    setSubmitError(null);

    const built = buildProfilePayload(form);
    if (!built.ok) {
      // Never send an invalid payload — jump back to the step that needs work.
      const invalidIndex = STEP_ORDER.indexOf(built.step);
      if (invalidIndex >= 0) setCurrentStepIndex(invalidIndex);
      setSubmitError(built.message);
      return;
    }

    try {
      await update(built.payload);
      if (userId) clearOnboardingDraft(userId);
      navigate('/dashboard');
    } catch (err) {
      setSubmitError(
        profileErrorMessage(err, "We couldn't save your profile. Please try again."),
      );
    }
  };

  /* ------------------------------------------------------------- states */

  if (profileError && !form) {
    return (
      <OnboardingLayout
        eyebrow="Your profile"
        title="We couldn't load your profile"
        subtitle="Something went wrong while fetching your answers."
        footer={
          <button type="button" onClick={() => void refetch()} className="af-btn-primary">
            Try again
          </button>
        }
      >
        <FormError
          message={profileErrorMessage(
            profileError,
            "We couldn't load your profile. Please try again in a moment.",
          )}
        />
      </OnboardingLayout>
    );
  }

  if (isPending || !form) {
    return (
      <OnboardingLayout
        eyebrow="Your profile"
        title="Setting up your profile"
        subtitle="This only takes a minute."
      >
        <p className="af-hint inline-flex items-center gap-2" role="status">
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          Loading your profile…
        </p>
      </OnboardingLayout>
    );
  }

  const StepComponent = currentStep.Component;

  /* -------------------------------------------------------------- render */

  return (
    <OnboardingLayout
      eyebrow="Set up your plan"
      title="Let's build your profile"
      subtitle="A few quick questions about your goals, schedule and training setup — you can change any of this later."
      footer={
        <div className="space-y-3">
          <FormError message={submitError} />

          <div
            className={`flex flex-col-reverse gap-3 sm:flex-row ${
              isFirstStep ? 'sm:justify-end' : 'sm:items-center sm:justify-between'
            }`}
          >
            {!isFirstStep ? (
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="af-btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>
            ) : null}

            {isLastStep ? (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="af-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <SpinnerIcon />
                    Saving your profile…
                  </>
                ) : (
                  'Complete Profile'
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleContinue}
                disabled={isSubmitting || stepMessage !== null}
                className="af-btn-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continue
              </button>
            )}
          </div>

          <p className="af-hint" aria-live="polite">
            {stepMessage ??
              (isLastStep
                ? 'Everything looks good — you can still go back and change anything.'
                : 'You can go back at any time without losing your answers.')}
          </p>
        </div>
      }
    >
      <div className="space-y-7">
        <OnboardingProgress
          currentStep={currentStepIndex + 1}
          totalSteps={STEPS.length}
          stepLabel={currentStep.label}
        />

        <div
          ref={panelRef}
          tabIndex={-1}
          key={currentStep.id}
          id={`onboarding-step-${currentStep.id}`}
          className="outline-none"
        >
          <StepComponent value={form} onChange={handlePatch} />
        </div>
      </div>
    </OnboardingLayout>
  );
};

export default Onboarding;
