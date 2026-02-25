import { Response } from 'express';
import { ExportRequest } from '../export.types';

export interface ExportStrategy {
    execute(res: Response, userId: string, options: ExportRequest): Promise<void>;
}
