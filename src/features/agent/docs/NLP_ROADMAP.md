# Agentic NLP Architecture: The "Chief of Staff" Model

This roadmap outlines the evolution of our agent from a simple "Task Runner" to a proactive "Chief of Staff" that understands context, verifies its own work, and sees the big picture.

## The Vision: The End State
Imagine a system that doesn't just "save notes" but **understands your life**.
- You say: *"I'm feeling super drained from the marathon training."*
- Agent (Smart): *"I noticed you mentioned 'drained' a lot this week. This aligns with your goal 'Run a Marathon', but maybe we need to adjust your recovery plan? I've logged this as a Health entry."*

It listens, understands intent, remembers history, and double-checks its own accuracy.

---

## The 6 Core Pillars

### 1. The Intent Router (The Front Desk)
The single entry point for all user input. It stops us from hardcoding "API endpoints" for every feature.
- **Input**: Natural Language ("Add meeting with Bob", "How is my mood?", "Just journaling...")
- **Role**: Classifies intent -> Routes to specific workflow.
- **Why**: Allows a single "Magic Input" bar in the UI.

### 2. Enhanced Parsing (The Scribe)
Before data hits the DB, it enters a standardization layer.
- **Role**:
    - Converts "next Friday" -> `2024-XX-XX`.
    - Merges "Bob" and "Robert" -> `PersonID: 123`.
- **Why**: Clean data allows for better analytics later.

### 3. Dynamic Tool Use / ReAct (The Worker)
Instead of linear scripts, the agent creates its own plan.
- **Logic**: "I need to answer a question. Do I have the data? No. -> Tool: `search_entries`. -> Got data. -> Tool: `summarize`. -> Final Answer."
- **Why**: Handles complex, multi-step user requests flexibly.

### 4. Conversational History (The Memory)
The agent remembers the current conversation session.
- **Mechanism**: Redis-backed short-term memory.
- **Capability**: Handles follow-up questions ("What did I say about *that*?").
- **Why**: Makes the interaction feel human and fluid, not robotic.

### 5. The Critic Loop (The Editor / Self-Correction)
**Problem**: LLMs hallucinate or miss details in long texts.
**Solution**: A "QA" step before saving.
- **Step 1 (Draft)**: Agent extracts data.
- **Step 2 (Critique)**: A second, cheaper/faster prompt reads the Original Text + Draft.
    - *Prompt*: "Check against the source text. Did we miss anything important? Did we invent anything?"
- **Step 3 (Refine)**: If the Critic rejects, the Agent auto-corrects.

### 6. Longitudinal Analysis (The Strategist)
**Problem**: Daily entries are isolated dots. We need to connect them.
**Solution**: Context injection during analysis.
- **Mechanism**: When running a "Daily Reflection" or "Insight" job:
    1. Fetch active **Life Goals**.
    2. Fetch **Last 7 Days** of journal summaries.
    3. **Prompt**: "Analyze today's entry in the context of these Goals and recent events."
- **Why**: Moves from "You are sad today" to "You are sad because you've neglected your 'Work-Life Balance' goal for 5 days in a row."

---

## Implementation Sequence

1.  **Phase 1: Router & Memory** [IMPLEMENTED]
    - Built `AgentIntentClassifier` with Journal, Reminder, Goal, Query intents.
    - Set up `AgentService` to direct-route commands to respective services.
    - Redis memory is active (via `agent.memory.ts`).
2.  **Phase 2: The Critic**
    - Update `BrainDump` workflow to include the validation step.
3.  **Phase 3: Deep Context (Longitudinal)**
    - Update `Reflection` workflow to fetch Goals + History before generating insights.
