import { Link } from 'react-router-dom';
import { BoltIcon } from '../components/icons';

const Home = () => (
  <main className="af-auth-bg">
    <div className="w-full max-w-2xl text-center">
      <span className="af-brand-mark mx-auto">
        <BoltIcon />
      </span>

      <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        AdaptiveFit
      </h1>
      <p className="af-badge mt-3">AI Workout Planner</p>

      <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600">
        Generate adaptive workout plans, track your progress, and reach your goals with
        AI-powered insights that evolve as you get stronger.
      </p>

      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/login" className="af-btn-primary">
          Log in
        </Link>
        <Link to="/register" className="af-btn-secondary">
          Create account
        </Link>
      </div>
    </div>
  </main>
);

export default Home;