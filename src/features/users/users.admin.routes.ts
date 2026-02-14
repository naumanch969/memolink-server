import { Router } from 'express';
import { ValidationMiddleware } from '../../core/middleware/validation.middleware';
import { UsersAdminController } from './users.admin.controller';
import { listUsersValidation, updateUserValidation, userIdValidation } from './users.validations';

const usersAdminRouter = Router();

// User Management
usersAdminRouter.get('/', listUsersValidation, ValidationMiddleware.validate, UsersAdminController.getUsers);
usersAdminRouter.get('/:id', userIdValidation, ValidationMiddleware.validate, UsersAdminController.getUserDetails);
usersAdminRouter.patch('/:id', updateUserValidation, ValidationMiddleware.validate, UsersAdminController.updateUser);
usersAdminRouter.patch('/:id/deactivate', userIdValidation, ValidationMiddleware.validate, UsersAdminController.deactivateUser);
usersAdminRouter.patch('/:id/reactivate', userIdValidation, ValidationMiddleware.validate, UsersAdminController.reactivateUser);
usersAdminRouter.delete('/:id', userIdValidation, ValidationMiddleware.validate, UsersAdminController.deleteUser);

export { usersAdminRouter };
