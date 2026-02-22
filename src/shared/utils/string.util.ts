import { SEARCH } from '../constants';

export class StringUtil {
    /**
     * Sanitizes a string for MongoDB $text search
     */
    static sanitizeSearchQuery(query: string): string {
        if (!query || typeof query !== 'string') return '';
        return query.trim().slice(0, SEARCH.MAX_QUERY_LENGTH);
    }

    /**
     * Converts a string to a URL-friendly slug
     */
    static slugify(text: string): string {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Truncates text to a maximum length with an ellipsis
     */
    static truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.slice(0, maxLength).trim() + '...';
    }

    /**
     * Generates a random alphanumeric hash
     */
    static generateHash(length: number = 32): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Extracts mentions (starting with @) from text
     */
    static extractMentions(text: string): string[] {
        const mentionRegex = /@(\w+)/g;
        const mentions: string[] = [];
        let match;

        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }

        return Array.from(new Set(mentions)); // Return unique mentions
    }
}
