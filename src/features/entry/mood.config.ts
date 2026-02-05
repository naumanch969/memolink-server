
export enum MoodCategory {
    EXCELLENT = 'excellent',
    GOOD = 'good',
    NEUTRAL = 'neutral',
    CALM = 'calm',
    FOCUS = 'focus',
    STRESSED = 'stressed',
    SAD = 'sad',
    ANGRY = 'angry',
}

export interface MoodMetadata {
    category: MoodCategory;
    score: number;
    color: string;
    icon: string;
}

export const MOOD_LEXICON: Record<MoodCategory, string[]> = {
    [MoodCategory.EXCELLENT]: ['ecstatic', 'happy', 'excited', 'great', 'wonderful', 'amazing', 'loved', 'joyful', 'energetic', 'motivated', 'proud', 'optimistic', 'appreciative', 'blissful', 'empowered', 'accomplished', 'determined'],
    [MoodCategory.GOOD]: ['good', 'content', 'positive', 'satisfied', 'fine', 'hopeful', 'constructive', 'grateful'],
    [MoodCategory.NEUTRAL]: ['neutral', 'average', 'okay', 'bored', 'tired', 'indifferent', 'confused', 'busy', 'uncertain', 'pensive', 'distracted', 'numb', 'sleepy', 'reflective', 'mixed', 'observant'],
    [MoodCategory.CALM]: ['calm', 'peaceful', 'relaxed', 'chill', 'serene', 'tranquil'],
    [MoodCategory.FOCUS]: ['focused', 'productive', 'busy', 'working', 'determined', 'disciplined'],
    [MoodCategory.STRESSED]: ['stressed', 'anxious', 'nervous', 'annoyed', 'frustrated', 'overwhelmed', 'worried', 'panicked', 'jittery'],
    [MoodCategory.SAD]: ['sad', 'down', 'depressed', 'lonely', 'disappointed', 'heartbroken', 'gloomy', 'melancholy'],
    [MoodCategory.ANGRY]: ['angry', 'mad', 'furious', 'irritated', 'resentful', 'outraged', 'hostile'],
};

export const MOOD_METADATA: Record<MoodCategory, MoodMetadata> = {
    [MoodCategory.EXCELLENT]: { category: MoodCategory.EXCELLENT, score: 5, color: '#10b981', icon: '😊' }, // emerald-500
    [MoodCategory.GOOD]: { category: MoodCategory.GOOD, score: 4, color: '#84cc16', icon: '🙂' }, // lime-500
    [MoodCategory.NEUTRAL]: { category: MoodCategory.NEUTRAL, score: 3, color: '#f59e0b', icon: '😐' }, // amber-500
    [MoodCategory.CALM]: { category: MoodCategory.CALM, score: 4, color: '#14b8a6', icon: '😌' }, // teal-500
    [MoodCategory.FOCUS]: { category: MoodCategory.FOCUS, score: 4, color: '#6366f1', icon: '🧠' }, // indigo-500
    [MoodCategory.STRESSED]: { category: MoodCategory.STRESSED, score: 2, color: '#f97316', icon: '😰' }, // orange-500
    [MoodCategory.SAD]: { category: MoodCategory.SAD, score: 2, color: '#3b82f6', icon: '😔' }, // blue-500
    [MoodCategory.ANGRY]: { category: MoodCategory.ANGRY, score: 1, color: '#ef4444', icon: '😠' }, // red-500
};

export const classifyMood = (moodStr: string): MoodMetadata | null => {
    const m = moodStr.toLowerCase().trim();
    if (!m) return null;

    for (const [category, synonyms] of Object.entries(MOOD_LEXICON)) {
        if (synonyms.some(s => m.includes(s) || s.includes(m))) {
            return MOOD_METADATA[category as MoodCategory];
        }
    }

    return null;
};
