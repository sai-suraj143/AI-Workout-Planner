import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { User } from '../models/User';

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.token;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const userId = AuthService.verifyToken(token);
    const user = await AuthService.getUserById(userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};