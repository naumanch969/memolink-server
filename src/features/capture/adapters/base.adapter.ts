import { InputMethod, SourceType } from "../../enrichment/enrichment.types";
import { CaptureSource, ICaptureAdapter } from "../capture.interfaces";

export interface NormalizedCapture {
    sourceType: SourceType;
    inputMethod: InputMethod;
    payload: {
        appName?: string;
        windowTitle?: string;
        url?: string;
        activeSeconds?: number;
        interactionDensity?: number;
        rawText?: string;
        metadata?: Record<string, any>;
    };
    timestamp?: Date;
}

export abstract class BaseCaptureAdapter<TRaw = any> implements ICaptureAdapter<TRaw> {
    abstract readonly source: CaptureSource;
    abstract normalize(userId: string, data: TRaw): Promise<NormalizedCapture | NormalizedCapture[]>;
}
