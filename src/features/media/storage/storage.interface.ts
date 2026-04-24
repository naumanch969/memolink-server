// Storage Reservation for atomic operations
export interface StorageReservation {
    id: string;
    userId: string;
    size: number;
    createdAt: Date;
    expiresAt: Date;
    status: 'pending' | 'committed' | 'rolled-back';
    commit: () => Promise<void>;
    rollback: () => Promise<void>;
}

export interface ReservationRecord {
    userId: string;
    size: number;
    createdAt: Date;
    expiresAt: Date;
    status: 'pending' | 'committed' | 'rolled-back';
}

export interface StorageStats {
    used: number;
    quota: number;
    available: number;
    usagePercent: number;
    isWarning: boolean;
    isCritical: boolean;
    breakdown: {
        images: number;
        videos: number;
        documents: number;
        audio: number;
        archives: number;
        data: number;
        code: number;
        other: number;
    };
}

export interface OrphanMedia {
    _id: string;
    filename: string;
    size: number;
    type: string;
    createdAt: Date;
    url: string;
}

export interface CleanupSuggestion {
    type: 'large' | 'old' | 'duplicate' | 'orphan';
    mediaIds: string[];
    potentialSavings: number;
    description: string;
}
