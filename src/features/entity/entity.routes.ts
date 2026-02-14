import { Router } from 'express';
import { validationMiddleware } from '../../core/middleware/validation.middleware';
import { EntityController } from './entity.controller';
import { AuthMiddleware } from '../../core/middleware/auth.middleware';

const router = Router();

router.use(AuthMiddleware.authenticate);

router.get('/graph', EntityController.getGraph);
router.post('/relation', validationMiddleware, EntityController.createRelation);
router.delete('/relation', validationMiddleware, EntityController.deleteRelation);

router.get('/search', EntityController.searchEntities);
router.post('/', validationMiddleware, EntityController.createEntity);
router.get('/', EntityController.getUserEntities);
router.get('/:id', validationMiddleware, EntityController.getEntityById);
router.get('/:id/interactions', validationMiddleware, EntityController.getEntityInteractions);
router.put('/:id', validationMiddleware, EntityController.updateEntity);
router.delete('/:id', validationMiddleware, EntityController.deleteEntity);

export default router;
