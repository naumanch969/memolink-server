import { IEntry } from '../../shared/types';

export interface EntryResponse {
  entry: IEntry;
}

export interface IEntryService {
  createEntry(userId: string, entryData: CreateEntryRequest): Promise<IEntry>;
  getEntryById(entryId: string, userId: string): Promise<IEntry>;
  getUserEntries(userId: string, options?: any): Promise<{
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
}

export interface CreateEntryRequest {
  content: string;
  type?: 'text' | 'media' | 'mixed';
  mentions?: string[];
  tags?: string[];
  media?: string[];
  isPrivate?: boolean;
  mood?: string;
  location?: string;
  date?: Date;
  startDate?: Date;
  endDate?: Date;
  startTime?: string;
  endTime?: string;
  isMultiDay?: boolean;
}

export interface UpdateEntryRequest {
  content?: string;
  type?: 'text' | 'media' | 'mixed';
  mentions?: string[];
  tags?: string[];
  media?: string[];
  isPrivate?: boolean;
  mood?: string;
  location?: string;
}

export interface EntrySearchRequest {
  q?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  tags?: string[];
  people?: string[];
  mediaType?: string;
  isPrivate?: boolean;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
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
