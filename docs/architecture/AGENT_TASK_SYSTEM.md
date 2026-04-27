# Agent Task System Architecture (System 2)

This document provides an **exhaustive, granular technical blueprint** of the Agent Task System. This system is designed to handle high-fidelity background processing, long-running agentic workflows, and persistent task auditing with real-time feedback.

---

## 1. System Vision & Philosophy
The system follows a **Database-First Asynchronous Pattern**. Every "Job" is a "Task" in the database first. This ensures:
- **Persistence:** No job is ever "lost" in a queue; the state is always in MongoDB.
- **Auditability:** A permanent history of every agent action, token cost, and outcome.
- **Transparency:** Real-time visibility into what the agent is "thinking" or "doing" via sub-step emissions.

---

## 2. Granular Data Model (`IAgentTask`)

The core of the system is the `AgentTask` model. It acts as the "Source of Truth" for the entire lifecycle.

### Schema Definition
| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | `ObjectId` | Owner of the task. |
| `type` | `AgentTaskType` | The specific strategy/workflow to execute. |
| `status` | `AgentTaskStatus` | PENDING, RUNNING, COMPLETED, FAILED, CANCELLED. |
| `inputData` | `Object (Mixed)` | Strictly typed inputs for the specific workflow. |
| `outputData` | `Object (Mixed)` | Strictly typed results/returns from the workflow. |
| `currentStep` | `String` | Human-readable current operation (e.g., "Indexing..."). |
| `priority` | `Number` | 1 (High) to 10 (Low). Maps to BullMQ job priority. |
| `stats` | `Object (Mixed)` | Granular metrics: `tokens`, `stepsCount`, `itemsProcessed`. |
| `error` | `String` | Detailed failure reason if status is FAILED. |
| `startedAt` | `Date` | Timestamp when the worker picked up the task. |
| `completedAt`| `Date` | Timestamp when the task reached a terminal state. |

---

## 3. Workflow Catalog (The Complete List)

Each workflow implements the `IAgentWorkflow` interface and handles a specific `AgentTaskType`.

### 3.1. Weekly Analysis (`WEEKLY_ANALYSIS`)
*   **Purpose:** Deep synthesis of the user's last 7 days.
*   **Trigger:** Automated (Sundays) or User-initiated.
*   **Input Schema:** `{ startDate?: Date; endDate?: Date }`
*   **Output Schema (`WeeklyAnalysisOutput`):**
    ```typescript
    {
      headline: string;
      periodNarrative: string;
      alignmentScore: number; // 1-100
      energyArc: "ascending" | "descending" | "volatile" | "flat";
      moodInsight: { dominantState: string; peakDay: string; lowestDay: string; triggerPattern: string; correlation: string; };
      patterns: Array<{ observation: string; implication: string; confidence: string; }>;
      singleBestBet: string;
      specificMicroAction: string;
      stats: { totalEntries: number; totalWords: number; avgMoodScore: number; topTags: string[]; moodTimeSeries: number[]; };
    }
    ```
*   **Process:** `Build Context (Entries, Mood, Entities, Persona)` → `LLM Synthesis` → `Final Report Generation`.

### 3.2. Monthly Analysis (`MONTHLY_ANALYSIS`)
*   **Purpose:** Narrative synthesis of the last 30 days.
*   **Trigger:** Automated (1st of month) or User-initiated.
*   **Input Schema:** `{ month?: number; year?: number; startDate?: Date; endDate?: Date }`
*   **Output Schema (`MonthlyAnalysisOutput`):**
    ```typescript
    {
      headline: string;
      moodStory: string;
      topAccomplishment: string;
      hardTruths: string[];
      growthVector: string;
      nextMonthContract: string;
      stats: { entriesCount: number; moodAverage: number; wordCount: number; focusTags: string[]; };
    }
    ```
*   **Process:** `Build Monthly Context` → `Analyze Patterns` → `Synthesize Growth Vector` → `Create Final Report`.

### 3.3. Persona Synthesis (`PERSONA_SYNTHESIS`)
*   **Purpose:** Updating the "Living Persona" document (Source of Truth for User Identity).
*   **Trigger:** Automated (after 10+ messages) or User-initiated.
*   **Input Schema:** `{ force?: boolean }`
*   **Output Schema:** `{ summary: string; rawMarkdown: string; }`
*   **Process:** `Fetch last 100 entries + Existing Persona` → `LLM Evolution Analysis` → `Update UserPersona Collection`.

### 3.4. Memory Flush (`MEMORY_FLUSH`)
*   **Purpose:** Moving short-term chat context into long-term graph/persona storage.
*   **Trigger:** Automated (when history >= 20 messages).
*   **Input Schema:** `{ count?: number }` (Default: 10)
*   **Output Schema:** `{ flushedCount: number; observationsFound: number; }`
*   **Process:** `Fetch chat chunk` → `Extract Observations/Associations` → `Update Persona/Entities/Graph` → `LTRIM Redis History`.

### 3.5. Cognitive Consolidation (`COGNITIVE_CONSOLIDATION`)
*   **Purpose:** Specialized persona update focusing on psychological style and tone.
*   **Trigger:** Often runs alongside Memory Flush.
*   **Input Schema:** `{ messageCount?: number }`
*   **Output Schema:** `{ messagesAnalyzed: number; factsFound: number; }`
*   **Process:** `Analyze Tone/Style Shifts` → `Detect Persona Evolution` → `Update Persona Markdown`.

### 3.6. Entity Consolidation (`ENTITY_CONSOLIDATION`)
*   **Purpose:** Synthesizing raw observation logs for a specific Person/Place/Project.
*   **Trigger:** Automated (when Entity's rawMarkdown > 2000 chars).
*   **Input Schema:** `{ entityId: string; userId: string; }`
*   **Output Schema:** `{ previousSize: number; newSize: number; entityName: string; }`
*   **Process:** `Fetch Entity Raw Log` → `Eliminate Redundancy` → `Synthesize Structured Narrative`.

### 3.7. Retroactive Linking (`RETROACTIVE_LINKING`)
*   **Purpose:** Finding historical mentions of a newly created or updated entity.
*   **Trigger:** Automated (after Entity creation/renaming).
*   **Input Schema:** `{ entityId: string; userId: string; name: string; aliases?: string[]; }`
*   **Output Schema:** `{ linkedCount: number; }`
*   **Process:** `Build Regex for Name/Aliases` → `Search Entries Collection` → `Create Graph Mention Edges`.

### 3.8. Web Activity Summary (`WEB_ACTIVITY_SUMMARY`)
*   **Purpose:** Generating a reflective journal entry from passive tracking data.
*   **Trigger:** Daily Background Job (01:00 AM).
*   **Input Schema:** `{ date: string; }` (YYYY-MM-DD)
*   **Output Schema:** `{ summaryCreated: boolean; }`
*   **Process:** `Fetch Domain Stats + Passive Sessions` → `Calculate Focus/Distraction Balance` → `Create Journal Entry (type: TEXT)`.

### 3.9. Sync Workflow (`SYNC`)
*   **Purpose:** Batch processing legacy/unprocessed entries.
*   **Trigger:** Manual Maintenance or System Recovery.
*   **Input Schema:** `{ entryId?: string; }`
*   **Output Schema:** `{ processed: number; remaining: number; }`
*   **Process:** `Scan Entries with status != COMPLETED` → `Enqueue for Enrichment (System 1)`.

---

## 4. Execution Pipeline & Worker Logic

### 4.1. Initiation (AgentService)
1.  **DB Save:** `AgentTask.create({ ...status: PENDING })`.
2.  **Queue Add:** `queue.add(type, { taskId })` with priority matching the task.
3.  **UI Sync:** Emit `AGENT_TASK_UPDATED` via Socket.IO.

### 4.2. Processing (AgentWorker)
1.  **Hydration:** Fetch `AgentTask` document.
2.  **Status Update:** Set to `RUNNING`, mark `startedAt`.
3.  **Abort Setup:** Create `AbortController`, store in `activeControllers` map (indexed by `taskId`).
4.  **Execute:** Call `workflow.execute(task, emitProgress, signal)`.

### 4.3. Progress Emission (`emitProgress`)
Workflows call `emitProgress(stepName, metadata)`.
- Updates `task.currentStep` and merges `metadata` into `task.stats`.
- Saves to DB.
- Emits `AGENT_TASK_UPDATED` to user.

### 4.4. Termination
- **Success:** Call `finalizeTask()` → `status: COMPLETED`,

## 6. System A Integration & Migration Blueprint

The system is designed to absorb the legacy **Enrichment** and **Media Processing** workflows (System 1) into the unified `IAgentTask` model.

### 6.1. Task Type: `ENRICHMENT`
*   **Legacy Model:** `EnrichmentJobData`
*   **System 2 Schema:**
    *   **Input:** `{ entryId: string; userId: string; signalTier: SignalTier; }`
    *   **Output:** `IEnrichmentResult` (Themes, Emotions, Entities, Narrative).
*   **Process Mapping:**
    1.  `FETCH_CONTENT`: Pull raw entry text/metadata.
    2.  `CLASSIFY_INTENT`: Determine if it's a "Life Event", "Thought", or "Passive Log".
    3.  `LLM_ENRICH`: Run the legacy `EnrichmentInterpreter` logic.
    4.  `UPDATE_ENTRY`: Save the `metadata` and `narrative` back to the `Entry` document.
*   **Stats to Track:** `tokensUsed`, `sentimentScore`, `entitiesExtracted`.

### 6.2. Task Type: `MEDIA_PROCESSING`
*   **Legacy Model:** `MediaJobData`
*   **System 2 Schema:**
    *   **Input:** `{ mediaId: string; jobType: MediaJobType; options?: object; }`
    *   **Output:** Updated `IMedia` document with `metadata` (OCR, AI Tags, Summary).
*   **Process Mapping:**
    1.  `DOWNLOAD`: Fetch buffer from Cloudinary/S3.
    2.  `TRANSCODE/EXTRACT`: Run ffmpeg/sharp for thumbnails or transcoding.
    3.  `AI_ANALYZE`: Run OCR (Tesseract/Google) or Vision models.
    4.  `FINALIZE`: Update `Media` status to `COMPLETED`.
*   **Stats to Track:** `fileSizeProcessed`, `durationMs`, `ocrConfidence`.

### 6.3. Queue Topology (Resource Isolation)
To prevent heavy analysis jobs from blocking real-time enrichment, the system uses **Namespaced BullMQ Queues**:

| Queue Name | Purpose | Concurrency | Priority Level |
| :--- | :--- | :--- | :--- |
| `agent-tasks:fast` | Enrichment, Sync, Reminders. | 20 | 1-3 |
| `agent-tasks:media` | Audio/Video processing, OCR. | 5 | 5 |
| `agent-tasks:heavy` | Weekly/Monthly analysis, Persona synthesis. | 2 | 10 |

**Implementation Rule:** The `AgentWorker` can be instantiated multiple times, each listening to a specific namespace or filtering by `AgentTaskType`.

---

## 7. Resilience & Optimization

### 7.1. Cancellation Handling
If `agentService.cancelTask(taskId)` is called:
1.  **Queue Removal:** BullMQ Job is removed (if still in PENDING).
2.  **Signal Propagation:** `AbortController.abort()` is called (if RUNNING).
3.  **LLM Halt:** `LLMService` (if using signal) stops token generation immediately.
4.  **Terminal State:** Task marked `CANCELLED`.

### 7.2. Data Retention (No-Bloat Policy)
The `AgentTask` collection uses a **30-day TTL index** on the `completedAt` field.
- **Enrichment/Sync:** Automatically purged after 30 days to keep the collection lean.
- **Analyses:** Can be marked `persistent: true` to bypass TTL if they serve as the primary source for the UI Reports.

### 7.3. Real-time Observability
Every task update emits a `AGENT_TASK_UPDATED` socket event. The UI "Stats Table" should consume this to show:
- Progress percentage (calculated by `stats.stepsCount / expectedSteps`).
- Current human-readable status.
- Real-time token/cost accumulation.
