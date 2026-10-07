import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import Planner from './pages/Planner';
import Workout from './pages/Workout';
import Analytics from './pages/Analytics';
import History from './pages/History';
import RequireAuth from './components/RequireAuth';
import AuthLayout from './components/AuthLayout';

// Create a client instance for TanStack Query
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Dashboard />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Onboarding />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/planner"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Planner />
                </AuthLayout>
              </RequireAuth>
            }
          />
          {/* Generated plan detail — the history list links here. */}
          <Route
            path="/planner/:id"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Planner />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/workout"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Workout />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/workout/:planId/:dayIndex"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Workout />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequireAuth>
                <AuthLayout>
                  <Analytics />
                </AuthLayout>
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <AuthLayout>
                  <History />
                </AuthLayout>
              </RequireAuth>
            }
          />
          {/* Add a catch-all route for 404 if needed */}
          <Route path="*" element={<h1>404 - Not Found</h1>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;