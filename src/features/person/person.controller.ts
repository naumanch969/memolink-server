import { Request, Response } from 'express';
import personService from './person.service';
import { 
  CreatePersonRequest, 
  UpdatePersonRequest, 
  SearchPeopleRequest,
  PersonRequest 
} from './person.types';
import { 
  sendCreated, sendSuccess, sendBadRequest, sendNotFound, sendInternalServerError,
  sendPaginationResponse, sendSearchResponse, sendDeleteResponse, sendUpdateResponse
} from '../../utils/response.utils';

export const createPerson = async (req: Request<{}, {}, CreatePersonRequest>, res: Response): Promise<void> => {
  try {
    const result = await personService.createPerson(req.body);
    
    if (result.success) {
      sendCreated({ res, data: result.data, message: 'Person created successfully' });
    } else {
      sendBadRequest({ res, error: result.error, message: 'Failed to create person' });
    }
  } catch (error) {
    console.error('Create person error:', error);
    sendInternalServerError({ res, error: 'Failed to create person' });
  }
};

export const getPeople = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await personService.getPeople();
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'People retrieved successfully' });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch people' });
    }
  } catch (error) {
    console.error('Get people error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch people' });
  }
};

export const getPersonById = async (req: Request<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await personService.getPersonById(_id);

    if (result.success) {
      sendSuccess({ res, data: result.data, message: 'Person retrieved successfully' });
    } else {
      sendNotFound({ res, error: result.error || 'Person not found' });
    }
  } catch (error) {
    console.error('Get person by ID error:', error);
    sendInternalServerError({ res, error: 'Failed to retrieve person' });
  }
};

export const updatePerson = async (req: Request<{ _id: string }, {}, UpdatePersonRequest>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await personService.updatePerson(_id, req.body);

    if (result.success) {
      sendUpdateResponse({ res, data: result.data, message: 'Person updated successfully' });
    } else {
      sendBadRequest({ res, error: result.error || 'Failed to update person' });
    }
  } catch (error) {
    console.error('Update person error:', error);
    sendInternalServerError({ res, error: 'Failed to update person' });
  }
};

export const deletePerson = async (req: Request<{ _id: string }>, res: Response): Promise<void> => {
  try {
    const { _id } = req.params;
    const result = await personService.deletePerson(_id);

    if (result.success) {
      sendDeleteResponse({ res, id: _id, message: 'Person deleted successfully' });
    } else {
      sendBadRequest({ res, error: result.error || 'Failed to delete person' });
    }
  } catch (error) {
    console.error('Delete person error:', error);
    sendInternalServerError({ res, error: 'Failed to delete person' });
  }
};

export const searchPeople = async (req: Request<{}, {}, {}, SearchPeopleRequest>, res: Response): Promise<void> => {
  try {
    const { query, relationship, tags } = req.query;
    
    if (!query) {
      sendBadRequest({ res, error: 'Search query is required', message: 'Please provide a search query' });
      return;
    }
    
    const result = await personService.searchPeople(query);
    
    if (result.success) {
      sendSearchResponse({ 
        res, 
        data: result.data, 
        query: query as string, 
        total: result.data?.length || 0, 
        message: 'Search completed successfully' 
      });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Search failed' });
    }
  } catch (error) {
    console.error('Search people error:', error);
    sendInternalServerError({ res, error: 'Failed to search people' });
  }
};

export const getPeopleByRelationship = async (req: Request<{ relationship: string }>, res: Response): Promise<void> => {
  try {
    const { relationship } = req.params;
    const result = await personService.getPeopleByRelationship(relationship);
    
    if (result.success) {
      sendSuccess({ res, data: result.data, message: `People with relationship '${relationship}' retrieved successfully` });
    } else {
      sendInternalServerError({ res, error: result.error, message: 'Failed to fetch people by relationship' });
    }
  } catch (error) {
    console.error('Get people by relationship error:', error);
    sendInternalServerError({ res, error: 'Failed to fetch people by relationship' });
  }
};
