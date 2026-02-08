import { Router } from 'express';
import { authenticate } from '../../core/middleware/authMiddleware';
import { validationMiddleware } from '../../core/middleware/validationMiddleware';
import { EntityController } from './entity.controller';

const router = Router();

router.use(authenticate);

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
