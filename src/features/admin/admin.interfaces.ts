import { BackupFile, BackupRun } from './admin.types';
import { ISystemConfig } from './system.config.model';

export interface IAdminService {
    listBackups(): Promise<BackupFile[]>;
    triggerBackup(): Promise<void>;
    getBackupRuns(): Promise<BackupRun[]>;
}

export interface IAdminConfigService {
    initDefaults(): Promise<void>;
    getAllConfigs(): Promise<ISystemConfig[]>;
    getConfig(key: string): Promise<any>;
    updateConfig(key: string, value: any, adminId: string): Promise<ISystemConfig | null>;
}
