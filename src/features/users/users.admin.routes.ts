import { Router } from 'express';
import { UsersAdminController } from './users.admin.controller';

const usersAdminRouter = Router();

// User Management
usersAdminRouter.get('/', UsersAdminController.getUsers);
usersAdminRouter.get('/:id', UsersAdminController.getUserDetails);
usersAdminRouter.patch('/:id', UsersAdminController.updateUser);
usersAdminRouter.patch('/:id/deactivate', UsersAdminController.deactivateUser);
usersAdminRouter.patch('/:id/reactivate', UsersAdminController.reactivateUser);
usersAdminRouter.delete('/:id', UsersAdminController.deleteUser);

export { usersAdminRouter };
