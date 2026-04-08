export type EmailJobType = 'VERIFICATION' | 'PASSWORD_RESET' | 'WELCOME' | 'SECURITY_ALERT' | 'GENERIC' | 'WAITLIST_CONFIRMATION' | 'WAITLIST_ADMIN_ALERT';

export interface BaseEmailJobData {
    to: string;
}

export interface VerificationEmailJobData extends BaseEmailJobData {
    name: string;
    otp: string;
}

export interface PasswordResetEmailJobData extends BaseEmailJobData {
    name: string;
    resetToken: string;
    frontendUrl: string; // Passed from config
}

export interface WelcomeEmailJobData extends BaseEmailJobData {
    name: string;
    frontendUrl: string; // Passed from config
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

export interface EmailJob {
    type: EmailJobType;
    data: VerificationEmailJobData | PasswordResetEmailJobData | WelcomeEmailJobData | SecurityAlertEmailJobData | GenericEmailJobData | WaitlistConfirmationEmailJobData | WaitlistAdminAlertEmailJobData;
}
