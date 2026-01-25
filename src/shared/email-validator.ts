import { logger } from '../config/logger';

/**
 * Validates an email address format
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
export const isValidEmail = (email: string): boolean => {
    if (!email || typeof email !== 'string') {
        return false;
    }

    // RFC 5322 compliant email regex (simplified but robust)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Additional checks
    const isFormatValid = emailRegex.test(email);
    const isLengthValid = email.length <= 254; // RFC 5321
    const hasValidLocalPart = email.split('@')[0]?.length <= 64; // RFC 5321

    return isFormatValid && isLengthValid && hasValidLocalPart;
};

/**
 * Validates and throws error if email is invalid
 * @param email - Email address to validate
 * @param context - Context for error message (e.g., 'verification email')
 * @throws Error if email is invalid
 */
export const validateEmailOrThrow = (email: string, context: string = 'email'): void => {
    if (!isValidEmail(email)) {
        logger.error(`Invalid email address for ${context}`, { email });
        throw new Error(`Invalid email address: ${email}`);
    }
};

/**
 * Validates multiple email addresses
 * @param emails - Array of email addresses to validate
 * @returns Object with valid and invalid emails
 */
export const validateEmails = (emails: string[]): { valid: string[]; invalid: string[] } => {
    const valid: string[] = [];
    const invalid: string[] = [];

    for (const email of emails) {
        if (isValidEmail(email)) {
            valid.push(email);
        } else {
            invalid.push(email);
        }
    }

    return { valid, invalid };
};
