import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema, LogoutInput } from '../validators/authValidators';
import { AuthService } from '../services/authService';
import { z, ZodError } from 'zod';
import { User } from '../models/User';

const getTokenCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  } as const;
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const parsed = registerSchema.parse(req.body);
    const { name, email, password } = parsed;

    // Register user
    const user = await AuthService.register(name, email, password);

    // Generate token
    const token = AuthService.generateToken(user._id.toString());

    // Set HTTP-only cookie
    res.cookie('token', token, getTokenCookieOptions());

    // Return safe user data
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: 'Invalid input', errors: (error as any).errors });
    }
    if (error instanceof Error && error.message === 'User with this email already exists') {
      return res.status(409).json({ success: false, message: error.message });
    }
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const parsed = loginSchema.parse(req.body);
    const { email, password } = parsed;

    // Login user
    const { user, token } = await AuthService.login(email, password);

    // Set HTTP-only cookie
    res.cookie('token', token, getTokenCookieOptions());

    // Return safe user data
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return res.status(400).json({ success: false, message: 'Invalid input', errors: (error as any).errors });
    }
    // Generic error to avoid leaking whether email exists
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
};

export const logout = async (_req: Request, res: Response) => {
  // Clear the cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ success: true, message: 'Logged out' });
};

export const me = async (req: Request, res: Response) => {
  // The user is attached to the request by the authMiddleware
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }
  res.json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
    },
  });
};