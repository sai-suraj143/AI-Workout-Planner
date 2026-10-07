import { User, IUser } from '../models/User';
import { sign, verify } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

interface JwtPayload {
  userId: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(name: string, email: string, password: string): Promise<IUser> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user instance with hashed password
    const user = new User({ name, email, passwordHash });
    await user.save();
    return user;
  }

  /**
   * Login user and return user object and token
   */
  static async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const token = AuthService.generateToken(user._id.toString());
    return { user, token };
  }

  /**
   * Generate JWT token
   */
  static generateToken(userId: string): string {
    const secret = process.env.JWT_SECRET as string;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    return sign({ userId }, secret, { expiresIn: '7d' });
  }

  /**
   * Verify JWT token and return userId
   */
  static verifyToken(token: string): string {
    const secret = process.env.JWT_SECRET as string;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined');
    }
    try {
      const payload = verify(token, secret) as JwtPayload;
      return payload.userId;
    } catch (err) {
      throw new Error('Invalid token');
    }
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string): Promise<IUser | null> {
    return User.findById(userId).select('-passwordHash');
  }
}