import Person from './person.model';
import { Person as PersonInterface, ApiResponse } from '../../interfaces';
import { CreatePersonRequest, UpdatePersonRequest } from './person.types';

// In-memory storage for testing when database is not available
const inMemoryPeople: any[] = [];
let personIdCounter = 1;

export class PersonService {
  /**
   * Create a new person
   */
  async createPerson(personData: CreatePersonRequest): Promise<ApiResponse<PersonInterface>> {
    try {
      const person = {
        _id: personIdCounter.toString(),
        name: personData.name,
        avatar: personData.avatar,
        email: personData.email,
        phone: personData.phone,
        relationship: personData.relationship,
        tags: personData.tags || [],
        notes: personData.notes,
        birthday: personData.birthday,
        lastContact: personData.lastContact,
        contactFrequency: personData.contactFrequency,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      inMemoryPeople.push(person);
      personIdCounter++;

      return {
        success: true,
        data: this.mapPersonToInterface(person),
        message: 'Person created successfully',
      };
    } catch (error) {
      console.error('Create person error:', error);
      return {
        success: false,
        error: 'Failed to create person',
      };
    }
  }

  /**
   * Get all active people
   */
  async getPeople(): Promise<ApiResponse<PersonInterface[]>> {
    try {
      const people = inMemoryPeople.filter(p => p.isActive).sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: people.map(person => this.mapPersonToInterface(person)),
      };
    } catch (error) {
      console.error('Get people error:', error);
      return {
        success: false,
        error: 'Failed to fetch people',
      };
    }
  }

  /**
   * Get person by ID
   */
  async getPersonById(_id: string): Promise<ApiResponse<PersonInterface>> {
    try {
      const person = inMemoryPeople.find(p => p._id === _id && p.isActive);

      if (!person) {
        return {
          success: false,
          error: 'Person not found',
        };
      }

      return {
        success: true,
        data: this.mapPersonToInterface(person),
      };
    } catch (error) {
      console.error('Get person by ID error:', error);
      return {
        success: false,
        error: 'Failed to fetch person',
      };
    }
  }

  /**
   * Update person
   */
  async updatePerson(_id: string, updates: UpdatePersonRequest): Promise<ApiResponse<PersonInterface>> {
    try {
      const personIndex = inMemoryPeople.findIndex(p => p._id === _id && p.isActive);

      if (personIndex === -1) {
        return {
          success: false,
          error: 'Person not found',
        };
      }

      // Convert string dates to Date objects
      const processedUpdates = this.processPersonData(updates);

      // Update the person
      inMemoryPeople[personIndex] = {
        ...inMemoryPeople[personIndex],
        ...processedUpdates,
        updatedAt: new Date(),
      };

      return {
        success: true,
        data: this.mapPersonToInterface(inMemoryPeople[personIndex]),
        message: 'Person updated successfully',
      };
    } catch (error) {
      console.error('Update person error:', error);
      return {
        success: false,
        error: 'Failed to update person',
      };
    }
  }

  /**
   * Delete person
   */
  async deletePerson(_id: string): Promise<ApiResponse<void>> {
    try {
      const personIndex = inMemoryPeople.findIndex(p => p._id === _id && p.isActive);

      if (personIndex === -1) {
        return {
          success: false,
          error: 'Person not found',
        };
      }

      // Soft delete by setting isActive to false
      inMemoryPeople[personIndex].isActive = false;
      inMemoryPeople[personIndex].updatedAt = new Date();

      return {
        success: true,
        message: 'Person deleted successfully',
      };
    } catch (error) {
      console.error('Delete person error:', error);
      return {
        success: false,
        error: 'Failed to delete person',
      };
    }
  }

  /**
   * Search people by name or tags
   */
  async searchPeople(query: string): Promise<ApiResponse<PersonInterface[]>> {
    try {
      const people = inMemoryPeople.filter(p =>
        p.isActive && (
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          (p.tags && p.tags.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase())))
        )
      ).sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: people.map(person => this.mapPersonToInterface(person)),
      };
    } catch (error) {
      console.error('Search people error:', error);
      return {
        success: false,
        error: 'Failed to search people',
      };
    }
  }

  /**
   * Get people by relationship
   */
  async getPeopleByRelationship(relationship: string): Promise<ApiResponse<PersonInterface[]>> {
    try {
      const people = inMemoryPeople.filter(p =>
        p.isActive && p.relationship &&
        p.relationship.toLowerCase().includes(relationship.toLowerCase())
      ).sort((a, b) => a.name.localeCompare(b.name));

      return {
        success: true,
        data: people.map(person => this.mapPersonToInterface(person)),
      };
    } catch (error) {
      console.error('Get people by relationship error:', error);
      return {
        success: false,
        error: 'Failed to fetch people by relationship',
      };
    }
  }

  /**
   * Process person data to convert string dates to Date objects
   */
  private processPersonData(data: CreatePersonRequest | UpdatePersonRequest): any {
    const processed = { ...data };

    if (processed.birthday && typeof processed.birthday === 'string') {
      processed.birthday = new Date(processed.birthday).toISOString();
    }

    if (processed.lastContact && typeof processed.lastContact === 'string') {
      processed.lastContact = new Date(processed.lastContact).toISOString();
    }

    return processed;
  }

  /**
   * Map database person to interface
   */
  private mapPersonToInterface(person: any): PersonInterface {
    return {
      _id: person._id,
      name: person.name,
      avatar: person.avatar,
      email: person.email,
      phone: person.phone,
      relationship: person.relationship,
      isActive: person.isActive,
      tags: person.tags,
      notes: person.notes,
      birthday: person.birthday,
      lastContact: person.lastContact,
      contactFrequency: person.contactFrequency,
      createdAt: person.createdAt,
      updatedAt: person.updatedAt,
    };
  }
}

export default new PersonService();
