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
}
