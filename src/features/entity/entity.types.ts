import { Types } from "mongoose";
import { BaseEntity } from "../../shared/types";
import { NodeType } from "./entity.interfaces";

export interface IKnowledgeEntity extends BaseEntity {
    userId: Types.ObjectId;
    name: string;
    otype: NodeType;
    aliases?: string[];
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
    rawMarkdown: string;
    summary?: string;
    tags?: string[];
    interactionCount: number;
    lastInteractionAt?: Date;
    lastInteractionSummary?: string;
    sentimentScore?: number;
    metadata: Record<string, any>;
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
