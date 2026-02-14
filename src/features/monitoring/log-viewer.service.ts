
export interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    meta?: any;
}

class LogViewerService {
    private logs: LogEntry[] = [];
    private readonly MAX_LOGS = 1000;

    public addLog(level: string, message: string, meta?: any): void {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            meta,
        };

        this.logs.push(entry);

        if (this.logs.length > this.MAX_LOGS) {
            this.logs.shift(); // Remove oldest
        }
    }

    public getLogs(): LogEntry[] {
        return [...this.logs];
    }

    public clear(): void {
        this.logs = [];
    }
}

export const logViewerService = new LogViewerService();
