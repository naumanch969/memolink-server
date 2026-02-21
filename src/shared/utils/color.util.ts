export class ColorUtil {
    /**
     * Generates a random hexadecimal color code
     */
    static generateRandomHexColor(): string {
        const hex = Math.floor(Math.random() * 16777215).toString(16);
        return '#' + hex.padStart(6, '0');
    }
}
