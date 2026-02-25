import { AnnouncementType } from "./announcement.model";

export interface CreateAnnouncementDto {
    title: string;
    content: string;
    type: AnnouncementType;
    target?: {
            roles?: string[];
        };
    scheduledAt?: Date;
    authorId: string;
}
