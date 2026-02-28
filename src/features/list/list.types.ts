import { Document, Types } from "mongoose";

export interface IListItem {
    id: string;
    text: string;
    completed: boolean;
    completedAt?: string;
}

export interface IListData {
    [key: string]: any;
    tasks?: IListItem[];
    content?: string;
}

export interface IList extends Document {
    user: Types.ObjectId;
    type: 'tasks' | 'notes' | 'calendar' | 'custom';
    title: string;
    data: IListData;
    order: number;
    group?: string;
    isPinned?: boolean;
    isSystem?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateListParams {
    type: string;
    title: string;
    data?: IListData;
    order?: number;
}

export interface UpdateListParams {
    title?: string;
    data?: IListData;
    order?: number;
    group?: string;
    isPinned?: boolean;
}
