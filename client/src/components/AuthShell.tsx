import type { ReactNode } from 'react';
import { BoltIcon } from './icons';

interface AuthShellProps {
  /** Card heading, e.g. "Welcome back". */
  title: string;
  /** Short supporting line under the heading. */
  subtitle: string;
  children: ReactNode;
  /** Optional block rendered under the card (e.g. "Register" link). */
  footer?: ReactNode;
}

/**
 * Shared frame for every unauthenticated (auth) screen so Login and Register
 * share one visual design system. All styling comes from the Tailwind v4
 * component classes defined in src/index.css.
 */
const AuthShell = ({ title, subtitle, children, footer }: AuthShellProps) => (
  <main className="af-auth-bg">
    <div className="w-full max-w-md">
      {/* Application branding */}
      <div className="mb-7 flex flex-col items-center text-center">
        <span className="af-brand-mark">
          <BoltIcon />
        </span>
        <p className="mt-4 text-xl font-bold tracking-tight text-slate-900">AdaptiveFit</p>
        <p className="af-badge mt-2.5">AI Workout Planner</p>
      </div>

      {/* Auth card */}
      <section className="af-auth-card">
        <header className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{subtitle}</p>
        </header>
        {children}
      </section>

      {/* Footer content */}
      {footer ? <div className="mt-6 text-center text-sm text-slate-500">{footer}</div> : null}
    </div>
  </main>
);

export default AuthShell;