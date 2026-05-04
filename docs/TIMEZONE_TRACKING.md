# Timezone Tracking & Localization

Brinn tracks user timezones to provide localized experiences, such as time-of-day greetings ("Good Morning") and accurate timestamping in reports, regardless of where the server is deployed.

## Core Logic

### 1. The Heartbeat Sync
Timezone tracking is performed passively during authentication for web and mobile clients.

- **Trigger:** Any request passing through `AuthMiddleware`.
- **Header:** The client sends the `x-timezone` header (e.g., `America/New_York`).
- **Comparison:** `AuthMiddleware.syncTimezone` compares the header with the stored `user.timezone`.
- **Update Frequency:** An update to the database and cache occurs if:
    - The timezone has changed.
    - **OR** the `timezoneUpdatedAt` is older than 24 hours (a "heartbeat" to ensure the data is fresh).

### 2. Storage & Caching
- **Database:** Stored in the `User` model (`timezone` and `timezoneUpdatedAt` fields).
- **Cache:** Included in the user profile cache (`user:${userId}:profile`).
- **Invalidation:** When a timezone change or heartbeat update occurs, the user profile cache is invalidated to ensure consistency across the system.

### 3. Usage: Receptionist Responses
The `ReceptionService` uses the tracked timezone to generate contextually aware acknowledgments for incoming memos (e.g., via WhatsApp).

#### Safety Valve: Stale Timezone Protection
To avoid sending a "Good Morning" message to a user who has just flown across the world but hasn't opened the app yet:
- If `timezoneUpdatedAt` is older than **48 hours**, the system considers the timezone "stale."
- In this state, time-based greetings are skipped, and the system defaults to time-neutral acknowledgments (e.g., "Got it. Saved.").

## Integration Details

| Component | Responsibility |
|-----------|----------------|
| `AuthMiddleware` | Intercepts `x-timezone` header and triggers sync. |
| `User` Model | Persists `timezone` (string) and `timezoneUpdatedAt` (date). |
| `ReceptionService` | Calculates localized hour using `date-fns-tz` for greetings. |
| `WhatsAppProvider` | Passes user timezone context to the `ReceptionService`. |

## Client Implementation
Clients (Web/Mobile) should send the current IANA timezone string in every request:
```http
x-timezone: Europe/London
```
