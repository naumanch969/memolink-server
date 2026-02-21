import { PAGINATION } from '../constants';

export class PaginationUtil {
    /**
     * Extracts and validates pagination parameters from a query object
     */
    static getPaginationParams(query: any) {
        const page = Math.max(1, parseInt(query.page) || PAGINATION.DEFAULT_PAGE);
        const limit = Math.min(
            PAGINATION.MAX_LIMIT,
            Math.max(1, parseInt(query.limit) || PAGINATION.DEFAULT_LIMIT)
        );
        const skip = (page - 1) * limit;

        return { page, limit, skip };
    }

    /**
     * Extracts sort parameters from a query object
     */
    static getSortParams(query: any, defaultSort: string = 'createdAt') {
        const sort = query.sort || defaultSort;
        const order = query.order === 'asc' ? 1 : -1;

        return { [sort]: order };
    }
}
