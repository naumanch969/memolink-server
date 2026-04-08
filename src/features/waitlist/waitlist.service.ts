import { Waitlist, IWaitlist } from './waitlist.model';
import { logger } from '../../config/logger';

export class WaitlistService {
  /**
   * Add email to waitlist
   */
  static async addToWaitlist(
    email: string,
    source: IWaitlist['source'] = 'landing',
    notes?: string
  ): Promise<IWaitlist> {
    // Check if email already exists
    const existing = await Waitlist.findByEmail(email);
    if (existing) {
      const error = new Error('Email already on waitlist');
      (error as any).statusCode = 409;
      throw error;
    }

    // Create new waitlist entry
    const waitlistEntry = new Waitlist({
      email: email.toLowerCase(),
      status: 'pending',
      source,
      ...(notes ? { notes } : {}),
    });

    await waitlistEntry.save();
    logger.info(`Email added to waitlist: ${email}`);

    return waitlistEntry;
  }

  /**
   * Get all waitlist entries
   */
  static async getAllWaitlist(limit = 100, skip = 0) {
    const entries = await Waitlist.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip);

    const total = await Waitlist.countDocuments();

    return { entries, total };
  }

  /**
   * Update waitlist entry status
   */
  static async updateStatus(
    email: string,
    status: 'pending' | 'verified' | 'converted'
  ): Promise<IWaitlist | null> {
    return Waitlist.findOneAndUpdate(
      { email: email.toLowerCase() },
      { status },
      { new: true }
    );
  }

  /**
   * Count total waitlist entries
   */
  static async getWaitlistCount(): Promise<number> {
    return Waitlist.countDocuments();
  }

  /**
   * Get waitlist count by status
   */
  static async getCountByStatus() {
    const counts = await Waitlist.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    return counts;
  }
}
