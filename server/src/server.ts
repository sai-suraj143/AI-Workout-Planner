import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import connectDB from './config/database';
import authRoutes from './routes/authRoutes';
import profileRoutes from './routes/profileRoutes';
import planRoutes from './routes/planRoutes';
import adaptationRoutes from './routes/adaptationRoutes';
import workoutLogRoutes from './routes/workoutLogRoutes';
import analyticsRoutes from './routes/analyticsRoutes';

// Load environment variables
dotenv.config();

const requiredEnvVars = ['NODE_ENV', 'PORT', 'MONGODB_URI', 'JWT_SECRET', 'GEMINI_API_KEY', 'CLIENT_URL'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.warn(`[server] Missing environment variables: ${missingEnvVars.join(', ')}`);
}

const clientOrigins = (process.env.CLIENT_URL ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
  .concat('http://localhost:5173', 'http://localhost:5174');

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (clientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

const app: Express = express();
const PORT = Number(process.env.PORT || 5000);

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Auth and profile routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/adaptation', adaptationRoutes);
app.use('/api/workouts', workoutLogRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check route
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'AI Workout Planner API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
  });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;