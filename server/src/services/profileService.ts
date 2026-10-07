import { FitnessProfile, IFitnessProfile } from '../models/FitnessProfile';
import { User, IUser } from '../models/User';

export class ProfileService {
  /**
   * Get fitness profile by user ID
   */
  static async getProfileByUserId(userId: string): Promise<IFitnessProfile | null> {
    return FitnessProfile.findOne({ userId });
  }

  /**
   * Create or update fitness profile for a user
   * @param userId - The user's ID
   * @param data - The profile data to save
   */
  static async createOrUpdateProfile(userId: string, data: Partial<IFitnessProfile>): Promise<IFitnessProfile> {
    // Ensure the user exists
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Find existing profile
    let profile = await FitnessProfile.findOne({ userId });

    if (profile) {
      // Update existing profile
      Object.assign(profile, data);
      await profile.save();
    } else {
      // Create new profile
      profile = new FitnessProfile({ ...data, userId });
      await profile.save();
    }

    return profile;
  }
}