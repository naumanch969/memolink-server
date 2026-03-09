import { Types } from 'mongoose';
import { ActivityDefinitions } from './activity-definitions.model';
import { passiveAnalysisService } from './passive-analysis.service';
import { PassiveSession } from './passive-session.model';
import { WebActivityEvent } from './web-activity.types';

// Mock dependencies
jest.mock('./passive-session.model');
jest.mock('./activity-definitions.model');

describe('PassiveAnalysisService', () => {
    const userId = new Types.ObjectId().toString();
    const date = '2026-03-09';

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock definitions
        (ActivityDefinitions.findOne as jest.Mock).mockResolvedValue({
            productiveDomains: ['github.com', 'vscode.dev', 'figma.com'],
            distractingDomains: ['twitter.com', 'netflix.com', 'instagram.com']
        });
    });

    const createEvent = (domain: string, startOffsetMin: number, durationMin: number): WebActivityEvent => {
        const baseTime = new Date('2026-03-09T10:00:00Z').getTime();
        return {
            domain,
            url: `https://${domain}/path`,
            title: `Title ${domain}`,
            startTime: baseTime + startOffsetMin * 60 * 1000,
            endTime: baseTime + (startOffsetMin + durationMin) * 60 * 1000,
            duration: durationMin * 60
        };
    };

    it('should split sessions if gap is greater than 5 minutes', async () => {
        const events = [
            createEvent('github.com', 0, 10),    // 10:00 to 10:10
            createEvent('github.com', 20, 10)    // 10:20 to 10:30 (10 min gap)
        ];

        await passiveAnalysisService.processEvents(userId, date, events);

        // Expect 2 sessions to be created
        expect(PassiveSession.create).toHaveBeenCalledTimes(2);
    });

    it('should calculate flow, categorise correctly, and assign tier "log" for standard productive chunk', async () => {
        const events = [
            createEvent('github.com', 0, 15), // 15 mins
            createEvent('vscode.dev', 15, 10) // 10 mins
        ]; // Total 25 mins, 1 context switch, 25 mins flow

        await passiveAnalysisService.processEvents(userId, date, events);

        expect(PassiveSession.create).toHaveBeenCalledTimes(1);
        const savedData = (PassiveSession.create as jest.Mock).mock.calls[0][0];

        expect(savedData.primaryCategory).toBe('productive');
        expect(savedData.metrics.contextSwitchCount).toBe(1);
        expect(savedData.metrics.flowDuration).toBe(25 * 60);
        expect(savedData.signalTier).toBe('log'); // 25 min flow < 30 min required for signal
    });

    it('should reset flow state when switching to distracting domain', async () => {
        const events = [
            createEvent('github.com', 0, 15),     // 15 min productive flow
            createEvent('twitter.com', 15, 5),    // 5 min break (breaks flow)
            createEvent('github.com', 20, 10)     // 10 min productive flow
        ];

        await passiveAnalysisService.processEvents(userId, date, events);

        const savedData = (PassiveSession.create as jest.Mock).mock.calls[0][0];

        expect(savedData.metrics.contextSwitchCount).toBe(2);
        // Max flow should be the 15 minute segment
        expect(savedData.metrics.flowDuration).toBe(15 * 60);
    });

    it('should assign tier "signal" for extended flow state (> 30 mins)', async () => {
        const events = [
            createEvent('github.com', 0, 45) // 45 min uninterrupted flow
        ];

        await passiveAnalysisService.processEvents(userId, date, events);

        const savedData = (PassiveSession.create as jest.Mock).mock.calls[0][0];
        expect(savedData.signalTier).toBe('signal');
        expect(savedData.metrics.flowDuration).toBe(45 * 60);
    });

    it('should assign tier "noise" for very short sessions (< 10 mins)', async () => {
        const events = [
            createEvent('github.com', 0, 3),
            createEvent('twitter.com', 3, 2),
            createEvent('cnn.com', 5, 2)
        ]; // Total 7 mins

        await passiveAnalysisService.processEvents(userId, date, events);

        const savedData = (PassiveSession.create as jest.Mock).mock.calls[0][0];
        expect(savedData.signalTier).toBe('noise');
    });

    it('should assign tier "signal" for high switch rate doomscrolling', async () => {
        const events = [];
        // Creates 12 minutes of rapid switching (15 switches) in distracting domains
        for (let i = 0; i < 15; i++) {
            events.push(createEvent(i % 2 === 0 ? 'twitter.com' : 'instagram.com', i * 0.8, 0.8));
        }

        await passiveAnalysisService.processEvents(userId, date, events);

        const savedData = (PassiveSession.create as jest.Mock).mock.calls[0][0];

        expect(savedData.primaryCategory).toBe('distracting');
        expect(savedData.metrics.contextSwitchCount).toBe(14); // 15 items = 14 switches
        expect(savedData.signalTier).toBe('signal');
    });
});
