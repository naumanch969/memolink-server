# Proposal: Unified Task Orchestration (UTO)

## 1. The Core Problem
Currently, the codebase split between "Agent Tasks" (Database-backed) and "System Jobs" (Queue-only) creates:
1. **Cognitive Load**: Developers must choose between two different patterns.
2. **Observability Gaps**: System jobs (Enrichment/Media) are hard to track for the end-user.
3. **Redundant Workers**: Multiple worker initializations for very similar logic.

## 2. Proposed Architecture: The "Task" Abstraction

Move from `AgentTask` to a generic `Task` model that handles **Persistence** as a configuration.

### A. The Unified Task Schema
```typescript
interface ITask {
  type: string;        // e.g., 'WEEKLY_ANALYSIS', 'MEDIA_TRANSCRIPTION'
  category: string;    // 'BRAIN', 'MUSCLE', 'INFRA'
  status: TaskStatus;
  
  // Metadata Configuration
  config: {
    isPersistent: boolean; // If true, saved to Mongo for user history
    isUserFacing: boolean; // If true, emits Socket.io updates to the UI
    retryLimit: number;
  };

  inputData: any;
  outputData: any;
  error?: string;
  
  // Tracking
  userId: Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
}
```

### B. The Task Registry (`src/core/tasks/registry.ts`)
Instead of multiple workers, we have one **Task Orchestrator** that routes to the correct handler.

```typescript
// Unified registration for EVERY background action
TaskRegistry.register({
  type: 'WEEKLY_ANALYSIS',
  category: 'BRAIN',
  persistent: true,
  handler: weeklyAnalysisWorkflow
});

TaskRegistry.register({
  type: 'MEDIA_TRANSCRIPTION',
  category: 'MUSCLE',
  persistent: false, // Ephemeral by default
  handler: audioProcessor
});
```

### C. The Dispatcher Service (`src/core/tasks/task.service.ts`)
```typescript
class TaskService {
  async dispatch(type: string, data: any, userId: string) {
    const config = TaskRegistry.get(type);
    
    // 1. Create DB Record if persistent
    let taskId = null;
    if (config.persistent) {
      const task = await Task.create({ type, userId, status: 'PENDING' });
      taskId = task._id;
    }

    // 2. Add to BullMQ with universal metadata
    await queue.add(type, { taskId, data, userId });
  }
}
```

## 3. Projected Benefits
1. **Uniformity**: `TaskService.dispatch()` becomes the only way to do background work.
2. **Scalability**: One set of workers can be scaled independently of the main API.
3. **Debuggability**: We can turn on `persistent: true` for *any* task during debugging to see exactly what happened in the database, then flip it back to `false` for production.

---

## 4. Migration Strategy (Post-Finalization)
1. Create `src/core/tasks` module.
2. Migrate `AgentTask` model to `Task` model.
3. Implement `TaskWorker` as the single BullMQ consumer.
4. Slowly migrate `Enrichment` and `Media` processors into the `TaskRegistry`.
