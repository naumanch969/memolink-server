import { Router } from 'express';
import { createPerson, getPeople, getPersonById, updatePerson, deletePerson, searchPeople, getPeopleByRelationship, } from './person.controller';
import { auth, optionalAuth } from '../../middlewares/auth';
import { validateCreatePerson, validateUpdatePerson, validateSearchPeople } from './person.validations';
import { handleValidationErrors } from '../../middlewares/validation';

const router = Router();

// Public routes (with optional auth)
router.get('/', optionalAuth, getPeople);
router.get('/search', optionalAuth, validateSearchPeople, handleValidationErrors, searchPeople);
router.get('/relationship/:relationship', optionalAuth, getPeopleByRelationship);
router.get('/person/:_id', optionalAuth, getPersonById);

// Protected routes (require auth)
router.post('/', auth, validateCreatePerson, handleValidationErrors, createPerson);
router.put('/person/:_id', auth, validateUpdatePerson, handleValidationErrors, updatePerson);
router.delete('/person/:_id', auth, deletePerson);

export default router;
