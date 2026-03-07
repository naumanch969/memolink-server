export interface IEnrichmentService {
    enqueueActiveEnrichment(userId: string, entryId: string, sessionId: string): Promise<void>;
    evaluatePassiveGate(userId: string, date: string): Promise<void>;
    enqueuePassiveEnrichment(userId: string, sessionId: string): Promise<void>;
    processActiveEnrichment(userId: string, entryId: string, sessionId: string): Promise<void>;
    processPassiveEnrichment(userId: string, sessionId: string): Promise<void>;
    runEnrichmentHealingBatch(limit?: number): Promise<void>;
}
