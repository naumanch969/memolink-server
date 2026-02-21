export class DateUtil {
    /**
     * Safely parses a date string into a Date object
     */
    static parseDate(dateString: string): Date | null {
        if (!dateString) return null;
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
    }

    /**
     * Formats a Date object as YYYY-MM-DD
     */
    static formatDate(date: Date): string {
        return date.toISOString().split('T')[0];
    }

    /**
     * Generates a date range object for MongoDB queries
     */
    static getDateRange(dateFrom?: string, dateTo?: string) {
        const from = dateFrom ? this.parseDate(dateFrom) : null;
        const to = dateTo ? this.parseDate(dateTo) : null;

        if (to) {
            to.setHours(23, 59, 59, 999); // Set to end of day
        }

        return { from, to };
    }

    /**
     * Returns a fuzzy "time ago" string (e.g., "2h ago")
     */
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
}
