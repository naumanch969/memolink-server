import { addDays, addMonths, addWeeks, addYears, isAfter, startOfDay } from 'date-fns';
import { RecurrenceFrequency } from './reminder.types';

/**
 * Calculate the next occurrence date for a recurring reminder
 */
export function calculateNextOccurrence(
    currentDate: Date,
    frequency: RecurrenceFrequency,
    interval: number = 1,
    daysOfWeek?: number[],
    endDate?: Date
): Date | null {
    let nextDate: Date = new Date(currentDate);

    switch (frequency) {
        case RecurrenceFrequency.DAILY:
            nextDate = addDays(nextDate, interval);
            break;

        case RecurrenceFrequency.WEEKLY:
            if (daysOfWeek && daysOfWeek.length > 0) {
                // Find the next day in the specified days of week
                let found = false;
                for (let i = 1; i <= 7 * interval; i++) {
                    const candidate = addDays(nextDate, i);
                    if (daysOfWeek.includes(candidate.getDay())) {
                        nextDate = candidate;
                        found = true;
                        break;
                    }
                }
                if (!found) return null;
            } else {
                nextDate = addWeeks(nextDate, interval);
            }
            break;

        case RecurrenceFrequency.MONTHLY:
            nextDate = addMonths(nextDate, interval);
            break;

        case RecurrenceFrequency.YEARLY:
            nextDate = addYears(nextDate, interval);
            break;

        case RecurrenceFrequency.CUSTOM:
            // Custom logic could be complex, for now default to daily interval
            nextDate = addDays(nextDate, interval);
            break;

        default:
            return null;
    }

    // Check if next date exceeds end date
    if (endDate && isAfter(startOfDay(nextDate), startOfDay(endDate))) {
        return null;
    }

    return nextDate;
}
