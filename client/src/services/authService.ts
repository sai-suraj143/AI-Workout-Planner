import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { useNavigate } from 'react-router-dom';

// Types for auth
export interface User {
  id: string;
  name: string;
  email: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

// Shape of the auth API response envelope: { success: true, user: {...} }
interface AuthEnvelope {
  success: boolean;
  message?: string;
  user?: User;
}

// API functions
export const registerAPI = async (data: RegisterData): Promise<{ user: User }> => {
  const response = await apiClient.post<AuthEnvelope>('/auth/register', data);
  return { user: response.data.user as User };
};

export const loginAPI = async (data: LoginData): Promise<{ user: User }> => {
  const response = await apiClient.post<AuthEnvelope>('/auth/login', data);
  return { user: response.data.user as User };
};

export const logoutAPI = async (): Promise<{ success: boolean }> => {
  const response = await apiClient.post<{ success: boolean; message?: string }>('/auth/logout');
  return { success: response.data.success };
};

export const getCurrentUserAPI = async (): Promise<User> => {
  const response = await apiClient.get<AuthEnvelope>('/auth/me');
  return response.data.user as User;
};

// Hooks
export const useRegister = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: registerAPI,
    onSuccess: (data) => {
      // Set user data in query client
      queryClient.setQueryData(['user'], data.user);
      navigate('/onboarding');
    },
  });
};

export const useLogin = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: loginAPI,
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data.user);
      navigate('/dashboard');
    },
  });
};

export const useLogout = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: logoutAPI,
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['user'] });
      // The saved fitness profile belongs to the account that just signed out.
      // Without dropping it here, the next account on this machine would read
      // (and pre-fill onboarding from) the previous user's cached answers.
      queryClient.removeQueries({ queryKey: ['profile'] });
      navigate('/login');
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['user'],
    queryFn: getCurrentUserAPI,
    staleTime: Infinity, // We'll keep the user data until logout or refresh
  });
};

export const useAuth = () => {
  const { data: user, isLoading, error } = useCurrentUser();
  const registerMutation = useRegister();
  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  return {
    user,
    isLoading,
    error,
    register: registerMutation.mutateAsync,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
  };
};