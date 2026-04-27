import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';
import { IEnrichmentMetadata, IEnrichmentNarrative, SignalTier, InputMethod } from '../enrichment/enrichment.types';

export enum EntryStatus {
    QUEUED = 'queued',       // In line for enrichment
    PROCESSING = 'processing', // Currently being enriched
    COMPLETED = 'completed',  // Fully processed and searchable
    FAILED = 'failed'        // Error in enrichment
}

export enum EntryType {
    TEXT = 'text',
    MEDIA = 'media',
    MIXED = 'mixed',
    VOICE = 'voice'
}

export enum SearchMode {
    INSTANT = 'instant',
    DEEP = 'deep',
    HYBRID = 'hybrid',
    FEED = 'feed'
}

// Entry Types
export interface IEntry extends BaseEntity {
    userId: Types.ObjectId;
    content: string;
    type: EntryType;
    tags: Types.ObjectId[]; // Tag IDs
    media: Types.ObjectId[]; // Media IDs
    collectionId?: Types.ObjectId; // Collection ID
    title?: string;
    isPrivate: boolean;
    isPinned?: boolean;
    isImportant?: boolean; // Mark special/memorable days
    kind?: 'entry' | 'document' | 'note';
    location?: string;
    date: Date;
    startDate?: Date; // For multi-day entries
    endDate?: Date; // For multi-day entries
    startTime?: string; // Format: HH:mm
    endTime?: string; // Format: HH:mm
    isMultiDay?: boolean; // Flag for collective entries
    isEdited?: boolean;
    isFavorite?: boolean;
    status: EntryStatus;
    inputMethod?: InputMethod;
    sessionId?: string;
    signalTier?: SignalTier;
    metadata?: Record<string, any>; // System logs, processing steps, etc.
    enrichment?: {
        metadata: IEnrichmentMetadata;
        narrative: IEnrichmentNarrative;
        extraction?: {
            confidenceScore: number;
            modelVersion: string;
            flags: string[];
        };
    };
}

export interface EntryResponse {
    entry: IEntry;
}

export interface CreateEntryRequest {
    content: string;
    type?: EntryType;
    tags?: string[];
    media?: string[];
    collectionId?: string;
    title?: string;
    isPrivate?: boolean;
    isPinned?: boolean;
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
    status?: EntryStatus;
    signalTier?: SignalTier;
    metadata?: Record<string, any>;
    inputMethod?: InputMethod;
}

export interface UpdateEntryRequest {
    content?: string;
    type?: EntryType;
    tags?: string[];
    media?: string[];
    collectionId?: string;
    title?: string;
    isPrivate?: boolean;
    isPinned?: boolean;
    isImportant?: boolean;
    isFavorite?: boolean;
    kind?: 'entry' | 'document' | 'note';
    mood?: string;
    location?: string;
    date?: Date;
    status?: EntryStatus;
    metadata?: Record<string, any>;
    inputMethod?: InputMethod;
}

export interface GetEntriesRequest {
    q?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
    tags?: string[];
    mediaType?: string;
    isPrivate?: boolean;
    isImportant?: boolean;
    kind?: 'entry' | 'document' | 'note';
    collectionId?: string;
    location?: string;
    isFavorite?: boolean;
    isPinned?: boolean;

    // Pagination
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    cursor?: string;

    // Search Mode
    mode?: SearchMode;
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
