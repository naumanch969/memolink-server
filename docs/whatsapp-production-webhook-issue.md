# WhatsApp Production Webhook — Issue & Fix Documentation

**Date:** 24-Apr-2026  
**Status:** Resolved  
**Severity:** Critical — production number completely silent

---

## The Symptom

Messages sent to the **test number** (`15551871411`) triggered webhooks correctly and were processed by the server. Messages sent to the **production number** (`923296923696`) produced no webhook events whatsoever — the server received nothing, no logs, complete silence.

Outbound messages from the production number worked fine (curl to `/messages` returned `200 OK`). Only inbound webhooks were broken.

---

## The Investigation

### Step 1 — Ruled out webhook subscription
Webhook fields (specifically `messages`) were confirmed subscribed in Meta Developer Dashboard → WhatsApp → Configuration → Webhook. This was not the issue.

### Step 2 — Ruled out phone number ID mismatch
The `WHATSAPP_PHONE_NUMBER_ID` env variable had a one-digit typo:
```
Wrong:   1102556439549358
Correct: 1102556439599358
```
This was fixed but did not resolve the webhook silence on production.

### Step 3 — Ruled out token permissions
The system user token was valid and correctly scoped — outbound messages worked. Inbound webhook silence persisted.

### Step 4 — Identified the root cause
Examining the test number webhook logs revealed:

```json
"entry": [{
  "id": "907114158774696"  ← Test WABA ID
}]
```

The production number belongs to a completely different WABA:
```
Production WABA ID: 1318618643534194
```

These are two separate WhatsApp Business Accounts. The webhook subscription configured via the Developer Dashboard UI only applied to the **test WABA** (`907114158774696`) — Meta's default. The production WABA had **never been subscribed** to the app's webhook.

---

## Why This Happens

Meta's Developer Dashboard UI automatically subscribes the **test WABA** to your app's webhook when you first configure it. This gives the false impression that webhook configuration is global.

In reality, webhook subscriptions are **per-WABA**. Each WABA must be explicitly subscribed to your app separately. The Dashboard UI has no mechanism to do this for non-test WABAs — it must be done via API.

```
Developer Dashboard UI
    └── Configures webhook URL ✅
    └── Subscribes TEST WABA automatically ✅
    └── Does NOT subscribe production WABA ❌ ← silent gap
```

---

## The Fix

One API call to subscribe the production WABA to the app's webhook:

```bash
curl -i -X POST \
  "https://graph.facebook.com/v25.0/1318618643534194/subscribed_apps" \
  -H "Authorization: Bearer YOUR_SYSTEM_USER_TOKEN"
```

Response:
```json
{"success": true}
```

After this call, messages to the production number immediately started firing webhooks with the correct metadata:

```json
"entry": [{
  "id": "1318618643534194",        ← production WABA
  "changes": [{
    "value": {
      "metadata": {
        "phone_number_id": "1102556439599358",   ← production number ID
        "display_phone_number": "923296923696"   ← production number
      }
    }
  }]
}]
```

---

## Brinn's WABA Reference

| | Test | Production |
|---|---|---|
| WABA ID | `907114158774696` | `1318618643534194` |
| Phone Number ID | `1033355346526607` | `1102556439599358` |
| Display Number | `15551871411` | `923296923696` |
| Webhook Subscribed | Auto (by dashboard) | Manual (via API) |

---

## Deployment Checklist — Required for Any New WABA

Whenever a new WABA or production phone number is added, run this immediately:

```bash
# Replace WABA_ID with the new WABA's ID
curl -i -X POST \
  "https://graph.facebook.com/v25.0/WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer YOUR_SYSTEM_USER_TOKEN"
```

Confirm response is `{"success": true}` before testing inbound messages.

To verify which WABAs are currently subscribed:

```bash
curl -i -X GET \
  "https://graph.facebook.com/v25.0/WABA_ID/subscribed_apps" \
  -H "Authorization: Bearer YOUR_SYSTEM_USER_TOKEN"
```

---

## Server-Side Guard (Recommended)

The server should log a clear warning — not silently drop — when an unrecognized WABA or phone number ID appears in a webhook payload:

```typescript
// In WhatsAppProvider.handleWebhook
const expectedPhoneNumberId = config.WHATSAPP_PHONE_NUMBER_ID

if (metadata.phone_number_id !== expectedPhoneNumberId) {
  logger.warn('WhatsApp Phone Number ID mismatch', {
    expected: expectedPhoneNumberId,
    received: metadata.phone_number_id,
    wabaId: entry.id
  })
  // Do not silently return — log and continue or alert
}
```

This warning was the key log line that exposed the WABA mismatch during debugging.

---

## Related Issues Fixed in the Same Session

| Issue | Fix |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` one-digit typo | Corrected in `.env` |
| Temporary dashboard token used instead of system user token | System user token used for all API calls |
| Production WABA not subscribed to webhook | `POST /WABA_ID/subscribed_apps` |
| `WHATSAPP_DISPLAY_NUMBER` used as fallback for Phone Number ID | Separated strictly — never used interchangeably |
