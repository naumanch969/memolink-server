import { redisConnection } from '../src/config/redis';
import { eventStream } from '../src/core/events/EventStream';
import { EventType, TaskRescheduledPayload } from '../src/core/events/types';

async function main() {
    console.log("🧪 Starting Event Stream Verification...");

    const testUserId = 'test-user-v0';
    const payload: TaskRescheduledPayload = {
        taskId: 'task-123',
        oldDate: new Date('2026-01-30').toISOString(),
        newDate: new Date('2026-02-01').toISOString(),
        reason: 'Procrastination'
    };

    try {
        // 1. Publish
        console.log("📤 Publishing Event...");
        const msgId = await eventStream.publish(
            EventType.TASK_RESCHEDULED,
            testUserId,
            payload
        );
        console.log(`✅ Published with ID: ${msgId}`);

        // 2. Read Back (Simulating a worker)
        // Since we want to read WHAT WE JUST WROTE, we should read from a point prior to this ID.
        // Or simpler, just read the last entry.
        // Actually, XREAD '$' waits for NEW entries. 0 means all.
        // Let's try reading the specific range or just verify the stream has data.

        console.log("📥 Reading Event Stream...");
        const monitorPromise = eventStream.read('0-0', 10); // Read from beginning
        const events = await monitorPromise;

        const foundData = events.find(item =>
            item.event.userId === testUserId &&
            item.event.type === EventType.TASK_RESCHEDULED &&
            (item.event.payload as TaskRescheduledPayload).taskId === 'task-123'
        );

        if (foundData) {
            const found = foundData.event;
            console.log("✅ Event Found & Verified:");
            console.log(JSON.stringify(found, null, 2));

            if (found.payload.reason === 'Procrastination') {
                console.log("✨ Payload Integrity Checked: OK");
            } else {
                console.error("❌ Payload Corruption Detected");
                process.exit(1);
            }

        } else {
            console.error("❌ Event lost in the stream!");
            process.exit(1);
        }

    } catch (error) {
        console.error("❌ Test Failed", error);
        process.exit(1);
    } finally {
        redisConnection.disconnect();
        process.exit(0);
    }
}

main();
