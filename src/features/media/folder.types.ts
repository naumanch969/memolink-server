import { Types } from "mongoose";
import { BaseEntity } from "../../shared/types";

export interface IFolder extends BaseEntity {
    userId: Types.ObjectId;
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    parentId?: Types.ObjectId;
    path: string;
    isDefault: boolean;
    itemCount: number;
}

export interface CreateFolderRequest {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    parentId?: string;
}

export interface UpdateFolderRequest {
    name?: string;
    description?: string;
    color?: string;
    icon?: string;
    parentId?: string;
}
