import mongoose from 'mongoose';

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not configured. Set it before starting the server.');
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    if (error instanceof Error) {
      console.error(`MongoDB connection failed: ${error.message}`);
    } else {
      console.error('MongoDB connection failed:', error);
    }
    throw error;
  }
};

export default connectDB;