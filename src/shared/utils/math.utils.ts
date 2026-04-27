export class MathUtil {
    /**
     * Calculates the average of a list of numbers.
     * Rounds to the specified precision.
     */
    static average(values: number[], precision: number = 1): number {
        if (values.length === 0) return 0;
        const total = values.reduce((sum, val) => sum + val, 0);
        const avg = total / values.length;
        const factor = Math.pow(10, precision);
        return Math.round(avg * factor) / factor;
    }
}
