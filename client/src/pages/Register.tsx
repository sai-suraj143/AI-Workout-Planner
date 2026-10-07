import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../services/authService';
import AuthShell from '../components/AuthShell';
import { FormError, PasswordField, TextField } from '../components/AuthField';
import { LockIcon, MailIcon, SpinnerIcon, UserIcon } from '../components/icons';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const Register = () => {
  const registerMutation = useRegister();
  const register = registerMutation.mutateAsync;
  const isLoading = registerMutation.status === 'pending';
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormError(null);
    setFieldErrors(prev => ({ ...prev, [name]: undefined }));
  };

  // Mirrors server/src/validators/authValidators.ts -> registerSchema
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    const email = formData.email.trim();

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!email) {
      errors.email = 'Email address is required';
    } else if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Enter a valid email address';
    }
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    return errors;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password || errors.confirmPassword) return;

    try {
      await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });
    } catch (err: any) {
      if (err.response?.data?.message) {
        setFormError(err.response.data.message);
      } else {
        setFormError('An unexpected error occurred. Please try again.');
      }
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start building a workout plan that adapts to your goals, schedule and progress."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="af-link">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <TextField
          id="name"
          name="name"
          label="Full name"
          icon={<UserIcon />}
          autoComplete="name"
          placeholder="Alex Carter"
          value={formData.name}
          onChange={handleChange}
          error={fieldErrors.name}
        />

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
          autoComplete="new-password"
          placeholder="Create a password"
          value={formData.password}
          onChange={handleChange}
          error={fieldErrors.password}
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
          toggleLabel="New password"
        />

        <PasswordField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm password"
          icon={<LockIcon />}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={fieldErrors.confirmPassword}
          toggleLabel="Confirm password"
        />

        {/* Validation / error message area */}
        <FormError message={formError} />

        <button type="submit" disabled={isLoading} className="af-btn-primary">
          {isLoading ? (
            <>
              <SpinnerIcon />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </button>
      </form>
    </AuthShell>
  );
};

export default Register;