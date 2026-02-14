export interface SystemHealth {
    status: 'healthy' | 'unhealthy';
    uptime: {
        seconds: number;
        formatted: string;
    };
    timestamp: Date;
    environment: string;
    version: string;
    memory: {
        total: number;
        free: number;
        used: number;
        usagePercentage: number;
        rss: string;
        heapTotal: string;
        heapUsed: string;
    };
    cpu: {
        loadAvg: number[];
        cores: number;
    };
    database: {
        connected: boolean;
        status: string;
    };
    redis: {
        connected: boolean;
        status: string;
    };
}
