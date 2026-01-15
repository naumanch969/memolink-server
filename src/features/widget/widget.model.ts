import mongoose, { Schema } from 'mongoose';
import { IWidget } from './widget.interfaces';

const widgetSchema = new Schema<IWidget>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        type: {
            type: String,
            required: true,
            enum: ['tasks', 'notes', 'calendar', 'custom'],
            default: 'tasks',
        },
        title: {
            type: String,
            required: false,
            trim: true,
            default: 'New Widget',
        },
        data: {
            type: Schema.Types.Mixed,
            default: {},
        },
        order: {
            type: Number,
            default: 0,
        },
        group: {
            type: String,
            required: false,
            trim: true,
            default: 'General',
        },
        isPinned: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Index for efficient querying by user and order
widgetSchema.index({ user: 1, order: 1 });

export const Widget = mongoose.model<IWidget>('Widget', widgetSchema);
