import { Response } from 'express';
import { ExportRequest } from '../export.interfaces';

export interface ExportStrategy {
    execute(res: Response, userId: string, options: ExportRequest): Promise<void>;
}
