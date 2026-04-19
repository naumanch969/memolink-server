
import mongoose, { Schema } from 'mongoose';
import { IBadgeDefinition, IUserBadge } from './badge.interfaces';
import { BadgeRarity, BadgeCategory, BadgeStatus } from './badge.types';

const BadgeDefinitionSchema: Schema = new Schema({
    badgeId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, required: true },
    rarity: { type: String, enum: Object.values(BadgeRarity), default: BadgeRarity.COMMON },
    category: { type: String, enum: Object.values(BadgeCategory), default: BadgeCategory.MILESTONE },
    trigger: { type: String, required: true },
    status: { type: String, enum: Object.values(BadgeStatus), default: BadgeStatus.LIVE },
}, { timestamps: true });

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

export * from './badge.types';
export * from './badge.interfaces';
