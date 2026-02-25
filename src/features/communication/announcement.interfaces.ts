import { IAnnouncement } from './announcement.model';
import { CreateAnnouncementDto } from "./announcement.types";

export interface IAnnouncementService {
    createAnnouncement(data: CreateAnnouncementDto): Promise<IAnnouncement>;
    getAnnouncements(page?: number, limit?: number): Promise<{ data: IAnnouncement[]; total: number }>;
    getAnnouncementById(id: string): Promise<IAnnouncement | null>;
    updateAnnouncement(id: string, updates: Partial<CreateAnnouncementDto>): Promise<IAnnouncement | null>;
    deleteAnnouncement(id: string): Promise<boolean>;
    getDeliveryLogs(announcementId: string, page?: number, limit?: number): Promise<any>;
    dispatchAnnouncement(id: string): Promise<IAnnouncement | null>;
}
