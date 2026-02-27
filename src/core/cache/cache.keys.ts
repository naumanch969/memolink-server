export const CacheKeys = {
    userProfile: (userId: string) => `user:${userId}:profile`,
    userPreferences: (userId: string) => `user:${userId}:prefs`,
    userStorage: (userId: string) => `user:${userId}:storage`,
} as const;
