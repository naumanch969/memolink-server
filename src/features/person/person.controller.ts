import { Request, Response } from 'express';
import personService from './person.service';
import { 
  CreatePersonRequest, 
  UpdatePersonRequest, 
  SearchPeopleRequest,
  PersonRequest 
} from './person.types';

export const createPerson = async (req: Request<{}, {}, CreatePersonRequest>, res: Response): Promise<void> => {
  try {
    const result = await personService.createPerson(req.body);
    
    if (result.success) {
      res.status(201).json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Create person error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create person',
    });
  }
};

export const getPeople = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await personService.getPeople();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get people error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch people',
    });
  }
};

export const getPersonById = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await personService.getPersonById(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Get person by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch person',
    });
  }
};

export const updatePerson = async (req: Request<{ id: string }, {}, UpdatePersonRequest>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await personService.updatePerson(id, req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Update person error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update person',
    });
  }
};

export const deletePerson = async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await personService.deletePerson(id);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error('Delete person error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete person',
    });
  }
};

export const searchPeople = async (req: Request<{}, {}, {}, SearchPeopleRequest>, res: Response): Promise<void> => {
  try {
    const { query, relationship, tags } = req.query;
    
    if (!query) {
      res.status(400).json({
        success: false,
        error: 'Search query is required',
      });
      return;
    }
    
    const result = await personService.searchPeople(query);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Search people error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search people',
    });
  }
};

export const getPeopleByRelationship = async (req: Request<{ relationship: string }>, res: Response): Promise<void> => {
  try {
    const { relationship } = req.params;
    const result = await personService.getPeopleByRelationship(relationship);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get people by relationship error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch people by relationship',
    });
  }
};
