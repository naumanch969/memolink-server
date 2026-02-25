import { SystemHealth } from "./monitoring.types";

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
