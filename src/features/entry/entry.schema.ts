import { z } from 'zod';
import { VALIDATION } from '../../shared/constants';

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

const entryCommonSchema = {
    content: z.string().max(VALIDATION.ENTRY_CONTENT_MAX_LENGTH).optional(),
    type: z.enum(['text', 'media', 'mixed']).optional(),
    isPrivate: z.boolean().optional(),
    isImportant: z.boolean().optional(),
    isFavorite: z.boolean().optional(),
    mood: z.string().max(50).optional(),
    location: z.string().max(200).optional(),
    tags: z.array(z.string().min(1)).optional(),
    mentions: z.array(objectIdSchema).optional(),
    media: z.array(objectIdSchema).optional(),
    collectionId: objectIdSchema.optional(),
};

export const createEntrySchema = z.object({
    body: z.object({
        ...entryCommonSchema,
        content: z.string().max(VALIDATION.ENTRY_CONTENT_MAX_LENGTH)
    })
});

export const updateEntrySchema = z.object({
    params: z.object({ id: objectIdSchema }),
    body: z.object(entryCommonSchema)
});

export const entryIdSchema = z.object({
    params: z.object({
        id: objectIdSchema
    })
});

export const searchEntriesSchema = z.object({
    query: z.object({
        q: z.string().min(2).max(100).optional(),
        type: z.enum(['text', 'media', 'mixed']).optional(),
        mode: z.enum(['instant', 'deep', 'hybrid']).optional(),
        dateFrom: z.string().datetime({ offset: true }).optional(),
        dateTo: z.string().datetime({ offset: true }).optional(),
        isFavorite: z.string().transform(v => v === 'true').optional(),
        isImportant: z.string().transform(v => v === 'true').optional(),
        page: z.string().regex(/^\d+$/).transform(v => parseInt(v, 10)).optional(),
        limit: z.string().regex(/^\d+$/).transform(v => parseInt(v, 10)).optional(),
        tags: z.string().optional().transform(v => v ? v.split(',') : undefined),
        entities: z.string().optional().transform(v => v ? v.split(',') : undefined),
        collectionId: objectIdSchema.optional(),
    })
});
