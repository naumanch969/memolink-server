import Entry from './entry.model';
import Person from '../person/person.model';
import { Entry as EntryInterface, ApiResponse } from '../../interfaces';
import { getPaginationParams, getSortParams, createPaginationResponse } from '../../utils/helpers';

// In-memory storage for testing when database is not available
const inMemoryEntries: any[] = [];
let entryIdCounter = 1;

export class EntryService {
  /**
   * Create a new entry
   */
  async createEntry(entryData: Partial<EntryInterface>): Promise<ApiResponse<EntryInterface>> {
    try {
      const entry = {
        id: entryIdCounter.toString(),
        content: entryData.content || '',
        timestamp: entryData.timestamp ? new Date(entryData.timestamp) : new Date(),
        mood: entryData.mood,
        weather: entryData.weather,
        location: entryData.location,
        people: entryData.people || [],
        mentions: entryData.mentions || [],
        tags: entryData.tags || [],
        media: entryData.media || [],
        reactions: entryData.reactions || [],
        isPrivate: entryData.isPrivate || false,
        isPinned: entryData.isPinned || false,
        parentEntryId: entryData.parentEntryId,
        replyCount: 0,
        viewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Process mentions if content contains @mentions
      if (entryData.content && entryData.content.includes('@')) {
        entry.mentions = await this.extractMentions(entryData.content);
      }

      inMemoryEntries.push(entry);
      entryIdCounter++;

      return {
        success: true,
        data: this.mapEntryToInterface(entry),
        message: 'Entry created successfully',
      };
    } catch (error) {
      console.error('Create entry error:', error);
      return {
        success: false,
        error: 'Failed to create entry',
      };
    }
  }

  /**
   * Get entries with pagination and privacy filtering
   */
  async getEntries(userId?: string, page = 1, limit = 20): Promise<ApiResponse<EntryInterface[]>> {
    try {
      const skip = (page - 1) * limit;

      // Build query with privacy filter
      let entries = inMemoryEntries.filter(entry => !entry.isPrivate);

      // If user is authenticated, show their private entries too
      if (userId) {
        entries = inMemoryEntries.filter(entry => 
          !entry.isPrivate || entry.people.some((p: any) => p.id === userId)
        );
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = entries.length;
      const paginatedEntries = entries.slice(skip, skip + limit);

      return {
        success: true,
        data: paginatedEntries.map(entry => this.mapEntryToInterface(entry)),
        pagination: createPaginationResponse(paginatedEntries, page, limit, total),
      };
    } catch (error) {
      console.error('Get entries error:', error);
      return {
        success: false,
        error: 'Failed to fetch entries',
      };
    }
  }

  /**
   * Get entries by person
   */
  async getEntriesByPerson(personId: string, page = 1, limit = 20): Promise<ApiResponse<EntryInterface[]>> {
    try {
      const skip = (page - 1) * limit;

      const entries = inMemoryEntries.filter(entry => 
        entry.people.some((p: any) => p.id === personId) && !entry.isPrivate
      );

      // Sort by timestamp (newest first)
      entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = entries.length;
      const paginatedEntries = entries.slice(skip, skip + limit);

      return {
        success: true,
        data: paginatedEntries.map(entry => this.mapEntryToInterface(entry)),
        pagination: createPaginationResponse(paginatedEntries, page, limit, total),
      };
    } catch (error) {
      console.error('Get entries by person error:', error);
      return {
        success: false,
        error: 'Failed to fetch entries',
      };
    }
  }

  /**
   * Search entries
   */
  async searchEntries(searchParams: {
    query: string;
    filters?: {
      mood?: string;
      weather?: string;
      location?: string;
      people?: string[];
      tags?: string[];
      dateFrom?: Date;
      dateTo?: Date;
      mediaType?: 'image' | 'video' | 'audio' | 'all';
      isPrivate?: boolean;
      isPinned?: boolean;
    };
    sortBy?: 'timestamp' | 'createdAt' | 'relevance' | 'popularity';
    sortOrder?: 'asc' | 'desc';
  }): Promise<ApiResponse<EntryInterface[]>> {
    try {
      const { query, filters, sortBy = 'relevance', sortOrder = 'desc' } = searchParams;

      let searchResults = inMemoryEntries.filter(entry => !entry.isPrivate);

      // Text search
      if (query) {
        searchResults = searchResults.filter(entry => 
          entry.content.toLowerCase().includes(query.toLowerCase()) ||
          entry.tags.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase()))
        );
      }

      // Apply filters
      if (filters) {
        if (filters.mood) {
          searchResults = searchResults.filter(entry => entry.mood === filters.mood);
        }
        if (filters.weather) {
          searchResults = searchResults.filter(entry => entry.weather === filters.weather);
        }
        if (filters.location) {
          searchResults = searchResults.filter(entry => 
            entry.location && entry.location.toLowerCase().includes(filters.location!.toLowerCase())
          );
        }
        if (filters.people && filters.people.length > 0) {
          searchResults = searchResults.filter(entry => 
            entry.people.some((p: any) => filters.people!.includes(p.name))
          );
        }
        if (filters.tags && filters.tags.length > 0) {
          searchResults = searchResults.filter(entry => 
            entry.tags.some((tag: string) => filters.tags!.includes(tag))
          );
        }
        if (filters.dateFrom || filters.dateTo) {
          searchResults = searchResults.filter(entry => {
            const entryDate = new Date(entry.timestamp);
            if (filters.dateFrom && entryDate < new Date(filters.dateFrom)) return false;
            if (filters.dateTo && entryDate > new Date(filters.dateTo)) return false;
            return true;
          });
        }
        if (filters.mediaType && filters.mediaType !== 'all') {
          searchResults = searchResults.filter(entry => 
            entry.media.some((m: any) => m.type === filters.mediaType)
          );
        }
        if (filters.isPrivate !== undefined) {
          searchResults = searchResults.filter(entry => entry.isPrivate === filters.isPrivate);
        }
        if (filters.isPinned !== undefined) {
          searchResults = searchResults.filter(entry => entry.isPinned === filters.isPinned);
        }
      }

      // Determine sort order
      if (sortBy === 'popularity') {
        searchResults.sort((a, b) => b.reactions.length - a.reactions.length);
      } else if (sortBy === 'timestamp' || sortBy === 'createdAt') {
        searchResults.sort((a, b) => {
          const aTime = new Date(a.timestamp).getTime();
          const bTime = new Date(b.timestamp).getTime();
          return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
        });
      }

      return {
        success: true,
        data: searchResults.slice(0, 100).map(entry => this.mapEntryToInterface(entry)),
      };
    } catch (error) {
      console.error('Search entries error:', error);
      return {
        success: false,
        error: 'Failed to search entries',
      };
    }
  }

  /**
   * Get entry by ID
   */
  async getEntryById(id: string): Promise<ApiResponse<EntryInterface>> {
    try {
      // Increment view count
      const entryIndex = inMemoryEntries.findIndex(e => e.id === id);
      if (entryIndex !== -1) {
        inMemoryEntries[entryIndex].viewCount = (inMemoryEntries[entryIndex].viewCount || 0) + 1;
      }

      const entry = inMemoryEntries.find(e => e.id === id);

      if (!entry) {
        return {
          success: false,
          error: 'Entry not found',
        };
      }

      return {
        success: true,
        data: this.mapEntryToInterface(entry),
      };
    } catch (error) {
      console.error('Get entry by ID error:', error);
      return {
        success: false,
        error: 'Failed to fetch entry',
      };
    }
  }

  /**
   * Update entry
   */
  async updateEntry(id: string, updates: Partial<EntryInterface>): Promise<ApiResponse<EntryInterface>> {
    try {
      const entryIndex = inMemoryEntries.findIndex(e => e.id === id);
      if (entryIndex === -1) {
        return {
          success: false,
          error: 'Entry not found',
        };
      }

      const updateData = {
        ...updates,
        updatedAt: new Date(),
      };

      if (updates.timestamp) {
        updateData.timestamp = new Date(updates.timestamp);
      }

      // Process mentions if content contains @mentions
      if (updateData.content && updateData.content.includes('@')) {
        updateData.mentions = await this.extractMentions(updateData.content);
      }

      inMemoryEntries[entryIndex] = {
        ...inMemoryEntries[entryIndex],
        ...updateData,
      };

      return {
        success: true,
        data: this.mapEntryToInterface(inMemoryEntries[entryIndex]),
        message: 'Entry updated successfully',
      };
    } catch (error) {
      console.error('Update entry error:', error);
      return {
        success: false,
        error: 'Failed to update entry',
      };
    }
  }

  /**
   * Delete entry
   */
  async deleteEntry(id: string): Promise<ApiResponse<void>> {
    try {
      const entryIndex = inMemoryEntries.findIndex(e => e.id === id);
      if (entryIndex === -1) {
        return {
          success: false,
          error: 'Entry not found',
        };
      }

      inMemoryEntries.splice(entryIndex, 1);

      return {
        success: true,
        message: 'Entry deleted successfully',
      };
    } catch (error) {
      console.error('Delete entry error:', error);
      return {
        success: false,
        error: 'Failed to delete entry',
      };
    }
  }

  /**
   * Toggle reaction
   */
  async toggleReaction(entryId: string, userId: string, type: 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry' | 'custom', customEmoji?: string): Promise<ApiResponse<EntryInterface>> {
    try {
      const entryIndex = inMemoryEntries.findIndex(e => e.id === entryId);
      if (entryIndex === -1) {
        return {
          success: false,
          error: 'Entry not found',
        };
      }

      const entry = inMemoryEntries[entryIndex];

      // Check if user already reacted
      const existingReactionIndex = entry.reactions.findIndex(
        (r: any) => r.userId === userId && r.type === type
      );

      if (existingReactionIndex >= 0) {
        // Remove existing reaction
        entry.reactions.splice(existingReactionIndex, 1);
      } else {
        // Add new reaction
        entry.reactions.push({
          id: Math.random().toString(36).substr(2, 9),
          userId,
          type,
          customEmoji,
          createdAt: new Date(),
        });
      }

      return {
        success: true,
        data: this.mapEntryToInterface(entry),
        message: existingReactionIndex >= 0 ? 'Reaction removed' : 'Reaction added',
      };
    } catch (error) {
      console.error('Toggle reaction error:', error);
      return {
        success: false,
        error: 'Failed to toggle reaction',
      };
    }
  }

  /**
   * Get entry stats
   */
  async getEntryStats(): Promise<ApiResponse<any>> {
    try {
      const publicEntries = inMemoryEntries.filter(entry => !entry.isPrivate);
      
      const stats = {
        totalEntries: publicEntries.length,
        totalMedia: publicEntries.reduce((sum, entry) => sum + entry.media.length, 0),
        totalReactions: publicEntries.reduce((sum, entry) => sum + entry.reactions.length, 0),
        avgReactionsPerEntry: publicEntries.length > 0 ? 
          publicEntries.reduce((sum, entry) => sum + entry.reactions.length, 0) / publicEntries.length : 0,
        entriesThisWeek: publicEntries.filter(entry => {
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return new Date(entry.timestamp) >= weekAgo;
        }).length,
        entriesThisMonth: publicEntries.filter(entry => {
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          return new Date(entry.timestamp) >= monthAgo;
        }).length,
      };

      const moodStats = publicEntries
        .filter(entry => entry.mood)
        .reduce((acc: any, entry) => {
          acc[entry.mood] = (acc[entry.mood] || 0) + 1;
          return acc;
        }, {});

      const moodDistribution = Object.entries(moodStats).map(([mood, count]) => ({
        mood,
        count,
      }));

      return {
        success: true,
        data: {
          ...stats,
          moodDistribution,
        },
      };
    } catch (error) {
      console.error('Get entry stats error:', error);
      return {
        success: false,
        error: 'Failed to fetch entry stats',
      };
    }
  }

  /**
   * Extract mentions from content
   */
  private async extractMentions(content: string) {
    const mentions: any[] = [];
    const mentionRegex = /@(\w+)/g;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      const personName = match[1];
      // For in-memory testing, we'll just create a mention without looking up the person
      mentions.push({
        id: Math.random().toString(36).substr(2, 9),
        personId: 'unknown',
        personName: personName,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return mentions;
  }

  /**
   * Map database entry to interface
   */
  private mapEntryToInterface(entry: any): EntryInterface {
    return {
      id: entry.id,
      content: entry.content,
      timestamp: entry.timestamp,
      mood: entry.mood,
      weather: entry.weather,
      location: entry.location,
      people: entry.people,
      mentions: entry.mentions,
      tags: entry.tags,
      media: entry.media,
      reactions: entry.reactions,
      isPrivate: entry.isPrivate,
      isPinned: entry.isPinned,
      parentEntryId: entry.parentEntryId,
      replyCount: entry.replyCount,
      viewCount: entry.viewCount,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}

export default new EntryService();
