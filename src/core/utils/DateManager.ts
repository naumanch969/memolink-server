
import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export class DateManager {
    /**
     * Standard format for daily keys (YYYY-MM-DD)
     */
    private static readonly DAILY_FORMAT = 'yyyy-MM-dd';

    /**
     * Get the current date key for a specific timezone
     * Falls back to UTC if no timezone is provided
     */
    static getLocalDateKey(timezone: string = 'UTC', date: Date = new Date()): string {
        try {
            return formatInTimeZone(date, timezone, this.DAILY_FORMAT);
        } catch (error) {
            // Fallback to basic ISO if timezone is invalid
            return format(date, this.DAILY_FORMAT);
        }
    }

    /**
     * Get yesterday's date key for a specific timezone
     */
    static getYesterdayDateKey(timezone: string = 'UTC'): string {
        const yesterday = subDays(new Date(), 1);
        return this.getLocalDateKey(timezone, yesterday);
    }

    /**
     * Parse a date string and return a Date object at the start of that day in the given timezone
     */
    static getStartOfDayInTimezone(dateStr: string, timezone: string = 'UTC'): Date {
        const date = parseISO(dateStr);
        const zonedDate = toZonedTime(date, timezone);
        return startOfDay(zonedDate);
    }

    /**
     * Formats a date for display
     */
    static formatDisplay(date: Date | string, formatStr: string = 'PPP'): string {
        const d = typeof date === 'string' ? parseISO(date) : date;
        return format(d, formatStr);
    }

    /**
     * Check if a date string is a valid YYYY-MM-DD format
     */
    static isValidDateKey(dateStr: string): boolean {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    }

    /**
     * Returns the current timestamp in seconds
     */
    static nowInSeconds(): number {
        return Math.floor(Date.now() / 1000);
    }

    /**
     * Normalizes a date to 00:00:00 UTC
     */
    static normalizeToUTC(date: Date | string): Date {
        const d = typeof date === 'string' ? parseISO(date) : new Date(date);
        const normalized = new Date(d);
        normalized.setUTCHours(0, 0, 0, 0);
        return normalized;
    }

    /**
     * Get a reference date (start of day) based on a timezone offset in minutes
     */
    static getReferenceNow(timezoneOffset?: number): Date {
        const now = new Date();
        if (timezoneOffset !== undefined) {
            now.setMinutes(now.getMinutes() - timezoneOffset);
        }
        now.setUTCHours(0, 0, 0, 0);
        return now;
    }

    /**
     * Get the difference between two dates in days
     */
    static getDiffDays(d1: Date, d2: Date): number {
        const msPerDay = 1000 * 60 * 60 * 24;
        const normalized1 = new Date(d1);
        normalized1.setUTCHours(0, 0, 0, 0);
        const normalized2 = new Date(d2);
        normalized2.setUTCHours(0, 0, 0, 0);
        return Math.round((normalized1.getTime() - normalized2.getTime()) / msPerDay);
    }

    /**
     * Safely parse anything to a Date object at start of day UTC
     */
    static parseToDate(input: any): Date {
        if (!input) return new Date();
        const d = input instanceof Date ? input : parseISO(String(input));
        return this.normalizeToUTC(d);
    }
}

export default DateManager;
