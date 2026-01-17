import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';
import { PersonController } from './person.controller';
import { createPersonValidation, createRelationValidation, personIdValidation, updatePersonValidation } from './person.validations';

const router = Router();

router.use(authenticate);

// Graph Routes - Must define before ID routes
router.get('/graph', PersonController.getGraph);
router.post('/relation', createRelationValidation, validationMiddleware, PersonController.createRelation);
router.delete('/relation/:id', validationMiddleware, PersonController.deleteRelation);

router.get('/search', PersonController.searchPersons);
router.post('/', createPersonValidation, validationMiddleware, PersonController.createPerson);
router.get('/', PersonController.getUserPersons);
router.get('/:id', personIdValidation, validationMiddleware, PersonController.getPersonById);
router.get('/:id/interactions', personIdValidation, validationMiddleware, PersonController.getPersonInteractions);
router.put('/:id', personIdValidation, updatePersonValidation, validationMiddleware, PersonController.updatePerson);
router.delete('/:id', personIdValidation, validationMiddleware, PersonController.deletePerson);

export default router;
