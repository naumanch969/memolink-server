import { Types } from 'mongoose';
import { toZonedTime } from 'date-fns-tz';
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

  private readonly imagePool = [
    "Got the image. Saving it to your vault.",
    "Image received. Storing it in your timeline.",
    "Nice shot. Logged and saved.",
    "Image saved. I'll analyze it for you.",
  ];

  private readonly videoPool = [
    "Got the video. Processing it now.",
    "Video received. Saving it for you.",
    "Logged the video. Give me a moment to store it.",
  ];

  private readonly documentPool = [
    "Got the document. Saving it to your files.",
    "Document received. Storing it safely.",
    "File saved. I'll process the content shortly.",
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

  async generateResponse(userId: string | Types.ObjectId, entry: IEntry, userContext?: { timezone: string; timezoneUpdatedAt?: Date }): Promise<string> {
    try {
      // 1. CONTEXTUAL: Entry Type / Media Type
      const metadata = entry.metadata || {};
      
      if (metadata.isImage) return this.getRandom(this.imagePool);
      if (metadata.isVideo) return this.getRandom(this.videoPool);
      if (metadata.isDocument) return this.getRandom(this.documentPool);
      
      if (metadata.isVoice || entry.type === 'media') {
        return this.getRandom(this.audioPool);
      }

      // 2. CONTEXTUAL: Time of Day
      const greeting = this.getTimeBasedGreeting(userContext?.timezone, userContext?.timezoneUpdatedAt);
      if (greeting) return greeting;

      // 3. STREAK / COUNT
      const stats = await entryService.getEntryStats(userId);
      const todayCount = stats.entriesToday;

      if (todayCount === 1) {
        return "First entry of the day. Logged.";
      }

      if (todayCount === 5) {
        return "Five entries today. You're on a roll.";
      }

      if (todayCount === 10) {
        return "Tenth entry today. Deep reflection mode engaged.";
      }

      // 4. RANDOM FALLBACK
      return this.getRandom(this.randomPool);
    } catch (error) {
      logger.error('Error generating reception response:', error);
      return "Got it. Saved.";
    }
  }

  private getRandom(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private getTimeBasedGreeting(timezone: string = 'UTC', timezoneUpdatedAt?: Date): string | null {
    // Safety Valve: If timezone is stale (e.g. > 48h), return null to avoid wrong greetings
    // This happens if a traveler hasn't opened the app to "pulse" their new timezone.
    if (timezoneUpdatedAt) {
      const isStale = (Date.now() - new Date(timezoneUpdatedAt).getTime()) > 48 * 60 * 60 * 1000;
      if (isStale) {
        logger.debug('Timezone stale, skipping time-based greeting', { timezone });
        return null; 
      }
    }

    try {
      const zonedDate = toZonedTime(new Date(), timezone);
      const hour = zonedDate.getHours();

      if (hour >= 5 && hour < 12) return this.getRandom(this.greetingPools.morning);
      if (hour >= 12 && hour < 17) return this.getRandom(this.greetingPools.afternoon);
      if (hour >= 17 && hour < 22) return this.getRandom(this.greetingPools.evening);
      if (hour >= 22 || hour < 5) return this.getRandom(this.greetingPools.night);
    } catch (error) {
      logger.error('Error calculating localized hour for reception:', error);
    }
    
    return null;
  }
}

export const receptionService = new ReceptionService();
export default receptionService;