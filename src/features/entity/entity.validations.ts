import { body, param } from 'express-validator';
import { NodeType } from '../graph/edge.model';

export const createEntityValidation = [
    body('name')
        .notEmpty().withMessage('Entity name is required')
        .isString().withMessage('Entity name must be a string')
        .trim(),
    body('otype')
        .notEmpty().withMessage('Object type (otype) is required')
        .isIn(Object.values(NodeType)).withMessage('Invalid object type'),
    body('aliases').optional().isArray(),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('birthday').optional().isISO8601().toDate(),
];

export const updateEntityValidation = [
    param('id').isMongoId().withMessage('Invalid entity ID'),
    body('name').optional().isString().trim(),
    body('otype').optional().isIn(Object.values(NodeType)),
    body('aliases').optional().isArray(),
    body('email').optional().isEmail(),
];

export const entityIdValidation = [
    param('id').isMongoId().withMessage('Invalid entity ID'),
];

export const createRelationValidation = [
    body('fromId').isMongoId().withMessage('fromId must be a valid MongoID'),
    body('fromType').isIn(Object.values(NodeType)).withMessage('Invalid fromType'),
    body('toId').isMongoId().withMessage('toId must be a valid MongoID'),
    body('toType').isIn(Object.values(NodeType)).withMessage('Invalid toType'),
    body('relation').notEmpty().withMessage('Relation type is required'),
];
