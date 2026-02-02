import dotenv from 'dotenv';

dotenv.config();

export const config = {

  // URLS
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:3001',

  npm_package_version: process.env.npm_package_version,

  // Server Configuration
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database Configuration
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/memolink-dev',

  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '30d',

  // Cloudinary Configuration
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  // Security Configuration
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12'),
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),

  // File Upload Configuration
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  ALLOWED_FILE_TYPES: process.env.ALLOWED_FILE_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],

  // CORS Configuration
  CORS_ORIGIN: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],

  // Logging Configuration
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',


  EMAIL_HOST: process.env.EMAIL_HOST,
  EMAIL_PORT: process.env.EMAIL_PORT,
  EMAIL_USER: process.env.EMAIL_USER,
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_FROM: process.env.EMAIL_FROM,
  EMAIL_SECURE: process.env.EMAIL_SECURE,

  // Cloudflare R2 Configuration
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID || '',
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || '',
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || '',
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || '',

  // GitHub Configuration
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_OWNER: process.env.GITHUB_OWNER || '',
  GITHUB_REPO: process.env.GITHUB_REPO || '',

  // Redis Configuration
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // AI Configuration
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',

  // Auth Configuration
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  TEST_AUTH_TOKEN: process.env.TEST_AUTH_TOKEN || '',

  // Observability
  SENTRY_DSN_URL: process.env.SENTRY_DSN_URL || '',
} as const;

export type Config = typeof config;

// Validate required email environment variables
const validateEmailConfig = () => {
  const requiredEmailVars = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
  const missingVars = requiredEmailVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0 && process.env.NODE_ENV !== 'test') {
    const errorMsg = `Missing required email environment variables: ${missingVars.join(', ')}`;
    console.error(`❌ ${errorMsg}`);
    console.error('Email functionality will not work without these variables.');
    console.error('Please set them in your .env file or environment.');

    // Throw error to prevent startup with broken email
    throw new Error(errorMsg);
  }
};

// Run validation on module load
if (process.env.NODE_ENV !== 'test') {
  validateEmailConfig();
}

