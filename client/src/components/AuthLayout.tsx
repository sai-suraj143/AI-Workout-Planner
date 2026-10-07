import { useState } from 'react';
import { useAuth } from '../services/authService';
import { Link } from 'react-router-dom';
import { BoltIcon, SpinnerIcon } from './icons';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/planner', label: 'Planner' },
  { to: '/workout', label: 'Workout' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/history', label: 'History' },
];

const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">
        <SpinnerIcon className="mr-2.5 h-5 w-5 text-brand-600" />
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-sm font-medium text-slate-500">
        Please log in.
      </div>
    );
  }

  return (
    <div className="af-app-shell">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="af-brand-mark h-9 w-9 rounded-xl shadow-md">
              <BoltIcon className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              AdaptiveFit
            </span>
          </div>
          <nav className="hidden md:block">
            <div className="flex items-center gap-1">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsSidebarOpen(false)}
                  className="af-nav-link"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleToggleSidebar}
              className="md:hidden p-2 rounded hover:bg-gray-200"
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-medium text-slate-500 sm:inline">
                Welcome, {user.name ?? 'User'}!
              </span>
              <span className="af-avatar" aria-hidden="true">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </span>
              <button onClick={handleLogout} className="af-logout-button">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      <div className="flex flex-1">
        {/* Mobile drawer backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-slate-900/50 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Mobile drawer / static desktop sidebar */}
        <aside
          className={`${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200 bg-white pt-16
            transition-transform duration-300 md:static md:z-auto md:h-auto md:translate-x-0 md:pt-0`}
        >
          <div className="px-6 pt-6">
            <div className="mb-6 flex items-center gap-3">
              <span className="af-avatar">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user.name ?? 'User'}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <nav className="space-y-1 pb-6">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsSidebarOpen(false)}
                  className="af-nav-link block"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;