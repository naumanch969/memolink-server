import { Schema } from 'mongoose';
import { telemetryBus } from './telemetry.bus';

export function telemetryPlugin(schema: Schema) {
    // We only care about queries that actually hit the DB
    const ops = ['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments', 'aggregate'];

    ops.forEach(op => {
        schema.pre(op as any, function (next) {
            (this as any)._startTime = Date.now();
            next();
        });

        schema.post(op as any, function (this: any) {
            const duration = Date.now() - (this._startTime || Date.now());
            const collection = (this.mongooseCollection as any)?.name || 'unknown';

            telemetryBus.emitDB({
                operation: op,
                collection,
                duration
            });
        });
    });
}
