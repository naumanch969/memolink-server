import { GetObjectCommand, ListObjectsV2Command, S3Client, _Object } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../../config/env';
import { logger } from '../../config/logger';

import { IAdminService } from './admin.interfaces';
import { BackupFile, BackupRun } from './admin.types';

class AdminService implements IAdminService {
    private s3Client: S3Client;

    constructor() {
        // Initialize S3 Client for Cloudflare R2
        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.R2_ACCESS_KEY_ID,
                secretAccessKey: config.R2_SECRET_ACCESS_KEY,
            },
        });
    }

    /**
     * List all backups from R2 bucket
     */
    async listBackups(): Promise<BackupFile[]> {
        try {
            const command = new ListObjectsV2Command({
                Bucket: config.R2_BUCKET_NAME,
            });

            const response = await this.s3Client.send(command);

            if (!response.Contents) {
                return [];
            }

            // Sort by date descending (newest first)
            const sortedContents = response.Contents.sort((a: _Object, b: _Object) => {
                return (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0);
            });

            const backups: BackupFile[] = await Promise.all(
                sortedContents.map(async (item: _Object) => {
                    // Generate a signed URL for secure direct download (valid for 1 hour)
                    const getObjectCommand = new GetObjectCommand({
                        Bucket: config.R2_BUCKET_NAME,
                        Key: item.Key,
                    });

                    const downloadUrl = await getSignedUrl(this.s3Client, getObjectCommand, { expiresIn: 3600 });

                    return {
                        key: item.Key || 'unknown',
                        size: item.Size || 0,
                        lastModified: item.LastModified || new Date(),
                        downloadUrl,
                    };
                })
            );

            return backups;

        } catch (error) {
            logger.error('Failed to list backups from R2:', error);
            throw new Error('Failed to retrieve backup list');
        }
    }

    /**
     * Trigger the 'db-backup.yml' workflow on GitHub
     */
    async triggerBackup(): Promise<void> {
        const url = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/actions/workflows/db-backup.yml/dispatches`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${config.GITHUB_TOKEN}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({
                    ref: 'main', // Branch to run on
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API Error: ${response.status} ${errorText}`);
            }

            logger.info('Backup workflow triggered successfully');

        } catch (error) {
            logger.error('Failed to trigger GitHub backup workflow:', error);
            throw error;
        }
    }
    /**
     * Get the recent backup workflow runs from GitHub
     */
    async getBackupRuns(): Promise<BackupRun[]> {
        const url = `https://api.github.com/repos/${config.GITHUB_OWNER}/${config.GITHUB_REPO}/actions/workflows/db-backup.yml/runs?per_page=10`;

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `Bearer ${config.GITHUB_TOKEN}`,
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`GitHub API Error: ${response.status} ${errorText}`);
            }

            const data = await response.json() as any;
            const runs = data.workflow_runs || [];

            return runs.map((run: any) => ({
                id: run.id,
                status: run.status, // 'queued', 'in_progress', 'completed'
                conclusion: run.conclusion, // 'success', 'failure', 'cancelled', etc.
                createdAt: run.created_at,
                elapsed: Math.round((new Date(run.updated_at).getTime() - new Date(run.created_at).getTime()) / 1000) + 's',
                url: run.html_url,
                actor: run.triggering_actor?.login || 'system'
            }));

        } catch (error) {
            logger.error('Failed to get backup runs:', error);
            throw error;
        }
    }
}

export const adminService = new AdminService();
