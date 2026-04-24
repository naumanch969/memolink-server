import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { IEntry } from '../entry/entry.types';
import { entryService } from '../entry/entry.service';

export class ReceptionService {
  private readonly greetingPools = {
    morning: [
      "Got it. Good morning.",
      "Morning. Saved.",
      "Early start. Noted.",
      "Got your morning thought.",
      "Saved. Good morning.",
    ],
    afternoon: [
      "Got it.",
      "Saved.",
      "Noted.",
      "Logged.",
      "Got that.",
    ],
    evening: [
      "Got it. Good evening.",
      "Saved for the evening.",
      "Noted. Good evening.",
      "Logged. Hope the day went well.",
      "Got that one.",
    ],
    night: [
      "Still here. Got it.",
      "Saved. Get some rest.",
      "Noted. Late night thought secured.",
      "Got it. Sleep well.",
      "Logged. Don't let it keep you up.",
    ]
  };

  private readonly audioPool = [
    "Got the voice note. Transcribing now.",
    "Audio saved. Give me a moment to process it.",
    "Voice memo received. Transcript coming shortly.",
    "Got it. Working on the transcript now.",
    "Saved the recording. Pulling the text now.",
  ];

  private readonly randomPool = [
    "Got it.",
    "Saved.",
    "Noted.",
    "Logged.",
    "Got that.",
    "On it.",
    "Done.",
    "Saved to your vault.",
    "Yep, got it.",
    "All good. Saved.",
    "That one's locked in.",
    "Safe with me.",
  ];

  async generateResponse(userId: string | Types.ObjectId, entry: IEntry): Promise<string> {
    try {
      // 1. CONTEXTUAL: Entry Type
      const hasAudio = entry.type === 'media' || (entry.media && entry.media.length > 0);
      if (hasAudio) {
        return this.getRandom(this.audioPool);
      }

      // 2. CONTEXTUAL: Time of Day
      const greeting = this.getTimeBasedGreeting();
      if (greeting) return greeting;

      // 3. STREAK / COUNT
      const stats = await entryService.getEntryStats(userId);
      const todayCount = stats.entriesToday;

      if (todayCount > 1) {
        if (todayCount === 5)  return "5 entries today. Nice.";
        if (todayCount === 10) return "10 today. You're on a roll.";
        if (todayCount % 5 === 0) return `${todayCount} entries today. Vault's filling up.`;
        if (todayCount === 3)  return "Third one today. Keep going.";
      }

      // 4. RANDOM POOL (Fallback)
      return this.getRandom(this.randomPool);
    } catch (error) {
      logger.error('Failed to generate reception response:', error);
      return "Got it.";
    }
  }

  private getTimeBasedGreeting(): string | null {
    const hour = new Date().getHours();
    if (hour >= 5  && hour < 11) return this.getRandom(this.greetingPools.morning);
    if (hour >= 11 && hour < 17) return this.getRandom(this.greetingPools.afternoon);
    if (hour >= 17 && hour < 21) return this.getRandom(this.greetingPools.evening);
    if (hour >= 21 || hour  < 5) return this.getRandom(this.greetingPools.night);
    return null;
  }

  private getRandom(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)];
  }
}

export const receptionService = new ReceptionService();
export default receptionService;