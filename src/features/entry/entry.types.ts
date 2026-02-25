import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';

// Entry Types
export interface IEntry extends BaseEntity {
    userId: Types.ObjectId;
    content: string;
    type: 'text' | 'media' | 'mixed';
    mentions: Types.ObjectId[]; // KnowledgeEntity IDs
    tags: Types.ObjectId[]; // Tag IDs
    media: Types.ObjectId[]; // Media IDs
    isPrivate: boolean;
    isImportant?: boolean; // Mark special/memorable days
    kind?: 'entry' | 'document' | 'note';
    mood?: string;
    location?: string;
    date: Date;
    startDate?: Date; // For multi-day entries
    endDate?: Date; // For multi-day entries
    startTime?: string; // Format: HH:mm
    endTime?: string; // Format: HH:mm
    isMultiDay?: boolean; // Flag for collective entries
    isEdited?: boolean;
    aiProcessed?: boolean;
    isFavorite?: boolean;
    status?: 'ready' | 'processing' | 'failed' | 'capturing';
    embeddings?: number[];
    moodMetadata?: {
        category: string;
        score: number;
        color: string;
        icon: string;
    };
    metadata?: Record<string, any>;
}

export interface EntryResponse {
    entry: IEntry;
}

export interface CreateEntryRequest {
    content: string;
    type?: 'text' | 'media' | 'mixed';
    mentions?: string[];
    tags?: string[];
    media?: string[];
    isPrivate?: boolean;
    isImportant?: boolean;
    kind?: 'entry' | 'document' | 'note';
    mood?: string;
    location?: string;
    date?: Date;
    startDate?: Date;
    endDate?: Date;
    startTime?: string;
    endTime?: string;
    isMultiDay?: boolean;
    aiProcessed?: boolean;
    status?: 'ready' | 'processing' | 'failed' | 'capturing';
    metadata?: Record<string, any>;
}

export interface UpdateEntryRequest {
    content?: string;
    type?: 'text' | 'media' | 'mixed';
    mentions?: string[];
    tags?: string[];
    media?: string[];
    isPrivate?: boolean;
    isImportant?: boolean;
    kind?: 'entry' | 'document' | 'note';
    mood?: string;
    location?: string;
    date?: Date;
    aiProcessed?: boolean;
    status?: 'ready' | 'processing' | 'failed' | 'capturing';
    metadata?: Record<string, any>;
}

export interface GetEntriesRequest {
    q?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    entities?: string[];
    mediaType?: string;
    isPrivate?: boolean;
    isImportant?: boolean;
    kind?: 'entry' | 'document' | 'note';
    mood?: string;
    location?: string;
    isFavorite?: boolean;

    // Pagination
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    cursor?: string;

    // Search Mode
    mode?: 'instant' | 'deep' | 'hybrid' | 'feed';
}

export interface GetEntriesResponse {
    entries: IEntry[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    nextCursor?: string;
    hasMore?: boolean;
}

export interface EntryStats {
    totalEntries: number;
    entriesThisMonth: number;
    entriesThisWeek: number;
    entriesToday: number;
    averageWordsPerEntry: number;
    mostActiveDay: string;
    entryTypes: {
        text: number;
        media: number;
        mixed: number;
    };
}
