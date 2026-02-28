import { Types } from 'mongoose';
import { IApiKeyDocument, ICreateApiKeyDTO } from './api-key.types';

export interface IApiKeyService {
    createApiKey(userId: Types.ObjectId | string, dto: ICreateApiKeyDTO): Promise<{ rawKey: string; key: IApiKeyDocument }>;
    revokeApiKey(userId: Types.ObjectId | string, keyId: string): Promise<void>;
    listApiKeys(userId: Types.ObjectId | string): Promise<IApiKeyDocument[]>;
    verifyAndGetUser(rawKey: string): Promise<Types.ObjectId | null>;
}
