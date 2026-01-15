import { Document, Types } from 'mongoose';

export interface IWidgetItem {
    id: string;
    text: string;
    completed: boolean;
    completedAt?: string; // ISO timestamp of when task was completed
}

export interface IWidgetData {
    tasks?: IWidgetItem[];
    content?: string;
    [key: string]: any;
}

export interface IWidget extends Document {
    user: Types.ObjectId;
    type: 'tasks' | 'notes' | 'calendar' | 'custom';
    title: string;
    data: IWidgetData;
    order: number;
    group?: string;
    isPinned?: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateWidgetParams {
    type: string;
    title: string;
    data?: IWidgetData;
    order?: number;
}

export interface UpdateWidgetParams {
    title?: string;
    data?: IWidgetData;
    order?: number;
    group?: string;
    isPinned?: boolean;
}
