import { createNotFoundError, createValidationError } from '../../core/middleware/errorHandler';
import { IRelation } from '../../shared/types';
import { Person } from './person.model';
import Relation from './relation.model';

export class RelationService {
    /**
     * Create a link between two people.
     */
    async createRelation(
        userId: string,
        personId1: string,
        personId2: string,
        type: string,
        strength: number = 1
    ): Promise<IRelation> {
        if (personId1 === personId2) {
            throw createValidationError('Cannot create a relation to self');
        }

        // Verify both persons exist and belong to the user
        const count = await Person.countDocuments({
            _id: { $in: [personId1, personId2] },
            userId,
            isDeleted: { $ne: true }
        });

        if (count !== 2) {
            throw createNotFoundError('One or both persons');
        }

        const p1 = personId1 < personId2 ? personId1 : personId2;
        const p2 = personId1 < personId2 ? personId2 : personId1;

        // Check if exists
        const existing = await Relation.findOne({
            userId,
            sourceId: p1,
            targetId: p2
        });

        if (existing) {
            existing.type = type;
            existing.strength = strength;
            return await existing.save();
        }

        const relation = new Relation({
            userId,
            sourceId: p1,
            targetId: p2,
            type,
            strength
        });

        return await relation.save();
    }

    async removeRelation(userId: string, relationId: string): Promise<void> {
        await Relation.deleteOne({ _id: relationId, userId });
    }

    async getRelations(userId: string): Promise<IRelation[]> {
        return await Relation.find({ userId }).lean();
    }
}

export const relationService = new RelationService();
