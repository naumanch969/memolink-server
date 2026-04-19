
import mongoose, { Schema, Document } from 'mongoose';

export enum BadgeRarity {
    COMMON = 'common',
    UNCOMMON = 'uncommon',
    RARE = 'rare',
    EPIC = 'epic',
    LEGENDARY = 'legendary',
}

export enum BadgeCategory {
    IDENTITY = 'identity',
    MILESTONE = 'milestone',
    INSIGHT = 'insight',
    LOYALTY = 'loyalty',
    POWER = 'power',
}

export interface IBadgeDefinition extends Document {
    badgeId: string; // Unique string identifier (e.g., 'founding-customer')
    name: string;
    description: string;
    icon: string;
    rarity: BadgeRarity;
    category: BadgeCategory;
    trigger: string;
    isEnabled: boolean;
}

const BadgeDefinitionSchema: Schema = new Schema({
    badgeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    rarity: { type: String, enum: Object.values(BadgeRarity), default: BadgeRarity.COMMON },
    category: { type: String, enum: Object.values(BadgeCategory), default: BadgeCategory.MILESTONE },
    trigger: { type: String, required: true },
    isEnabled: { type: Boolean, default: true },
}, { timestamps: true });

export interface IUserBadge extends Document {
    userId: mongoose.Types.ObjectId;
    badgeId: string;
    awardedAt: Date;
    metadata?: Record<string, any>;
}

const UserBadgeSchema: Schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    badgeId: { type: String, required: true },
    awardedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

// Ensure a user can only have one of each badge
UserBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

export const BadgeDefinition = mongoose.model<IBadgeDefinition>('BadgeDefinition', BadgeDefinitionSchema);
export const UserBadge = mongoose.model<IUserBadge>('UserBadge', UserBadgeSchema);
