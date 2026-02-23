import { format, parseISO, startOfDay, subDays } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export class DateUtil {
    // Standard format for daily keys (YYYY-MM-DD)
    private static readonly DAILY_FORMAT = 'yyyy-MM-dd';

    // Safely parses a date string into a Date object
    static parseDate(dateString: string): Date | null {
        if (!dateString) return null;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    // Formats a Date object as YYYY-MM-DD
    static formatDate(date: Date): string {
        try {
            return format(date, this.DAILY_FORMAT);
        } catch {
            return date.toISOString().split('T')[0];
        }
    }

    // Generates a date range object for MongoDB queries
    static getDateRange(dateFrom?: string, dateTo?: string) {
        const from = dateFrom ? this.parseDate(dateFrom) : null;
        const to = dateTo ? this.parseDate(dateTo) : null;

        if (to) {
            to.setHours(23, 59, 59, 999); // Set to end of day
        }

        return { from, to };
    }

    // Returns a fuzzy "time ago" string (e.g., "2h ago")
    static getTimeAgo(date: Date): string {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
        if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
        return `${Math.floor(diffInSeconds / 31536000)}y ago`;
    }

    // --- Methods from DateManager ---

    // Get the current date key for a specific timezone
    static getLocalDateKey(timezone: string = 'UTC', date: Date = new Date()): string {
        try {
            return formatInTimeZone(date, timezone, this.DAILY_FORMAT);
        } catch (error) {
            // Fallback to basic ISO if timezone is invalid
            return format(date, this.DAILY_FORMAT);
        }
    }

    // Get yesterday's date key for a specific timezone
    static getYesterdayDateKey(timezone: string = 'UTC'): string {
        const yesterday = subDays(new Date(), 1);
        return this.getLocalDateKey(timezone, yesterday);
    }

    // Parse a date string and return a Date object at the start of that day in the given timezone
    static getStartOfDayInTimezone(dateStr: string, timezone: string = 'UTC'): Date {
        const date = parseISO(dateStr);
        const zonedDate = toZonedTime(date, timezone);
        return startOfDay(zonedDate);
    }

    // Formats a date for display
    static formatDisplay(date: Date | string, formatStr: string = 'PPP'): string {
        const d = typeof date === 'string' ? parseISO(date) : date;
        return format(d, formatStr);
    }

    // Check if a date string is a valid YYYY-MM-DD format
    static isValidDateKey(dateStr: string): boolean {
        return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    }

    // Returns the current timestamp in seconds
    static nowInSeconds(): number {
        return Math.floor(Date.now() / 1000);
    }

    // Normalizes a date to 00:00:00 UTC
    static normalizeToUTC(date: Date | string): Date {
        const d = typeof date === 'string' ? parseISO(date) : new Date(date);
        const normalized = new Date(d);
        normalized.setUTCHours(0, 0, 0, 0);
        return normalized;
    }

    // Get a reference date (start of day) based on a timezone offset in minutes
    static getReferenceNow(timezoneOffset?: number): Date {
        const now = new Date();
        if (timezoneOffset !== undefined) {
            now.setMinutes(now.getMinutes() - timezoneOffset);
        }
        now.setUTCHours(0, 0, 0, 0);
        return now;
    }

    // Get the difference between two dates in days
    static getDiffDays(d1: Date, d2: Date): number {
        const msPerDay = 1000 * 60 * 60 * 24;
        const normalized1 = new Date(d1);
        normalized1.setUTCHours(0, 0, 0, 0);
        const normalized2 = new Date(d2);
        normalized2.setUTCHours(0, 0, 0, 0);
        return Math.round((normalized1.getTime() - normalized2.getTime()) / msPerDay);
    }

    // Safely parse anything to a Date object at start of day UTC
    static parseToDate(input: any): Date {
        if (!input) return new Date();
        const d = input instanceof Date ? input : parseISO(String(input));
        return this.normalizeToUTC(d);
    }
}

export default DateUtil;
