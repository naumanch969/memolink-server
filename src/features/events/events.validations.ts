import { body } from 'express-validator';
import { EventType } from '../../core/events/event.types';

export const ingestEventsValidation = [
    body('events').isArray({ min: 1 }).withMessage('Events must be a non-empty array'),
    body('events.*.type')
        .notEmpty().withMessage('Event type is required')
        .isIn(Object.values(EventType)).withMessage('Invalid event type'),
    body('events.*.payload').notEmpty().withMessage('Event payload is required'),
];
