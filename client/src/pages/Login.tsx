import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLogin } from '../services/authService';
import AuthShell from '../components/AuthShell';
import { FormError, PasswordField, TextField } from '../components/AuthField';
import { LockIcon, MailIcon, SpinnerIcon } from '../components/icons';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

const Login = () => {
  const loginMutation = useLogin();
  const login = loginMutation.mutateAsync;
  const isLoading = loginMutation.status === 'pending';
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormError(null);
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  };

  // Mirrors server/src/validators/authValidators.ts -> loginSchema
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const email = formData.email.trim();
    if (!email) {
      errors.email = 'Email address is required';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Enter a valid email address';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    }
    return errors;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    try {
      await login({ email: formData.email.trim(), password: formData.password });
    } catch (err: any) {
      // Handle API error
      if (err.response?.data?.message) {
        setFormError(err.response.data.message);
      } else {
        setFormError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your AdaptiveFit account and let our AI build a workout plan that adapts to your progress."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="af-link">
            Create one free
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="email"
          name="email"
          type="email"
          label="Email address"
          icon={<MailIcon />}
          autoComplete="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange}
          error={fieldErrors.email}
        />

        <PasswordField
          id="password"
          name="password"
          label="Password"
          icon={<LockIcon />}
          autoComplete="current-password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={handleChange}
          error={fieldErrors.password}
          toggleLabel="Password"
        />

        {/* Validation / error message area */}
        <FormError message={formError} />

        <button type="submit" disabled={isLoading} className="af-btn-primary">
          {isLoading ? (
            <>
              <SpinnerIcon />
              Signing in…
            </>
          ) : (
            'Log in'
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default Login;