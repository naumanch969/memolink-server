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
    users: any[];
    total: number;
    page: number;
    totalPages: number;
}
