import { SignalTier } from "./enrichment.types";

export interface IEnrichmentService {
    enqueueActiveEnrichment(userId: string, entryId: string, sessionId: string, signalTier: SignalTier): Promise<void>;
    evaluatePassiveGate(userId: string, date: string): Promise<void>;
    enqueuePassiveEnrichment(userId: string, sessionId: string): Promise<void>;
    processActiveEnrichment(userId: string, entryId: string, sessionId: string, signalTier?: SignalTier): Promise<void>;
    processPassiveEnrichment(userId: string, sessionId: string): Promise<void>;
    runEnrichmentHealingBatch(limit?: number): Promise<void>;
}
