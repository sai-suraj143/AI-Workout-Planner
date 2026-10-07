import type { ReactNode } from 'react';

interface OnboardingLayoutProps {
  /** Small brand-coloured kicker above the page heading. */
  eyebrow: string;
  /** Page-level heading (the single <h1> on the page). */
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Optional bar pinned to the bottom of the card (step navigation). */
  footer?: ReactNode;
}

/**
 * Page frame for the onboarding wizard.
 *
 * It sits inside the shared authenticated shell (`AuthLayout`), so it provides
 * the centred container + polished card rather than a second full-screen
 * background. Spacing and surfaces come from the same Tailwind v4 design
 * system classes the Login/Register pages use.
 */
const OnboardingLayout = ({ eyebrow, title, subtitle, children, footer }: OnboardingLayoutProps) => (
  <div className="mx-auto w-full max-w-3xl pb-8">
    <header className="mb-6">
      <p className="text-sm font-medium text-brand-600">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>
    </header>

    <div className="af-card">
      <div className="px-5 py-6 sm:px-7 sm:py-7 lg:px-8">{children}</div>
      {footer ? (
        <div className="rounded-b-2xl border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-7 lg:px-8">
          {footer}
        </div>
      ) : null}
    </div>
  </div>
);

export default OnboardingLayout;
