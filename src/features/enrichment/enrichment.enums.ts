export enum SignalTier {
    NOISE = 'noise',
    LOG = 'log',
    SIGNAL = 'signal',
    DEEP_SIGNAL = 'deep_signal'
}

export enum SourceType {
    ACTIVE = 'active',
    PASSIVE = 'passive'
}

export enum InputMethod {
    TEXT = 'text',
    VOICE = 'voice',
    WHATSAPP = 'whatsapp',
    SYSTEM = 'system'
}

export enum ProcessingStatus {
    PENDING = 'pending',
    COMPLETED = 'completed',
    FAILED = 'failed',
    NOISE = 'noise'
}

export enum EnergyLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high'
}

export enum CognitiveLoad {
    FOCUSED = 'focused',
    SCATTERED = 'scattered',
    RUMINATING = 'ruminating'
}

export enum ProcessingStep {
    ANALYZING_INTENT = 'analyzing_intent',
    INDEXING = 'indexing',
    RESOLVING_ENTITIES = 'resolving_entities',
    TAGGING = 'tagging',
    STORING_MEMORY = 'storing_memory'
}

export enum EntityType {
    PERSON = 'person',
    PLACE = 'place',
    CONCEPT = 'concept',
    PROJECT = 'project',
    ORGANIZATION = 'organization'
}

export enum EntitySource {
    USER = 'user',
    EXTRACTED = 'extracted'
}
