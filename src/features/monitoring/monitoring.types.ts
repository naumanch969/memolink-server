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

export interface IMonitoringService {
    getDashboardMetrics(): Promise<any>;
    getFullHealth(): Promise<SystemHealth>;
    getDatabaseStats(): Promise<any>;
    getInfrastructureMetrics(): Promise<any>;
    getJobQueues(): Promise<any>;
}

export interface IMetricsService {
    recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void;
    recordDbQuery(operation: string, collection: string, duration: number): void;
    getMetrics(): Promise<string>;
    getMetricsJSON(): Promise<any>;
}

export interface ILogViewerService {
    addLog(level: string, message: string, meta?: any): void;
    getLogs(): any[];
    clear(): void;
}



