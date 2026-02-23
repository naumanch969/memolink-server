export interface UserListFilter {
    page: number;
    limit: number;
    search?: string;
    role?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    isVerified?: boolean;
}

export interface UserListResult {
    users: any[]; // User objects from Mongo lean()
    total: number;
    page: number;
    totalPages: number;
}

export interface IUsersAdminService {
    getUsers(filter: UserListFilter): Promise<UserListResult>;
    getUserDetails(userId: string): Promise<any>;
    updateUser(userId: string, updates: Partial<any>): Promise<any>;
    deleteUser(userId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }>;
    deactivateUser(userId: string): Promise<any>;
    reactivateUser(userId: string): Promise<any>;
}
