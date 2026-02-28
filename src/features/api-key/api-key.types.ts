import { Document, Types } from 'mongoose';

export interface IApiKey {
    userId: Types.ObjectId;
    name: string;
    hashedKey: string;
    prefix: string;
    lastUsedAt?: Date;
    expiresAt?: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface IApiKeyDocument extends IApiKey, Document { }

export interface ICreateApiKeyDTO {
    name: string;
    expiresInDays?: number;
}

export interface IApiKeyResponse {
    _id: string;
    name: string;
    prefix: string;
    lastUsedAt?: Date;
    expiresAt?: Date;
    isActive: boolean;
    createdAt: Date;
}
