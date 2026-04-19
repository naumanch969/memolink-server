
import mongoose, { Document } from 'mongoose';
import { BadgeRarity, BadgeCategory, BadgeStatus } from './badge.types';

export interface IBadgeDefinition extends Document {
    badgeId: string;
    name: string;
    description: string;
    icon: string;
    rarity: BadgeRarity;
    category: BadgeCategory;
    trigger: string;
    isEnabled: boolean;
    status: BadgeStatus;
}

export interface IUserBadge extends Document {
    userId: mongoose.Types.ObjectId;
    badgeId: string;
    awardedAt: Date;
    metadata?: Record<string, any>;
}
