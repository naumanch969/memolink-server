import { Types } from 'mongoose';
import { BaseEntity } from '../../shared/types';
import { NodeType } from '../graph/edge.model';

export { NodeType };

export interface IKnowledgeEntity extends BaseEntity {
    userId: Types.ObjectId;
    name: string;
    otype: NodeType; // Unified Object Type from TAO
    aliases?: string[]; // Alternative names (e.g., 'The Boss', 'Mom')

    // Scraper & Structured Data
    email?: string;
    phone?: string;
    avatar?: string;
    jobTitle?: string;
    company?: string;
    role?: string;
    birthday?: Date;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
    };

    // Living Narrative (The Dynamics)
    rawMarkdown: string; // The "Source of Truth" living document
    summary?: string; // High-level executive summary

    // Organization & Metrics
    tags?: string[];
    interactionCount: number;
    lastInteractionAt?: Date;
    lastInteractionSummary?: string;
    sentimentScore?: number;

    // Metadata for Scrapers (LinkedIn, GitHub, etc.)
    metadata: Record<string, any>;

    // Soft Delete
    isDeleted: boolean;
    deletedAt?: Date;
}

export interface CreateEntityRequest {
    name: string;
    otype: NodeType;
    aliases?: string[];
    metadata?: Record<string, any>;
    rawMarkdown?: string;
    summary?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    jobTitle?: string;
    company?: string;
    role?: string;
    birthday?: Date;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
    };
    tags?: string[];
    interactionCount?: number;
    lastInteractionAt?: Date;
    lastInteractionSummary?: string;
    sentimentScore?: number;
}

export interface UpdateEntityRequest {
    name?: string;
    otype?: NodeType;
    aliases?: string[];
    metadata?: Record<string, any>;
    rawMarkdown?: string;
    summary?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    jobTitle?: string;
    company?: string;
    role?: string;
    birthday?: Date;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        country?: string;
        zipCode?: string;
    };
    tags?: string[];
    interactionCount?: number;
    lastInteractionAt?: Date;
    lastInteractionSummary?: string;
    sentimentScore?: number;
}

export interface IEntityService {
    getEntityRegistry(userId: string): Promise<Record<string, string>>;
    createEntity(userId: string, data: CreateEntityRequest, options?: any): Promise<IKnowledgeEntity>;
    getEntityById(entityId: string, userId: string): Promise<IKnowledgeEntity>;
    getEntitiesByIds(entityIds: string[], userId: string): Promise<IKnowledgeEntity[]>;
    updateEntity(entityId: string, userId: string, data: UpdateEntityRequest, options?: any): Promise<IKnowledgeEntity>;
    deleteEntity(entityId: string, userId: string, options?: any): Promise<void>;
    listEntities(userId: string, options?: any): Promise<{ entities: any[]; total: number; page: number; totalPages: number }>;
    deleteUserData(userId: string): Promise<number>;
    findOrCreateEntity(userId: string, name: string, otype: NodeType, options?: any): Promise<IKnowledgeEntity>;
    migrateFromPersons(userId: string): Promise<void>;
}

