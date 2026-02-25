import { ExportRequest } from "./export.types";

export interface IExportService {
  exportData(userId: string, options: ExportRequest, res: any): Promise<void>;
}
