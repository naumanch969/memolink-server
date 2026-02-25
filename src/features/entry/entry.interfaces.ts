import { CreateEntryRequest, EntryStats, GetEntriesRequest, GetEntriesResponse, IEntry, UpdateEntryRequest } from './entry.types';

export interface IEntryService {
  createEntry(userId: string, entryData: CreateEntryRequest): Promise<IEntry>;
  getEntryById(entryId: string, userId: string): Promise<IEntry>;
  getEntries(userId: string, query: GetEntriesRequest): Promise<GetEntriesResponse>;
  updateEntry(entryId: string, userId: string, updateData: UpdateEntryRequest): Promise<IEntry>;
  deleteEntry(entryId: string, userId: string): Promise<void>;
  getEntryStats(userId: string): Promise<EntryStats>;
  deleteUserData(userId: string): Promise<number>;
  toggleFavorite(entryId: string, userId: string): Promise<IEntry>;
  getCalendarEntries(userId: string, startDate: string, endDate: string): Promise<any[]>;
}
