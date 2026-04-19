
import { BadgeRarity, BadgeCategory } from './badge.model';

export const INITIAL_BADGES = [
    {
        badgeId: 'founding-customer',
        name: 'Founding Customer',
        description: 'One of the first 50 visionaries who believed in Brinn before anyone else did.',
        icon: 'Crown',
        rarity: BadgeRarity.LEGENDARY,
        category: BadgeCategory.IDENTITY,
        trigger: 'Awarded to the first 50 paying customers.',
        isEnabled: true
    },
    {
        badgeId: 'early-adopter',
        name: 'Early Adopter',
        description: 'Joined Brinn during the experimental beta phase.',
        icon: 'Zap',
        rarity: BadgeRarity.EPIC,
        category: BadgeCategory.IDENTITY,
        trigger: 'Account created before May 2026.',
        isEnabled: true
    },
    {
        badgeId: 'power-user',
        name: 'Power User',
        description: 'Demonstrated exceptional mastery over the platform features.',
        icon: 'Cpu',
        rarity: BadgeRarity.RARE,
        category: BadgeCategory.POWER,
        trigger: 'Used more than 10 advanced features in 30 days.',
        isEnabled: true
    },
    {
        badgeId: 'data-architect',
        name: 'Data Architect',
        description: 'Created a highly complex network of entities and entries.',
        icon: 'Network',
        rarity: BadgeRarity.EPIC,
        category: BadgeCategory.INSIGHT,
        trigger: 'Linked over 100 entities in the graph view.',
        isEnabled: true
    }
];
