export enum DataType {
    BOOLEAN = 'boolean',
    CHECKLIST = 'checklist',
    COUNTER = 'counter',
    DURATION = 'duration',
    TEXT = 'text',
    SCALE = 'scale',
    TIME = 'time',
}

export type DataTypeKey = keyof typeof DataType;

// Generic Config Interfaces
export interface IBooleanConfig {
    trueLabel?: string;
    falseLabel?: string;
}

export interface IChecklistConfig {
    items: string[];
    allowMultiple?: boolean;
}

export interface ICounterConfig {
    target?: number;
    unit?: string;
    min?: number;
    max?: number;
    step?: number;
}

export interface IDurationConfig {
    targetSeconds?: number;
}

export interface ITextConfig {
    maxLength?: number;
    placeholder?: string;
    multiline?: boolean;
}

export interface IScaleConfig {
    min: number;
    max: number;
    minLabel?: string;
    maxLabel?: string;
    step?: number;
}

export interface ITimeConfig {
    format?: '12' | '24';
}

// Union of all configs
export type DataConfig =
    | IBooleanConfig
    | IChecklistConfig
    | ICounterConfig
    | IDurationConfig
    | ITextConfig
    | IScaleConfig
    | ITimeConfig;

// Value Types
export type DataValue =
    | boolean                   // Boolean
    | boolean[]                // Checklist (array of checked states)
    | number                   // Counter, Duration, Scale
    | string                   // Text, Time (HH:mm)
    | null;

export interface IDataEntity {
    type: DataType;
    config: DataConfig;
    value?: DataValue;
}
