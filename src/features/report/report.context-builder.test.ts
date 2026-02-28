import { Types } from 'mongoose';
import { UserPersona } from '../agent/memory/persona.model';
import KnowledgeEntity from '../entity/entity.model';
import { Entry } from '../entry/entry.model';
import Goal from '../goal/goal.model';
import { Mood } from '../mood/mood.model';
import { WebActivity } from '../web-activity/web-activity.model';
import { ReportContextBuilder } from './report.context-builder';
import Report from './report.model';
import { ReportType } from './report.types';

jest.mock('../entry/entry.model');
jest.mock('../mood/mood.model');
jest.mock('../goal/goal.model');
jest.mock('../entity/entity.model');
jest.mock('../agent/memory/persona.model');
jest.mock('../web-activity/web-activity.model');
jest.mock('./report.model');
jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const makeDate = (iso: string) => new Date(iso);

describe('ReportContextBuilder', () => {
    const userId = new Types.ObjectId().toString();
    const start = makeDate('2026-02-01T00:00:00Z');
    const end = makeDate('2026-02-28T23:59:59Z');

    let builder: ReportContextBuilder;

    beforeEach(() => {
        jest.clearAllMocks();
        builder = new ReportContextBuilder();
    });

    it('builds context with all fields when full data is present', async () => {
        const mockEntries = [
            {
                content: 'Had a great workout this morning.',
                mood: 'energized',
                moodMetadata: { category: 'energized', score: 4 },
                tags: ['gym', 'morning'],
                mentions: [new Types.ObjectId()],
                createdAt: makeDate('2026-02-05T08:00:00Z'),
                isImportant: true,
                isFavorite: false,
                location: '',
            },
            {
                content: 'Struggled with focus at work.',
                mood: 'anxious',
                moodMetadata: { category: 'anxious', score: 2 },
                tags: ['work'],
                mentions: [],
                createdAt: makeDate('2026-02-10T20:00:00Z'),
                isImportant: false,
                isFavorite: false,
                location: '',
            },
        ];

        const mockMood = [
            { date: makeDate('2026-02-05'), score: 4, note: 'Good day' },
            { date: makeDate('2026-02-10'), score: 2, note: undefined },
        ];

        const mockGoals = [
            {
                title: 'Exercise Daily',
                description: 'Gym 5x per week',
                why: 'Health is the foundation',
                progress: { streakCurrent: 5, streakLongest: 12, totalCompletions: 20 },
                progressLogs: [
                    { date: makeDate('2026-02-03'), value: 1 },
                    { date: makeDate('2026-02-05'), value: 1 },
                ],
                milestones: [
                    { title: '10 workouts', completed: true, completedAt: makeDate('2026-02-15') },
                ],
                deadline: undefined,
            },
        ];

        const mockPersona = { rawMarkdown: '# User Persona\nGoal-oriented, introvert.' };

        const mockWebActivity = [
            {
                date: '2026-02-05',
                totalSeconds: 7200,
                productiveSeconds: 5400,
                distractingSeconds: 1800,
                domainMap: { 'github.com': 3600, 'youtube.com': 1800 },
            },
        ];

        // Build chainable mock for Entry.find
        const entryFindMock = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockEntries),
            distinct: jest.fn().mockResolvedValue(mockEntries[0].mentions),
        };
        (Entry.find as jest.Mock).mockReturnValue(entryFindMock);
        (Entry.find as jest.Mock).mockReturnValueOnce(entryFindMock)   // fetchEntries
            .mockReturnValueOnce({ distinct: jest.fn().mockResolvedValue(mockEntries[0].mentions) }); // fetchTopEntities

        const moodFindMock = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockMood),
        };
        (Mood.find as jest.Mock).mockReturnValue(moodFindMock);

        const goalFindMock = {
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockGoals),
        };
        (Goal.find as jest.Mock).mockReturnValue(goalFindMock);

        (UserPersona.findOne as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockPersona),
        });

        (KnowledgeEntity.find as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([{ name: 'Alice', otype: 'person' }]),
        });

        (WebActivity.find as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(mockWebActivity),
        });

        (Report.findOne as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(null),
        });

        const ctx = await builder.build(userId, start, end, ReportType.MONTHLY);

        expect(ctx.totalEntries).toBe(2);
        expect(ctx.moodTimeSeries).toHaveLength(2);
        expect(ctx.moodTimeSeries[0].score).toBe(4);
        expect(ctx.goalSnapshots).toHaveLength(1);
        expect(ctx.goalSnapshots[0].periodLogs).toBe(2);  // Feb 3 + Feb 5 within range
        expect(ctx.goalSnapshots[0].milestonesHit).toBe(1); // Completed Feb 15
        expect(ctx.personaMarkdown).toContain('Goal-oriented');
        expect(ctx.topEntities).toContain('Alice');
        expect(ctx.webActivitySummary).toContain('github.com');
        expect(ctx.previousReport).toBeUndefined();
    });

    it('returns zero avgMoodScore when no mood data exists', async () => {
        const emptyFindMock = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
            distinct: jest.fn().mockResolvedValue([]),
        };

        (Entry.find as jest.Mock).mockReturnValue(emptyFindMock);
        (Mood.find as jest.Mock).mockReturnValue(emptyFindMock);
        (Goal.find as jest.Mock).mockReturnValue(emptyFindMock);
        (UserPersona.findOne as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(null),
        });
        (KnowledgeEntity.find as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });
        (WebActivity.find as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });
        (Report.findOne as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(null),
        });

        const ctx = await builder.build(userId, start, end, ReportType.WEEKLY);

        expect(ctx.totalEntries).toBe(0);
        expect(ctx.avgMoodScore).toBe(0);
        expect(ctx.moodTimeSeries).toHaveLength(0);
        expect(ctx.topTags).toHaveLength(0);
        expect(ctx.personaMarkdown).toBe('');
        expect(ctx.webActivitySummary).toBe('');
    });

    it('populates previousReport when one exists', async () => {
        const previousContent = { overallScore: 72, executiveSummary: 'A strong month.' };
        const emptyFindMock = {
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
            distinct: jest.fn().mockResolvedValue([]),
        };

        (Entry.find as jest.Mock).mockReturnValue(emptyFindMock);
        (Mood.find as jest.Mock).mockReturnValue(emptyFindMock);
        (Goal.find as jest.Mock).mockReturnValue(emptyFindMock);
        (UserPersona.findOne as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue(null),
        });
        (KnowledgeEntity.find as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });
        (WebActivity.find as jest.Mock).mockReturnValue({
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue([]),
        });
        (Report.findOne as jest.Mock).mockReturnValue({
            sort: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            lean: jest.fn().mockResolvedValue({ content: previousContent }),
        });

        const ctx = await builder.build(userId, start, end, ReportType.MONTHLY);

        expect(ctx.previousReport).toEqual(previousContent);
    });
});
