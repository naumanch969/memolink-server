# Implementation Plan - Reporting System Overhaul

This plan outlines the refactoring of the Weekly and Monthly reporting system in `brinn-server` to improve architectural integrity, performance, and alignment with the current production scope.

## 1. Problem Statement
The current reporting system suffers from several architectural issues:
- **SRP Violations:** `ReportService` is overloaded with notification and date logic.
- **Performance Risks:** O(N*M) complexity in context building and potential context window overflow.
- **Scope Creep:** Inclusion of `WebActivity` data which is currently restricted in production.
- **Code Hygiene:** Use of magic numbers, fragile date handling, and redundant controller endpoints.

## 2. Proposed Changes

### 2.1 Refactor `ReportService`
- **Consolidate Persistence:** Create a private `upsertReport` method to handle race conditions and eliminate code duplication.
- **Decouple Notifications:** Move `sendNotification` and email triggering out of the core creation flow. Use an event-based approach or a clean service separation.
- **Sanitize Date Logic:** Move "magic" lookback logic to a dedicated utility or configuration.

### 2.2 Optimize `ReportContextBuilder`
- **Scope Alignment:** Remove `fetchWebActivity` as it is currently out of production scope (restricted route).
- **Performance Fix:** Optimize `fetchTopEntities` context extraction. Instead of re-scanning entries for each entity, perform a single pass over entries to map entities to snippets.
- **Payload Management:** Implement truncation or summarization for `buildEntryNarrative` to prevent context window overflow for high-volume users.

### 2.3 Workflow & Prompt Optimization
- **Prompt Cleanup:** Remove references to "Goals" and "Web Activity" from `weekly-analysis.workflow.ts` and `monthly-analysis.workflow.ts`.
- **Stat Alignment:** Ensure stats provided to the model exactly match the context being passed.

### 2.4 API & Hygiene
- **Controller Cleanup:** Remove `ReportController.createFromTask` if it is confirmed to be a redundant dev endpoint.
- **Type Safety:** Implement proper validation for `listReports` search parameters.
- **Magic Number Elimination:** Replace all magic numbers (40, 8, 15, -4) with named constants in a `report.constants.ts` or similar.

## 3. Implementation Phases

### Phase 1: Core Service Refactor
- Cleanup `ReportService` and `ReportController`.
- Create `report.constants.ts`.

### Phase 2: Context Builder Optimization
- Remove `WebActivity`.
- Optimize entity context extraction.
- Implement narrative truncation.

### Phase 3: Workflow Updates
- Update prompts and output schemas in `weekly-analysis` and `monthly-analysis` workflows.
- Final validation and testing.

## 4. Verification Plan
- **Unit Tests:** Update and run `report.service.test.ts` and `report.context-builder.test.ts`.
- **Integration Tests:** Verify report generation via `AgentTask` triggers.
- **Manual Audit:** Verify the final generated reports no longer reference out-of-scope modules.
