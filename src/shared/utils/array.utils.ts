export class ArrayUtil {
    /**
     * Removes duplicate values from an array
     */
    static removeDuplicates<T>(array: T[]): T[] {
        return [...new Set(array)];
    }

    /**
     * Splits an array into smaller chunks of a specific size
     */
    static chunk<T>(array: T[], size: number): T[][] {
        const chunks: T[][] = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }

    /**
     * Groups array elements by value and returns them sorted by frequency (descending)
     */
    static sortByFrequency<T extends string | number>(array: T[]): [T, number][] {
        const freq: Record<string, number> = {};
        for (const item of array) {
            const key = String(item);
            freq[key] = (freq[key] ?? 0) + 1;
        }

        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .map(([val, count]) => [ (typeof array[0] === 'number' ? Number(val) : val) as T, count]);
    }
}
