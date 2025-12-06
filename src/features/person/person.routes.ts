import { Router } from 'express';
import { PersonController } from './person.controller';
import { authenticate } from '../../core/middleware/authMiddleware';
import { 
  createPersonValidation,
  updatePersonValidation,
  personIdValidation
} from './person.validations';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';

const router = Router();

router.use(authenticate);

router.get('/search', PersonController.searchPersons);
router.post('/', createPersonValidation, validationMiddleware, PersonController.createPerson);
router.get('/', PersonController.getUserPersons);
router.get('/:id', personIdValidation, validationMiddleware, PersonController.getPersonById);
router.put('/:id', personIdValidation, updatePersonValidation, validationMiddleware, PersonController.updatePerson);
router.delete('/:id', personIdValidation, validationMiddleware, PersonController.deletePerson);

export default router;
