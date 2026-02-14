import { Router } from 'express';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { EntityController } from './entity.controller';
import { createEntityValidation, createRelationValidation, entityIdValidation, updateEntityValidation } from './entity.validations';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/graph', EntityController.getGraph);
router.post('/relation', createRelationValidation, ValidationMiddleware.validate, EntityController.createRelation);
router.delete('/relation', ValidationMiddleware.validate, EntityController.deleteRelation);

router.get('/search', EntityController.searchEntities);
router.post('/', createEntityValidation, ValidationMiddleware.validate, EntityController.createEntity);
router.get('/', EntityController.getUserEntities);
router.get('/:id', entityIdValidation, ValidationMiddleware.validate, EntityController.getEntityById);
router.get('/:id/interactions', entityIdValidation, ValidationMiddleware.validate, EntityController.getEntityInteractions);
router.put('/:id', updateEntityValidation, ValidationMiddleware.validate, EntityController.updateEntity);
router.delete('/:id', entityIdValidation, ValidationMiddleware.validate, EntityController.deleteEntity);

export default router;
