export interface BackupFile {
    key: string;
    size: number;
    lastModified: Date;
    downloadUrl?: string;
}

export interface BackupRun {
    id: number;
    status: string;
    conclusion: string | null;
    createdAt: string;
    elapsed: string;
    url: string;
    actor: string;
}
