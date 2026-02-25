import { Types } from "mongoose";
import { BaseEntity } from "../../shared/types";

export interface ITag extends BaseEntity {
    userId: Types.ObjectId;
    name: string;
    color?: string;
    description?: string;
    usageCount: number;
}

export interface CreateTagRequest {
    name: string;
    color?: string;
    description?: string;
}

export interface UpdateTagRequest {
    name?: string;
    color?: string;
    description?: string;
}
