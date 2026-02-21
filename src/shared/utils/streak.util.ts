
export class StreakUtil {
    /**
     * Calculates the current and longest streak from a list of dates.
     * @param dates Array of dates or timestamps
     * @param graceDays Number of days allowed between entries before streak breaks (default: 1 for strict daily)
     */
    static calculate(dates: (Date | number)[], graceDays: number = 1): {
        currentStreak: number;
        longestStreak: number;
        lastDate: Date | null;
    } {
        if (!dates.length) {
            return { currentStreak: 0, longestStreak: 0, lastDate: null };
        }

        // Normalize to start of day timestamps and sort unique descending
        const sortedTimestamps = Array.from(
            new Set(
                dates.map(d => {
                    const date = new Date(d);
                    date.setHours(0, 0, 0, 0);
                    return date.getTime();
                })
            )
        ).sort((a, b) => b - a);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTime = today.getTime();

        const lastEntryTime = sortedTimestamps[0];
        const daysSinceLast = (todayTime - lastEntryTime) / (1000 * 60 * 60 * 24);

        let longestStreak = 0;
        let currentStreak = 0;
        let tempStreak = 1;

        // Calculate longest and current streaks in one pass
        for (let i = 0; i < sortedTimestamps.length - 1; i++) {
            const curr = sortedTimestamps[i];
            const next = sortedTimestamps[i + 1];
            const diffDays = (curr - next) / (1000 * 60 * 60 * 24);

            if (diffDays <= graceDays) {
                tempStreak++;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
            }
        }
        longestStreak = Math.max(longestStreak, tempStreak);

        // Current streak only counts if the last entry was recent enough
        if (daysSinceLast <= graceDays) {
            let currStr = 1;
            for (let i = 0; i < sortedTimestamps.length - 1; i++) {
                const curr = sortedTimestamps[i];
                const next = sortedTimestamps[i + 1];
                const diffDays = (curr - next) / (1000 * 60 * 60 * 24);

                if (diffDays <= graceDays) {
                    currStr++;
                } else {
                    break;
                }
            }
            currentStreak = currStr;
        }

        return {
            currentStreak,
            longestStreak,
            lastDate: new Date(lastEntryTime)
        };
    }
}
