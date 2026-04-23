
import { BadgeRarity, BadgeCategory, BadgeStatus } from './badge.types';

export interface RegistryBadge {
    badgeId: string;
    name: string;
    description: string;
    icon: string;
    rarity: BadgeRarity;
    category: BadgeCategory;
    trigger: string;
    status: BadgeStatus;
}

export const INITIAL_BADGES: RegistryBadge[] = [
    // ── IDENTITY ─────────────────────────────────────────────────────────────
    {
        badgeId: 'founding_customer',
        name: 'Founding Customer',
        description: 'One of the first 50 visionaries who believed in Brinn before anyone else did.',
        icon: 'Crown',
        rarity: BadgeRarity.LEGENDARY,
        category: BadgeCategory.IDENTITY,
        trigger: 'Awarded to the first 50 paying customers.',
        status: BadgeStatus.EXPIRED, // Window closed
    },
    {
        badgeId: 'early_adopter',
        name: 'Early Adopter',
        description: 'Joined Brinn in its earliest days, when most people still hadn\'t heard of it.',
        icon: 'Rocket',
        rarity: BadgeRarity.EPIC,
        category: BadgeCategory.IDENTITY,
        trigger: 'Awarded to customers #51–500.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'beta_tester',
        name: 'Beta Tester',
        description: 'Helped shape Brinn by testing it before it was ready for the world.',
        icon: 'FlaskConical',
        rarity: BadgeRarity.RARE,
        category: BadgeCategory.IDENTITY,
        trigger: 'Awarded to users who joined via a closed beta invitation.',
        status: BadgeStatus.LOCKED, // Feature gated
    },

    // ── MILESTONE ────────────────────────────────────────────────────────────
    {
        badgeId: 'first_thought',
        name: 'First Thought',
        description: 'Your very first memory captured. Every mind has to start somewhere.',
        icon: 'Sparkles',
        rarity: BadgeRarity.COMMON,
        category: BadgeCategory.MILESTONE,
        trigger: 'Captured the first entry.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'memory_keeper',
        name: 'Memory Keeper',
        description: '100 thoughts trusted to Brinn. Your brain is starting to have a backup.',
        icon: 'BookMarked',
        rarity: BadgeRarity.UNCOMMON,
        category: BadgeCategory.MILESTONE,
        trigger: 'Captured 100 entries.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'thought_weaver',
        name: 'Thought Weaver',
        description: '50 thoughts captured. You\'re building a real treasure trove of memories.',
        icon: 'Layers',
        rarity: BadgeRarity.UNCOMMON,
        category: BadgeCategory.MILESTONE,
        trigger: 'Captured 50 entries.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'deca_thought',
        name: 'Deca-Thought',
        description: '10 thoughts captured. You\'re officially making journaling a habit.',
        icon: 'Activity',
        rarity: BadgeRarity.COMMON,
        category: BadgeCategory.MILESTONE,
        trigger: 'Captured 10 entries.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'deep_archivist',
        name: 'Deep Archivist',
        description: '500 memories stored. You\'re not just capturing — you\'re building a mind.',
        icon: 'Library',
        rarity: BadgeRarity.RARE,
        category: BadgeCategory.MILESTONE,
        trigger: 'Captured 500 entries.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'mind_vault',
        name: 'Mind Vault',
        description: '1,000 thoughts. Brinn knows you better than most people ever will.',
        icon: 'Vault',
        rarity: BadgeRarity.EPIC,
        category: BadgeCategory.MILESTONE,
        trigger: 'Captured 1,000 entries.',
        status: BadgeStatus.LIVE,
    },

    // ── INSIGHT ──────────────────────────────────────────────────────────────
    {
        badgeId: 'pattern_spotter',
        name: 'Pattern Spotter',
        description: 'Brinn noticed something about you that you hadn\'t noticed yourself.',
        icon: 'GitBranch',
        rarity: BadgeRarity.UNCOMMON,
        category: BadgeCategory.INSIGHT,
        trigger: 'Received the first AI-generated insight.',
        status: BadgeStatus.LOCKED, // Phase 2
    },
    {
        badgeId: 'recall_master',
        name: 'Recall Master',
        description: 'You\'ve pulled thoughts from the past 50 times. Your memory is no longer linear.',
        icon: 'SearchCode',
        rarity: BadgeRarity.RARE,
        category: BadgeCategory.INSIGHT,
        trigger: 'Performed 50 semantic searches.',
        status: BadgeStatus.LOCKED, // Ships with search
    },
    {
        badgeId: 'self_aware',
        name: 'Self Aware',
        description: 'Brinn has built a complete mental model of who you are. You\'ve been understood.',
        icon: 'BrainCircuit',
        rarity: BadgeRarity.EPIC,
        category: BadgeCategory.INSIGHT,
        trigger: 'Mental model completed its first full version (all dimensions populated).',
        status: BadgeStatus.LOCKED, // Mental model ships later
    },

    // ── LOYALTY ──────────────────────────────────────────────────────────────
    {
        badgeId: 'streak_thinker',
        name: 'Streak Thinker',
        description: '7 days straight of capturing thoughts. This is becoming a habit.',
        icon: 'Flame',
        rarity: BadgeRarity.UNCOMMON,
        category: BadgeCategory.LOYALTY,
        trigger: 'Captured at least one entry every day for 7 consecutive days.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'loyal_mind',
        name: 'Loyal Mind',
        description: '30 days with Brinn. Your memory is no longer just yours — it\'s growing.',
        icon: 'CalendarCheck',
        rarity: BadgeRarity.RARE,
        category: BadgeCategory.LOYALTY,
        trigger: 'Active Brinn user for 30 days since signup.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'monthly_mindset',
        name: 'Monthly Mindset',
        description: '30 days straight of capturing thoughts. Your brain is now powered by Brinn.',
        icon: 'Zap',
        rarity: BadgeRarity.RARE,
        category: BadgeCategory.LOYALTY,
        trigger: 'Captured at least one entry every day for 30 consecutive days.',
        status: BadgeStatus.LIVE,
    },
    {
        badgeId: 'devoted_mind',
        name: 'Devoted Mind',
        description: '90 days. Brinn has become part of how you think.',
        icon: 'Hourglass',
        rarity: BadgeRarity.EPIC,
        category: BadgeCategory.LOYALTY,
        trigger: 'Active Brinn user for 90 days since signup.',
        status: BadgeStatus.LIVE,
    },

    // ── POWER ────────────────────────────────────────────────────────────────
    {
        badgeId: 'voice_thinker',
        name: 'Voice Thinker',
        description: 'You think out loud. 25 voice notes captured — your mind moves faster than your fingers.',
        icon: 'Mic',
        rarity: BadgeRarity.UNCOMMON,
        category: BadgeCategory.POWER,
        trigger: 'Captured 25 voice notes.',
        status: BadgeStatus.LOCKED, // Voice notes ship soon
    },
    {
        badgeId: 'network_builder',
        name: 'Network Builder',
        description: 'Brinn now knows 10 people in your world — and how they affect you.',
        icon: 'Network',
        rarity: BadgeRarity.UNCOMMON,
        category: BadgeCategory.POWER,
        trigger: 'Added 10 people to the people network.',
        status: BadgeStatus.LOCKED, // Phase 2
    },
    {
        badgeId: 'mcp_pioneer',
        name: 'MCP Pioneer',
        description: 'You connected Brinn to an AI assistant. Now your AI actually knows you.',
        icon: 'Plug',
        rarity: BadgeRarity.EPIC,
        category: BadgeCategory.POWER,
        trigger: 'Connected Brinn via MCP to Claude or Gemini.',
        status: BadgeStatus.LOCKED, // Phase 3
    },
];
