import { logger } from '../../config/logger';
import { ISystemConfig, SystemConfig } from './system.config.model';

export const DEFAULT_CONFIGS = [
    { key: 'maintenance_mode', value: false, category: 'maintenance', description: 'Enable entire system maintenance mode' },
    { key: 'allow_signups', value: true, category: 'feature_flags', description: 'Allow new user registrations' },
    { key: 'global_banner', value: '', category: 'communication', description: 'Global announcement banner text' },
];

import { IAdminConfigService } from './admin.interfaces';

export class AdminConfigService implements IAdminConfigService {

    /**
     * Initialize default configurations if they don't exist
     */
    async initDefaults(): Promise<void> {
        for (const config of DEFAULT_CONFIGS) {
            const exists = await SystemConfig.exists({ key: config.key });
            if (!exists) {
                await SystemConfig.create(config);
                logger.info(`Initialized default system config: ${config.key}`);
            }
        }
    }

    /**
     * Get all configurations
     */
    async getAllConfigs(): Promise<ISystemConfig[]> {
        return SystemConfig.find().sort({ category: 1, key: 1 });
    }

    /**
     * Get a specific configuration value
     */
    async getConfig(key: string): Promise<any> {
        const config = await SystemConfig.findOne({ key });
        return config ? config.value : null;
    }

    /**
     * Update configuration
     */
    async updateConfig(key: string, value: any, adminId: string): Promise<ISystemConfig | null> {
        const config = await SystemConfig.findOneAndUpdate(
            { key },
            {
                value,
                updatedBy: adminId
            },
            { new: true, runValidators: true }
        );

        if (config) {
            logger.info(`System config updated: ${key} = ${JSON.stringify(value)} by ${adminId}`);
            // Here we could emit an event to clear cache if we cache configs
        }

        return config;
    }
}

export const adminConfigService = new AdminConfigService();
