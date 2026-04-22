export type EmailJobType = 
    | 'VERIFICATION' 
    | 'PASSWORD_RESET' 
    | 'WELCOME' 
    | 'SECURITY_ALERT' 
    | 'GENERIC' 
    | 'WAITLIST_CONFIRMATION' 
    | 'WAITLIST_ADMIN_ALERT' 
    | 'BADGE_UNLOCKED'
    | 'TEMPLATED';

export interface BaseEmailJobData {
    to: string;
    logId: string; // Required for all jobs to sync with EmailLog
}

export interface VerificationEmailJobData extends BaseEmailJobData {
    name: string;
    otp: string;
}

export interface PasswordResetEmailJobData extends BaseEmailJobData {
    name: string;
    resetToken: string;
    frontendUrl: string;
}

export interface WelcomeEmailJobData extends BaseEmailJobData {
    name: string;
    frontendUrl: string;
}

export interface SecurityAlertEmailJobData extends BaseEmailJobData {
    name: string;
    wrongAnswer: string;
}

export interface GenericEmailJobData extends BaseEmailJobData {
    subject: string;
    html: string;
    text?: string;
}

export interface WaitlistConfirmationEmailJobData extends BaseEmailJobData {
    email: string;
}

export interface WaitlistAdminAlertEmailJobData extends BaseEmailJobData {
    email: string;
}

export interface BadgeUnlockedEmailJobData extends BaseEmailJobData {
    userName: string;
    badgeName: string;
    badgeDescription: string;
    badgeId: string;
    rarity: string;
}

export interface TemplatedEmailJobData extends BaseEmailJobData {
    templateName: string;
    templateData: Record<string, any>;
    subjectOverride?: string;
}

export interface EmailJob {
    type: EmailJobType;
    data: 
        | VerificationEmailJobData 
        | PasswordResetEmailJobData 
        | WelcomeEmailJobData 
        | SecurityAlertEmailJobData 
        | GenericEmailJobData 
        | WaitlistConfirmationEmailJobData 
        | WaitlistAdminAlertEmailJobData 
        | BadgeUnlockedEmailJobData
        | TemplatedEmailJobData;
}
