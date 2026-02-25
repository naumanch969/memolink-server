import { UserListFilter, UserListResult } from "./users.types";

export interface IUsersAdminService {
    getUsers(filter: UserListFilter): Promise<UserListResult>;
    getUserDetails(userId: string): Promise<any>;
    updateUser(userId: string, updates: Partial<any>): Promise<any>;
    deleteUser(userId: string): Promise<{ success: boolean; deletedCounts: Record<string, number> }>;
    deactivateUser(userId: string): Promise<any>;
    reactivateUser(userId: string): Promise<any>;
}
