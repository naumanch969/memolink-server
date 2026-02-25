import { GlobalSearchRequest, GlobalSearchResponse } from "./search.types";

export interface ISearchService {
    globalSearch(userId: string, params: GlobalSearchRequest): Promise<GlobalSearchResponse>;
}

