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
  status?: 'ready' | 'processing' | 'failed' | 'processed' | 'captured';
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

export interface IEntryService {
  createEntry(userId: string, entryData: CreateEntryRequest): Promise<IEntry>;
  getEntryById(entryId: string, userId: string): Promise<IEntry>;
  getUserEntries(userId: string, options?: EntrySearchRequest): Promise<{
    entries: IEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  searchEntries(userId: string, searchParams: EntrySearchRequest): Promise<{
    entries: IEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  updateEntry(entryId: string, userId: string, updateData: UpdateEntryRequest): Promise<IEntry>;
  deleteEntry(entryId: string, userId: string): Promise<void>;
  getEntryStats(userId: string): Promise<EntryStats>;
  getFeed(userId: string, feedParams: EntryFeedRequest): Promise<EntryFeedResponse>;
  deleteUserData(userId: string): Promise<number>;
  toggleFavorite(entryId: string, userId: string): Promise<IEntry>;
  getCalendarEntries(userId: string, startDate: string, endDate: string): Promise<any[]>;
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
  status?: 'ready' | 'processing' | 'failed' | 'processed' | 'captured';
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
  status?: 'ready' | 'processing' | 'failed' | 'processed' | 'captured';
  metadata?: Record<string, any>;
}

export interface EntrySearchRequest {
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
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  mode?: 'instant' | 'deep' | 'hybrid';
}

export interface EntryFeedRequest {
  cursor?: string; // ID of the last entry seen
  limit?: number;
  type?: string;
  tags?: string[];
  entities?: string[];
  isPrivate?: boolean;
  isImportant?: boolean;
  kind?: 'entry' | 'document' | 'note';
  mood?: string;
}

export interface EntryFeedResponse {
  entries: IEntry[];
  nextCursor?: string;
  hasMore: boolean;
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
