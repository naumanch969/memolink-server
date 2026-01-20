# Email Feature Module

This module handles all email-related functionality for MemoLink.

## Architecture

The email system uses a 3-tier architecture:

1.  **Core Provider** (`src/core/email/`):
    - `EmailProvider.ts`: Singleton wrapper around `nodemailer`.
    - `templates/`: HTML template generators.
    - Low-level sending logic.

2.  **Queue Layer** (`src/features/email/queue/`):
    - `email.queue.ts`: BullMQ queue definition (`email-delivery`).
    - `email.worker.ts`: Worker that processes jobs and calls `EmailProvider`.
    - `email.types.ts`: Type definitions for job data.
    - Ensures reliability, retries, and rate limiting.

3.  **Service Layer**:
    - `src/config/email.ts`: Legacy service adapter (Refactored) that now pushes jobs to the queue instead of sending directly.

## Usage

To send an email, do NOT use `nodemailer` directly. Instead, use the `emailQueue` or the `emailService` helper.

```typescript
import { emailQueue } from 'src/features/email/queue/email.queue';

// Add a job
await emailQueue.add('welcome-email', {
  type: 'WELCOME',
  data: {
    to: 'user@example.com',
    name: 'John',
    frontendUrl: 'https://memolink.app'
  }
});
```

## Adding New Email Types

1.  Add a new type in `email.types.ts`.
2.  Add a new template in `src/core/email/templates/`.
3.  Add a case handler in `email.worker.ts`.
