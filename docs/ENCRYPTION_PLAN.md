# MemoLink — Privacy & Encryption Architecture (v3.3)

**Version:** 3.3  
**Status:** Implementation Guide  
**Date:** March 2026

---

## Philosophy

"We value your privacy" is marketing. Privacy is architecture.

MemoLink stores the most sensitive data a person can generate — fears, relationships, unfiltered thoughts. A breach here doesn't just lose customers. It destroys people's lives and ends the company.

**The core decision:** Two-tier encryption. Raw entries are user-owned — we cannot read them. Enrichments are service-encrypted — we can process them freely. Maximum privacy where it matters most. Zero operational friction everywhere else.

---

## The Core Tradeoff

| Layer | Key | Who Can Read | Why |
|-------|-----|--------------|-----|
| Raw entries | MDK (user-owned) | User only | What they actually wrote. Their words. Sacred. |
| Enrichments | Service Key (server-owned) | Server + user | Patterns, emotions, themes. Needed for reports, search, AI. |

**The honest privacy statement:**
```
We cannot read what you write.
We process the patterns derived from it to power your experience.
```

---

## Threat Model

| Threat | Risk | Mitigation |
|--------|------|------------|
| Database breach | Critical | Raw entries: ciphertext only, MDK is wrapped. Enrichments: service key not in DB. |
| Server compromise | Critical | Raw entries: MDK in Redis memory only, session-scoped. Enrichments: exposed during active ops. |
| Env variable leak | High | No master user key in env. SERVICE_KEY versioned — rotate and re-encrypt on leak. |
| Internal access | High | Cannot read raw entries without user password. Enrichments accessible — known tradeoff. |
| LLM data exposure | High | PII tokenization + ZDR agreements on all API calls. |
| Legal subpoena | Medium | Raw entries: unreadable without user password. Enrichments: accessible. |
| Session hijacking | Medium | 15-minute system lock + sliding TTL + rate-limited unlock. |

---

## Architecture Overview

```
ONE MDK PER USER — never stored plaintext, never changes unless rotated
    ↓ wrapped 3 independent ways

Wrapper 1: Password        → login / new device
Wrapper 2: Security Answer → system unlock (every 15min inactivity)
Wrapper 3: Recovery Phrase → last resort (forgot everything)

SESSION MODEL
  Login session:  week/month — long-lived JWT
  System lock:    15min inactivity — MDK removed from Redis
  Unlock:         security answer → re-derive MDK → back in Redis (~2s)
  Full re-login:  new device or explicit logout only

DATA MODEL
  Raw entry content  → AES-256-GCM with MDK         (user-owned)
  Enrichments        → AES-256-GCM with SERVICE_KEY  (server-operable)
  Blind indexes      → HMAC-SHA256 derived from MDK  (syntactic search)
  Embeddings         → stored inside enrichments      (semantic search)
```

---

---

# Phase 1 — The Vault

**What it delivers:** Encryption infrastructure. Users can register, log in, lock, unlock, change password, and recover. All entry content encrypted at rest. Nothing else built on top yet — but the foundation is complete and correct.

**Publishable state:** App works. Entries saved and retrievable. Encryption invisible to user. All auth flows functional.

---

## Schemas

**User Model:**
```typescript
{
  email:        { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },  // bcrypt — auth only, not encryption

  // Wrapper 1: Password
  passwordSalt:              { type: String, required: true },
  wrappedMDK_password:       { type: String, required: true },

  // Wrapper 2: Security Answer
  securityQuestion:          { type: String, required: true },
  securityAnswerSalt:        { type: String, required: true },
  wrappedMDK_securityAnswer: { type: String, required: true },

  // Wrapper 3: Recovery Phrase
  recoverySalt:              { type: String, required: true },
  wrappedMDK_recovery:       { type: String, required: true },

  // Unlock rate limiting
  unlockAttempts:    { type: Number, default: 0 },
  unlockLockedUntil: { type: Date },

  encryptionVersion: { type: Number, default: 3 }
}
```

**Entry Model:**
```typescript
{
  userId: { type: Schema.Types.ObjectId, required: true },

  // Raw content — MDK encrypted
  content:        { type: String, required: true },
  contentIv:      { type: String, required: true },
  contentAuthTag: { type: String, required: true },

  // Enrichments — Phase 2 (placeholders here)
  enrichments:        String,
  enrichmentsIv:      String,
  enrichmentsAuthTag: String,
  enrichmentKeyType:  { type: String, default: 'service' },  // migration flag
  serviceKeyVersion:  { type: Number, default: 1 },

  // Search — Phase 3
  searchIndexes: [{ type: String }],

  source:            { type: String, enum: ['app', 'whatsapp', 'voice', 'extension'] },
  enriched:          { type: Boolean, default: false },
  encryptionVersion: { type: Number, default: 3 },
  createdAt:         { type: Date, default: Date.now }
}

EntrySchema.index({ userId: 1, createdAt: -1 })
EntrySchema.index({ userId: 1, enriched: 1 })
EntrySchema.index({ userId: 1, searchIndexes: 1 })
EntrySchema.index({ serviceKeyVersion: 1 })
```

**KeyRotationState Model:**
```typescript
{
  userId:               { type: String, required: true },
  rotationType:         { type: String, enum: ['MDK', 'SERVICE_KEY'] },
  status:               { type: String, enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] },
  oldMDKWrapped:        String,  // MDK rotation: preserved until COMPLETED
  newMDKWrapped:        String,
  oldServiceKeyVersion: Number,  // SERVICE_KEY rotation
  newServiceKeyVersion: Number,
  processedCount:       { type: Number, default: 0 },
  totalCount:           Number,
  error:                String,
  startedAt:            { type: Date, default: Date.now },
  completedAt:          Date
}
```

---

## Encryption Service

**`src/services/encryption.service.ts`**

```typescript
import crypto from 'crypto'
import argon2 from 'argon2'

const ALGORITHM     = 'aes-256-gcm'
const MDK_LENGTH    = 32
const ARGON2_MEM    = 65536 // 64MB — memory-hard
const ARGON2_TIME   = 3     // 3 iterations
const ARGON2_PAR    = 4     // parallel threads

export class EncryptionService {

  // --- MDK ---

  static generateMDK(): Buffer {
    return crypto.randomBytes(MDK_LENGTH)
  }

  static async deriveKEK(secret: string, salt: string): Promise<Buffer> {
    // Argon2id — Memory-hard KDF protects against GPU/ASIC cracking
    // Same secret + same salt = same KEK.
    return await argon2.hash(secret, {
      type: argon2.argon2id,
      salt: Buffer.from(salt, 'hex'),
      memoryCost: ARGON2_MEM,
      timeCost: ARGON2_TIME,
      parallelism: ARGON2_PAR,
      hashLength: 32,
      raw: true
    })
  }

  static wrapKey(mdk: Buffer, kek: Buffer, version = 1): string {
    const iv        = crypto.randomBytes(12)
    const cipher    = crypto.createCipheriv('aes-256-gcm', kek, iv)
    const encrypted = Buffer.concat([cipher.update(mdk), cipher.final()])
    return JSON.stringify({
      ct: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      at: cipher.getAuthTag().toString('hex'),
      v:  version
    })
  }

  static unwrapKey(wrappedJson: string, kek: Buffer): Buffer {
    const { ct, iv, at } = JSON.parse(wrappedJson)
    const decipher = crypto.createDecipheriv('aes-256-gcm', kek, Buffer.from(iv, 'hex'))
    decipher.setAuthTag(Buffer.from(at, 'hex'))
    return Buffer.concat([
      decipher.update(Buffer.from(ct, 'hex')),
      decipher.final()
    ])
  }

  // --- ENCRYPT / DECRYPT ---

  static encrypt(plaintext: string, key: Buffer): EncryptedField {
    const iv     = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    const ct     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    return {
      content: ct.toString('hex'),
      iv:      iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex'),
      v:       1
    }
  }

  static decrypt(field: EncryptedField, key: Buffer): string {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(field.iv, 'hex'))
    decipher.setAuthTag(Buffer.from(field.authTag, 'hex'))
    try {
      return Buffer.concat([
        decipher.update(Buffer.from(field.content, 'hex')),
        decipher.final()
      ]).toString('utf8')
    } catch {
      throw new Error('DECRYPTION_FAILED: integrity check failed')
    }
  }

  // --- SERVICE KEY (enrichments — versioned) ---

  static getServiceKey(version?: number): { key: Buffer; version: number } {
    const v      = version ?? parseInt(process.env.CURRENT_SERVICE_KEY_VERSION ?? '1')
    const keyHex = process.env[`SERVICE_KEY_${v}`]
    if (!keyHex) throw new Error(`SERVICE_KEY_${v} not set`)
    return { key: Buffer.from(keyHex, 'hex'), version: v }
  }

  static encryptEnrichment(data: object): EncryptedField & { serviceKeyVersion: number } {
    const { key, version } = EncryptionService.getServiceKey()
    return { ...EncryptionService.encrypt(JSON.stringify(data), key), serviceKeyVersion: version }
  }

  static decryptEnrichment(field: EncryptedField & { serviceKeyVersion: number }): object {
    const { key } = EncryptionService.getServiceKey(field.serviceKeyVersion)
    return JSON.parse(EncryptionService.decrypt(field, key))
  }

  // --- BLIND INDEX (syntactic search) ---

  static generateBlindIndex(term: string, mdk: Buffer): string {
    const searchKey = crypto.createHmac('sha256', mdk).update('memolink-search-v1').digest()
    return crypto
      .createHmac('sha256', searchKey)
      .update(term.toLowerCase().replace(/[^a-z0-9]/g, '').trim())
      .digest('hex')
  }
}

export interface EncryptedField {
  content:            string
  iv:                 string
  authTag:            string
  v:                  number
  serviceKeyVersion?: number
}
```

---

## Session Service

**`src/services/session.service.ts`**

```typescript
import { createClient } from 'redis'

const redis    = createClient({ url: process.env.REDIS_URL })
const LOCK_TTL = 60 * 15  // 15 minutes inactivity → system lock

export async function storeSessionKey(userId: string, mdk: Buffer) {
  await redis.setEx(`vault:mdk:${userId}`, LOCK_TTL, mdk.toString('hex'))
}

export async function getSessionKey(userId: string): Promise<Buffer | null> {
  const hex = await redis.get(`vault:mdk:${userId}`)
  return hex ? Buffer.from(hex, 'hex') : null
}

export async function clearSessionKey(userId: string) {
  await redis.del(`vault:mdk:${userId}`)
}

// Call on every authenticated request — active users never hit the lock screen
export async function refreshSessionTTL(userId: string) {
  await redis.expire(`vault:mdk:${userId}`, LOCK_TTL)
}
```

**Redis config — persistence must be disabled:**
```
save ""
appendonly no
```

**Auth middleware — sliding TTL:**
```typescript
export async function authMiddleware(req, res, next) {
  const mdk = await getSessionKey(req.user.id)
  if (!mdk) return res.status(423).json({ message: 'Vault Locked' })
  await refreshSessionTTL(req.user.id)  // reset 15min window on every action
  req.mdk = mdk
  next()
}
```

**Session states:**
```
ACTIVE     — JWT valid + MDK in Redis. All operations work.
LOCKED     — JWT valid + MDK not in Redis (15min inactivity).
             App shows security question overlay.
             User answers → MDK back in Redis in ~2s.
LOGGED OUT — JWT invalid. Full password required.
             Only on explicit logout or new device.
```

---

## Auth Flows

**Registration:**
```typescript
async function register(
  email: string,
  password: string,
  securityQuestion: string,
  securityAnswer: string
) {
  const mdk = EncryptionService.generateMDK()

  // Wrapper 1: password
  const passwordSalt        = crypto.randomBytes(32).toString('hex')
  const kek_password        = await EncryptionService.deriveKEK(password, passwordSalt)
  const wrappedMDK_password = EncryptionService.wrapKey(mdk, kek_password)

  // Wrapper 2: security answer — normalize so casing/spacing never matters
  const normalizedAnswer          = securityAnswer.toLowerCase().trim()
  const securityAnswerSalt        = crypto.randomBytes(32).toString('hex')
  const kek_answer                = await EncryptionService.deriveKEK(normalizedAnswer, securityAnswerSalt)
  const wrappedMDK_securityAnswer = EncryptionService.wrapKey(mdk, kek_answer)

  // Wrapper 3: BIP-39 recovery phrase — shown once, never stored
  const recoveryPhrase      = generateBIP39Phrase()
  const recoverySalt        = crypto.randomBytes(32).toString('hex')
  const kek_recovery        = await EncryptionService.deriveKEK(recoveryPhrase, recoverySalt)
  const wrappedMDK_recovery = EncryptionService.wrapKey(mdk, kek_recovery)

  const user = await User.create({
    email,
    passwordHash: await bcrypt.hash(password, 12),
    passwordSalt, wrappedMDK_password,
    securityQuestion,
    securityAnswerSalt, wrappedMDK_securityAnswer,
    recoverySalt, wrappedMDK_recovery,
    encryptionVersion: 3
  })

  await storeSessionKey(user._id.toString(), mdk)
  return { user, recoveryPhrase }  // show phrase once — never store it
}
```

**Login — full password (new device or explicit logout):**
```typescript
async function login(email: string, password: string) {
  const user  = await User.findOne({ email })
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) throw new Error('Invalid credentials')

  const kek = await EncryptionService.deriveKEK(password, user.passwordSalt)
  const mdk = EncryptionService.unwrapKey(user.wrappedMDK_password, kek)

  await storeSessionKey(user._id.toString(), mdk)
  return user
}
```

**System Unlock — security answer (every 15min inactivity):**
```typescript
async function unlock(userId: string, securityAnswer: string) {
  const user = await User.findById(userId)

  if (user.unlockLockedUntil && user.unlockLockedUntil > new Date()) {
    throw new Error('Too many attempts. Try again later.')
  }

  const normalizedAnswer = securityAnswer.toLowerCase().trim()
  const kek = await EncryptionService.deriveKEK(normalizedAnswer, user.securityAnswerSalt)

  let mdk: Buffer
  try {
    mdk = EncryptionService.unwrapKey(user.wrappedMDK_securityAnswer, kek)
  } catch {
    const attempts = (user.unlockAttempts || 0) + 1
    const update: any = { unlockAttempts: attempts }
    if (attempts >= 5) {
      update.unlockLockedUntil = new Date(Date.now() + 30 * 60 * 1000)
      update.unlockAttempts    = 0
    }
    await User.findByIdAndUpdate(userId, update)
    throw new Error('Incorrect answer')
  }

  await User.findByIdAndUpdate(userId, { unlockAttempts: 0, unlockLockedUntil: null })
  await storeSessionKey(userId, mdk)
}
```

**Password Change — instant, zero entries touched:**
```typescript
async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user  = await User.findById(userId)
  const valid = await bcrypt.compare(oldPassword, user.passwordHash)
  if (!valid) throw new Error('Invalid password')

  const oldKek = await EncryptionService.deriveKEK(oldPassword, user.passwordSalt)
  const mdk    = EncryptionService.unwrapKey(user.wrappedMDK_password, oldKek)

  const newSalt             = crypto.randomBytes(32).toString('hex')
  const newKek              = await EncryptionService.deriveKEK(newPassword, newSalt)
  const newWrappedMDK       = EncryptionService.wrapKey(mdk, newKek)

  await User.findByIdAndUpdate(userId, {
    passwordHash:        await bcrypt.hash(newPassword, 12),
    passwordSalt:        newSalt,
    wrappedMDK_password: newWrappedMDK
    // wrappedMDK_securityAnswer — unchanged
    // wrappedMDK_recovery — unchanged
    // All entries — untouched. MDK didn't change.
  })

  await storeSessionKey(userId, mdk)
}
```

**Security Question Change — requires password:**
```typescript
async function changeSecurityQuestion(
  userId: string,
  currentPassword: string,
  newQuestion: string,
  newAnswer: string
) {
  // Password required — prevents attacker who guesses answer from locking out real user
  const user  = await User.findById(userId)
  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) throw new Error('Invalid password')

  const kek = await EncryptionService.deriveKEK(currentPassword, user.passwordSalt)
  const mdk = EncryptionService.unwrapKey(user.wrappedMDK_password, kek)

  const normalizedAnswer     = newAnswer.toLowerCase().trim()
  const newAnswerSalt        = crypto.randomBytes(32).toString('hex')
  const newAnswerKek         = await EncryptionService.deriveKEK(normalizedAnswer, newAnswerSalt)
  const newWrappedMDK_answer = EncryptionService.wrapKey(mdk, newAnswerKek)

  await User.findByIdAndUpdate(userId, {
    securityQuestion:          newQuestion,
    securityAnswerSalt:        newAnswerSalt,
    wrappedMDK_securityAnswer: newWrappedMDK_answer
    // password wrapper — unchanged
    // recovery wrapper — unchanged
  })
}
```

**Recovery — forgot everything:**
```typescript
async function recoverWithPhrase(email: string, recoveryPhrase: string, newPassword: string) {
  const user = await User.findOne({ email })

  const kek = await EncryptionService.deriveKEK(recoveryPhrase, user.recoverySalt)
  const mdk = EncryptionService.unwrapKey(user.wrappedMDK_recovery, kek)

  const newSalt       = crypto.randomBytes(32).toString('hex')
  const newKek        = await EncryptionService.deriveKEK(newPassword, newSalt)
  const newWrappedMDK = EncryptionService.wrapKey(mdk, newKek)

  await User.findByIdAndUpdate(user._id, {
    passwordHash:        await bcrypt.hash(newPassword, 12),
    passwordSalt:        newSalt,
    wrappedMDK_password: newWrappedMDK
    // securityAnswer wrapper — unchanged, still works
    // recovery wrapper — unchanged, same phrase still valid
  })

  await storeSessionKey(user._id.toString(), mdk)
}
```

---

## Entry Service (Phase 1)

```typescript
export class EntryService {

  static async createEntry(userId: string, content: string, source: string) {
    const mdk = await getSessionKey(userId)
    if (!mdk) throw { status: 423, message: 'Vault Locked' }

    const encrypted = EncryptionService.encrypt(content, mdk)

    return Entry.create({
      userId,
      content:        encrypted.content,
      contentIv:      encrypted.iv,
      contentAuthTag: encrypted.authTag,
      source,
      encryptionVersion: 3
    })
  }

  static async getEntry(entryId: string, userId: string) {
    const entry = await Entry.findOne({ _id: entryId, userId })
    if (!entry) throw { status: 404 }

    const mdk = await getSessionKey(userId)
    if (!mdk) throw { status: 423, message: 'Vault Locked' }

    const content = EncryptionService.decrypt({
      content: entry.content, iv: entry.contentIv,
      authTag: entry.contentAuthTag, v: entry.encryptionVersion
    }, mdk)

    return { ...entry.toObject(), content }
  }
}
```

---

## Phase 1 Checklist

- [ ] `EncryptionService` — MDK, KEK derivation, wrap/unwrap, encrypt/decrypt, service key, blind index
- [ ] Generate service key: `openssl rand -hex 32` → `SERVICE_KEY_1` + `CURRENT_SERVICE_KEY_VERSION=1`
- [ ] BIP-39 recovery phrase generator
- [ ] User schema — three wrappers + unlock rate limiting
- [ ] Entry schema — content fields with separate IV/authTag, enrichment placeholders, serviceKeyVersion, searchIndexes
- [ ] KeyRotationState schema
- [ ] Redis with persistence disabled
- [ ] Session service — store, get, clear, refresh TTL
- [ ] Auth middleware — sliding TTL on every request
- [ ] `register` — three wrappers, return recovery phrase once
- [ ] `login` — derive KEK, unwrap MDK, Redis
- [ ] `unlock` — security answer, rate limiting, MDK back in Redis
- [ ] `changePassword` — instant re-wrap, entries untouched
- [ ] `changeSecurityQuestion` — requires password
- [ ] `recoverWithPhrase` — recovery phrase resets password wrapper only
- [ ] `EntryService.createEntry` — MDK encrypt
- [ ] `EntryService.getEntry` — MDK decrypt
- [ ] Unit tests: all three wrappers unwrap the same MDK
- [ ] Unit tests: encrypt/decrypt round-trip
- [ ] Unit tests: Argon2id derivation is deterministic across restarts
- [ ] Unit tests: wrong answer fails unwrap
- [ ] Unit tests: rate limiting locks after 5 attempts

---

---

# Phase 2 — Enrichment Pipeline

**What it delivers:** AI enrichment runs in background after every entry. Emotions, themes, people, patterns extracted and stored encrypted. PII stripped before anything leaves the server. ZDR active. Weekly reports generate automatically without user being logged in.

**Publishable state:** Entries automatically tagged. Mental model starts building. Reports generate and deliver via WhatsApp. Users see their first insights.

**Dependency:** Phase 1 complete.

---

## PII Service

**`src/services/pii.service.ts`**

```typescript
export class PIIService {

  static tokenize(text: string): { tokenized: string; tokenMap: Record<string, string> } {
    const tokenMap: Record<string, string> = {}
    let counter = 1
    let result  = text

    // Proper noun detection — upgrade to wink-nlp for production accuracy
    const namePattern = /(?<![.!?]\s)(?<!\n)\b([A-Z][a-z]{2,})\b/g

    result = result.replace(namePattern, (match) => {
      const existing = Object.entries(tokenMap).find(([, v]) => v === match)
      if (existing) return existing[0]
      const token = `[P${counter++}]`
      tokenMap[token] = match
      return token
    })

    return { tokenized: result, tokenMap }
  }

  static detokenize(text: string, tokenMap: Record<string, string>): string {
    return Object.entries(tokenMap).reduce(
      (result, [token, name]) => result.replaceAll(token, name),
      text
    )
  }
}
```

---

## Enrichment Worker

**`src/workers/enrichment.worker.ts`**

```typescript
const ENRICHMENT_SYSTEM_PROMPT = `
You are a precise psychological data extractor.
Return ONLY valid JSON. No prose. No markdown.
If uncertain, lower confidence — do NOT hallucinate.

emotions: only from [frustrated, anxious, sad, angry, hurt, hopeful, excited,
  grateful, proud, calm, confused, overwhelmed, determined, lonely, content,
  guilty, relieved, fearful, disgusted, neutral]
themes: only from [ambition, relationships, identity, work, finances, health,
  family, time, control, meaning, social, learning] — max 3
people: only names explicitly mentioned — do NOT infer
sentiment_score: -1.0 to 1.0
confidence: 0.0 to 1.0
`

const worker = new Worker('enrichment', async (job) => {
  const { entryId, userId, content } = job.data

  // Step 1: PII tokenization — real names never leave server
  const { tokenized, tokenMap } = PIIService.tokenize(content)

  // Step 2: LLM extraction (ZDR enabled)
  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 800,
    system:     ENRICHMENT_SYSTEM_PROMPT,
    messages:   [{ role: 'user', content: tokenized }]
  })

  let extracted = JSON.parse(response.content[0].text)

  // Step 3: Restore real names
  extracted.people = extracted.people?.map(p => ({
    ...p,
    name: PIIService.detokenize(p.name, tokenMap)
  }))

  // Step 4: Generate embedding for semantic search — stored inside enrichments
  const embeddingRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: tokenized  // PII already stripped
  })
  extracted.embedding = embeddingRes.data[0].embedding

  // Step 5: Encrypt with service key — no MDK needed, background job runs freely
  const encrypted = EncryptionService.encryptEnrichment(extracted)

  // Step 6: Store
  await Entry.findByIdAndUpdate(entryId, {
    enrichments:        encrypted.content,
    enrichmentsIv:      encrypted.iv,
    enrichmentsAuthTag: encrypted.authTag,
    serviceKeyVersion:  encrypted.serviceKeyVersion,
    enriched:           true,
    enrichedAt:         new Date()
  })

  // Step 7: Trigger downstream
  await graphQueue.add('update-graph', { entryId, userId })
  if (extracted.sentimentScore < -0.7) {
    await surfacingQueue.add('event-trigger', { entryId, userId })
  }

}, { connection: redisConnection, concurrency: 10 })
```

---

## Updated Entry Service

```typescript
static async getEntry(entryId: string, userId: string) {
  const entry = await Entry.findOne({ _id: entryId, userId })
  if (!entry) throw { status: 404 }

  const mdk = await getSessionKey(userId)
  if (!mdk) throw { status: 423, message: 'Vault Locked' }

  // Raw content — MDK
  const content = EncryptionService.decrypt({
    content: entry.content, iv: entry.contentIv,
    authTag: entry.contentAuthTag, v: entry.encryptionVersion
  }, mdk)

  // Enrichments — service key, no MDK needed
  let enrichments = null
  if (entry.enrichments) {
    enrichments = EncryptionService.decryptEnrichment({
      content: entry.enrichments, iv: entry.enrichmentsIv,
      authTag: entry.enrichmentsAuthTag, v: entry.encryptionVersion,
      serviceKeyVersion: entry.serviceKeyVersion
    })
  }

  return { ...entry.toObject(), content, enrichments }
}
```

**Weekly reports — no session required:**
```typescript
async function generateWeeklyReports() {
  const users = await User.find({ active: true })
  for (const user of users) {
    // Service key decrypts enrichments — no MDK, no session dependency
    const entries    = await Entry.find({ userId: user._id, enriched: true })
    const enrichments = entries.map(e => EncryptionService.decryptEnrichment({
      content: e.enrichments, iv: e.enrichmentsIv,
      authTag: e.enrichmentsAuthTag, v: e.encryptionVersion,
      serviceKeyVersion: e.serviceKeyVersion
    }))
    const report = await buildReport(enrichments)
    await sendWhatsAppReport(user.phone, report)
  }
}
```

---

## Phase 2 Checklist

- [ ] Sign ZDR agreements — Anthropic and OpenAI. Before any real user data touches these APIs.
- [ ] `PIIService` — tokenize and detokenize
- [ ] Enrichment BullMQ worker — PII strip, LLM call, embedding, service key encrypt, store
- [ ] Embedding stored inside enrichments JSON — not a separate field
- [ ] Update `EntryService.getEntry` — service key decrypt enrichments
- [ ] Update `EntryService.createEntry` — push to enrichment queue after save
- [ ] Verify: plaintext content not persisted in BullMQ job data after enrichment
- [ ] Weekly report background job — service key only, no session required
- [ ] Test: enrichment worker runs and stores correctly without active user session
- [ ] Test: weekly report generates for a user who has been logged out for 3 days

---

---

# Phase 3 — Search

**What it delivers:** Syntactic (exact word) and semantic (meaning) search on encrypted data. Both work correctly. Semantic search works even when user is not logged in.

**Publishable state:** Users can search their entries. Find by word. Find by concept.

**Dependency:** Phase 1 (syntactic). Phase 1 + 2 (semantic — needs embeddings from enrichment).

---

## Tokenizer — N-gram with Smart Scoping

Whole-word indexing only supports exact matches — "ahm" would never find "ahmad." To support prefix/partial search, we generate n-grams, but only for names and short words (≤8 chars), not long common words like "disappointment." This keeps index size at ~1.4x whole-word-only instead of ~2.2x.

**Why this boundary:**
- Names are typically 3-8 characters — exactly where partial search matters most
- Users searching "ahm" want "ahmad", not "ah" of "ahead"
- Long words (>8 chars) are rarely searched partially — users type "frustrat" not "fru"
- Capitalized words in original text are almost certainly names — n-gram those regardless of length

**Index size at scale:**
```
Per entry (~150 words, ~80 meaningful after filtering):
  Whole-word only:     ~80 hashes
  N-gram smart:       ~112 hashes  (+1.4x)
  N-gram all words:   ~180 hashes  (+2.2x)

At 1,000 users × 1,000 entries:
  Smart n-gram: ~7GB index storage — acceptable
  Revisit at this scale: consider Typesense or Meilisearch
```

```typescript
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'are', 'was',
  'its', 'but', 'not', 'have', 'had', 'been', 'from', 'they'
])

/**
 * Generates prefix n-grams for a word.
 * "ahmad" → ["ahm", "ahma", "ahmad"]
 * Minimum prefix length: 3
 */
function generateNgrams(word: string): string[] {
  if (word.length < 3) return []
  const ngrams: string[] = []
  for (let i = 3; i <= word.length; i++) {
    ngrams.push(word.slice(0, i))
  }
  return ngrams
}

/**
 * Tokenizes content for blind index generation.
 *
 * N-grams generated for:
 *   - Words capitalized in original text (likely names)
 *   - Words ≤ 8 characters (likely names or short common words)
 *
 * Full word only for:
 *   - Long common words — "disappointment", "understanding", etc.
 *
 * CRITICAL: Must be called identically at write time and search time.
 * Same word must produce same tokens → same hashes → matches in MongoDB.
 */
function tokenizeForIndex(content: string): string[] {
  // Track which words were capitalized in original — these are names
  const capitalizedInOriginal = new Set(
    (content.match(/\b[A-Z][a-z]{2,}\b/g) || []).map(w => w.toLowerCase())
  )

  const words = content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .filter(w => !STOP_WORDS.has(w))

  const allTokens = new Set<string>()

  for (const word of words) {
    // Always add the full word
    allTokens.add(word)

    // Add n-grams only for names and short words
    const isName  = capitalizedInOriginal.has(word)
    const isShort = word.length <= 8

    if (isName || isShort) {
      generateNgrams(word).forEach(ng => allTokens.add(ng))
    }
  }

  return [...allTokens]
}
```

---

## Syntactic Search — Blind Index

Requires active session — MDK needed to generate the query hash.

**On entry save — in `createEntry`:**
```typescript
const tokens        = tokenizeForIndex(plaintext)  // n-grams included
const searchIndexes = [...new Set(
  tokens.map(t => EncryptionService.generateBlindIndex(t, mdk))
)]
// stored in entry.searchIndexes
```

**Search query:**
```typescript
async function syntacticSearch(userId: string, query: string) {
  const mdk = await getSessionKey(userId)
  if (!mdk) throw { status: 423, message: 'Vault Locked' }

  // Same tokenizer as write time — prefix n-grams included
  // "ahm" tokenizes to ["ahm"] → hashes to same value as stored prefix hash
  const hashes = tokenizeForIndex(query)
    .map(t => EncryptionService.generateBlindIndex(t, mdk))

  return Entry.find({
    userId,
    searchIndexes: { $all: hashes }  // AND — all tokens must match
  }).sort({ createdAt: -1 })
}
```

**Search behavior:**
```
"ahm"       → ["ahm"]              → finds "ahmad", "ahmed", "ahmer"
"ahmed"     → ["ahm","ahme","ahmed"] → same results, progressively more precise
"ahmed f"   → all ahmed tokens + "f" tokens → AND logic, very targeted
```

---

## Semantic Search — Encrypted Embeddings

No session required — service key handles everything.

```typescript
async function semanticSearch(userId: string, query: string) {
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  })

  const entries = await Entry.find({ userId, enriched: true })

  const results = entries
    .map(entry => {
      const enrichments = EncryptionService.decryptEnrichment({
        content: entry.enrichments, iv: entry.enrichmentsIv,
        authTag: entry.enrichmentsAuthTag, v: entry.encryptionVersion,
        serviceKeyVersion: entry.serviceKeyVersion
      }) as any

      if (!enrichments.embedding) return null

      return {
        entryId:    entry._id,
        similarity: cosineSimilarity(queryEmbedding.data[0].embedding, enrichments.embedding)
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 10)

  return results
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot  = a.reduce((sum, val, i) => sum + val * b[i], 0)
  const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0))
  const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0))
  return dot / (magA * magB)
}
```

---

## Phase 3 Checklist

- [ ] `generateNgrams` — prefix n-grams from length 3 to word length
- [ ] `tokenizeForIndex` — n-grams for names (capitalized) and short words (≤8 chars), full word for everything else
- [ ] Verify tokenizer called identically at write time and search time — same function, zero divergence
- [ ] Update `EntryService.createEntry` — generate and store blind indexes using n-gram tokenizer
- [ ] `syntacticSearch` — blind index AND query, requires active session
- [ ] `semanticSearch` — service key, cosine similarity in memory, no session required
- [ ] Test: "ahm" finds entries containing "ahmad" or "ahmed"
- [ ] Test: "ahmed" finds "ahmed" (full word still works)
- [ ] Test: "ahmed frustrated" AND logic — only entries with both
- [ ] Test: semantic finds conceptually related entries without exact word match
- [ ] Test: semantic works when vault is locked
- [ ] Test: index size per entry within expected range (~112 hashes for 150-word entry)
- [ ] Monitor: alert if `searchIndexes` array length consistently >300 per entry

---

---

# Phase 4 — Hardening

**What it delivers:** Key rotation for MDK and SERVICE_KEY. Full audit. Data export. Permanent deletion. The system handles all failure modes.

**Publishable state:** Production-ready. All edge cases handled. Can confidently onboard real users and make honest privacy promises.

**Dependency:** Phases 1–3 complete.

---

## MDK Rotation Worker

Nuclear option. Only if MDK is suspected compromised.

```typescript
const mdkRotationWorker = new Worker('mdk-rotation', async (job) => {
  const { userId, oldMDKHex, newMDKHex, newWrappedMDK, rotationId } = job.data
  const oldMDK = Buffer.from(oldMDKHex, 'hex')
  const newMDK = Buffer.from(newMDKHex, 'hex')

  let skip = 0
  while (true) {
    const entries = await Entry.find({ userId }).skip(skip).limit(50)
    if (!entries.length) break

    const ops = entries.map(entry => {
      // Re-encrypt raw content with new MDK
      const plaintext   = EncryptionService.decrypt(
        { content: entry.content, iv: entry.contentIv, authTag: entry.contentAuthTag, v: 3 },
        oldMDK
      )
      const reencrypted = EncryptionService.encrypt(plaintext, newMDK)

      // Regenerate blind indexes with new MDK
      const searchIndexes = [...new Set(
        tokenizeForIndex(plaintext).map(t => EncryptionService.generateBlindIndex(t, newMDK))
      )]

      return {
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: {
            content:        reencrypted.content,
            contentIv:      reencrypted.iv,
            contentAuthTag: reencrypted.authTag,
            searchIndexes
            // enrichments untouched — service key, not MDK
          }}
        }
      }
    })

    await Entry.bulkWrite(ops)
    await KeyRotationState.findByIdAndUpdate(rotationId, { $inc: { processedCount: ops.length } })
    skip += 50
    await new Promise(r => setTimeout(r, 100))
  }

  // Commit only after 100% complete — rollback still possible until this point
  await User.findByIdAndUpdate(userId, { wrappedMDK_password: newWrappedMDK })
  await KeyRotationState.findByIdAndUpdate(rotationId, { status: 'COMPLETED', completedAt: new Date() })
})
```

---

## SERVICE_KEY Rotation Worker

Triggered on suspected SERVICE_KEY leak. Re-encrypts all enrichments across all users.

```typescript
// Before running:
// 1. Add SERVICE_KEY_2 to env (keep SERVICE_KEY_1)
// 2. Set CURRENT_SERVICE_KEY_VERSION=2
// New enrichments immediately use v2. Worker migrates v1 → v2 in background.

const serviceKeyRotationWorker = new Worker('service-key-rotation', async (job) => {
  const { oldVersion, newVersion, rotationId } = job.data
  const { key: oldKey } = EncryptionService.getServiceKey(oldVersion)
  const { key: newKey } = EncryptionService.getServiceKey(newVersion)

  let skip = 0
  while (true) {
    const entries = await Entry.find({
      enriched: true, serviceKeyVersion: oldVersion
    }).skip(skip).limit(100)

    if (!entries.length) break

    const ops = entries.map(entry => {
      const plain       = EncryptionService.decrypt(
        { content: entry.enrichments, iv: entry.enrichmentsIv,
          authTag: entry.enrichmentsAuthTag, v: entry.encryptionVersion },
        oldKey
      )
      const reencrypted = EncryptionService.encrypt(plain, newKey)

      return {
        updateOne: {
          filter: { _id: entry._id },
          update: { $set: {
            enrichments:        reencrypted.content,
            enrichmentsIv:      reencrypted.iv,
            enrichmentsAuthTag: reencrypted.authTag,
            serviceKeyVersion:  newVersion
          }}
        }
      }
    })

    await Entry.bulkWrite(ops)
    await KeyRotationState.findByIdAndUpdate(rotationId, { $inc: { processedCount: ops.length } })
    skip += 100
    await new Promise(r => setTimeout(r, 50))
  }

  await KeyRotationState.findByIdAndUpdate(rotationId, { status: 'COMPLETED', completedAt: new Date() })
  // Only now safe to remove SERVICE_KEY_{oldVersion} from env
})
```

**Rotation runbook on suspected leak:**
```
1. openssl rand -hex 32 → new key value
2. Add SERVICE_KEY_2 to env (keep SERVICE_KEY_1)
3. Set CURRENT_SERVICE_KEY_VERSION=2 → deploy
4. New enrichments now use v2 immediately
5. Start rotation worker for v1 → v2
6. Monitor KeyRotationState until COMPLETED
7. Remove SERVICE_KEY_1 from env → deploy
```

---

## Phase 4 Checklist

- [ ] MDK rotation worker — create state → process batches → commit only at 100%
- [ ] SERVICE_KEY rotation worker — migrate all enrichments across all users
- [ ] Test SERVICE_KEY rotation end-to-end on dev data
- [ ] Write and store SERVICE_KEY rotation runbook
- [ ] Full audit: no plaintext entry content in application logs
- [ ] Full audit: no plaintext content persisted in BullMQ job data
- [ ] Verify Redis persistence disabled in production
- [ ] Full data export — decrypt everything, package cleanly, deliver to user
- [ ] Full data deletion — entries, enrichments, user doc, rotation states, Redis key
- [ ] Test deletion: nothing decryptable remains after delete

---

---

## Non-Negotiable Rules

1. **MDK never touches the database in plaintext.**
2. **User password never touches the database.** bcrypt only.
3. **Redis persistence disabled.** Keys are memory-only.
4. **Raw entries encrypted with MDK only.** Service key never touches raw content.
5. **Enrichments encrypted with service key.** Not MDK.
6. **Content and enrichments have separate IVs and authTags.** Never shared.
7. **Wrapped keys versioned.** Field `v` on every wrapped key JSON.
8. **Blind indexes derived from MDK.** Syntactic search requires active session.
9. **Semantic search and background jobs use service key.** No session dependency.
10. **PII tokenization before every LLM call.** No exceptions.
11. **ZDR enabled before first real user.** Sign agreements first.
12. **MDK rotation preserves enrichments.** Only raw content and search indexes re-encrypted.
13. **Rotation state created before rotation starts.** Old key preserved until COMPLETED.
14. **Decryption in service layer only.** Never in routes or models.
15. **Recovery phrase shown once, never stored.**
16. **SERVICE_KEY is versioned.** Always `SERVICE_KEY_{n}`.
17. **Old SERVICE_KEY kept until rotation COMPLETED.**
18. **serviceKeyVersion on every enriched entry.**
19. **On SERVICE_KEY leak: bump version immediately.** New enrichments safe while worker migrates old.
20. **Security answer change requires password.**
21. **Normalize security answers.** `answer.toLowerCase().trim()` before derivation.
22. **Three wrappers, one MDK.** Changing one never affects the others.

---

## Migration Path — Future Phases

```
Phases 1–4 (now, 0–1,000 users):
  Raw entries    → MDK (user-owned)
  Enrichments    → Service key (server-operable)
  enrichmentKeyType: 'service'

Phase 5 (at 1,000 users, if stronger privacy needed):
  Enrichments → split key (UKS XOR SKS)
  enrichmentKeyType: 'split'
  No raw entry schema changes. Background jobs need 72hr UKS window.

Phase 6 (long term):
  Client-side unwrap. On-device LLM. Full zero-knowledge.
```

The `enrichmentKeyType` field makes migration explicit, trackable, and reversible.

---

## What You Tell Users

```
What we cannot read: your journal entries.
Your words are encrypted with your password.
We have no key and no access.

What we can process: the patterns and insights derived
from your entries — emotions, themes, people, relationships.
We use these to power your reports, search, and intelligence layer.

You can export or delete everything permanently at any time.
Deletion is complete and irreversible.

If we receive a legal request, we hand over encrypted data.
Your journal entries are unreadable without your password,
which we do not have.
```

---

*v3.2 — Four independent publishable phases: (1) Vault + Auth, (2) Enrichment Pipeline, (3) Search, (4) Hardening. Each phase ships value independently. Full system complete at Phase 4.*