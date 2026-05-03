import { Types } from 'mongoose';
import { UserPersona } from '../agent/memory/persona.model';
import { KnowledgeEntity } from '../entity/entity.model';
import { Entry } from '../entry/entry.model';
import { WebActivity } from '../web-activity/web-activity.model';
import { ReportContextBuilder } from './report.context-builder';
import Report from './report.model';
import { ReportType } from './report.types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('../entry/entry.model');
jest.mock('../entity/entity.model');
jest.mock('../agent/memory/persona.model');
jest.mock('../web-activity/web-activity.model');
jest.mock('./report.model');

// Mock the services rather than the underlying models they use internally
jest.mock('../entry/entry.service', () => ({
    entryService: { getEntriesForReport: jest.fn() },
}));
jest.mock('../mood/mood.service', () => ({
    moodService: { getMoods: jest.fn() },
}));
jest.mock('../entity/entity.service', () => ({
    entityService: { getEntitiesByIds: jest.fn() },
}));
jest.mock('../agent/services/agent.service', () => ({
    agentService: { getPersona: jest.fn() },
}));
jest.mock('./report.service', () => ({
    reportService: { getLatestReportBefore: jest.fn() },
}));
jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Import mocked services after jest.mock declarations
import { entryService } from '../entry/entry.service';
import { moodService } from '../mood/mood.service';
import { entityService } from '../entity/entity.service';
import { agentService } from '../agent/services/agent.service';
import { reportService } from './report.service';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeDate = (iso: string) => new Date(iso);

const MOCK_ENTRIES = [
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

const MOCK_MOOD_RECORDS = [
    { date: makeDate('2026-02-05'), score: 4, note: 'Good day' },
    { date: makeDate('2026-02-10'), score: 2, note: undefined },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

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
        (entryService.getEntriesForReport as jest.Mock).mockResolvedValue(MOCK_ENTRIES);
        (moodService.getMoods as jest.Mock).mockResolvedValue(MOCK_MOOD_RECORDS);
        (agentService.getPersona as jest.Mock).mockResolvedValue({ rawMarkdown: '# User Persona\nGoal-oriented, introvert.' });
        (entityService.getEntitiesByIds as jest.Mock).mockResolvedValue([
            { _id: MOCK_ENTRIES[0].mentions[0], name: 'Alice', otype: 'person' },
        ]);
        (reportService.getLatestReportBefore as jest.Mock).mockResolvedValue(null);

        const ctx = await builder.build(userId, start, end, ReportType.MONTHLY);

        expect(ctx.totalEntries).toBe(2);
        expect(ctx.moodTimeSeries).toHaveLength(2);
        expect(ctx.moodTimeSeries[0].score).toBe(4);
        expect(ctx.moodTimeSeries[1].score).toBe(2);
        expect(ctx.personaMarkdown).toContain('Goal-oriented');
        expect(ctx.topEntities[0]).toContain('Alice');
        expect(ctx.previousReport).toBeNull();
    });

    it('returns zero avgMoodScore and empty collections when no data exists', async () => {
        (entryService.getEntriesForReport as jest.Mock).mockResolvedValue([]);
        (moodService.getMoods as jest.Mock).mockResolvedValue([]);
        (agentService.getPersona as jest.Mock).mockResolvedValue(null);
        (entityService.getEntitiesByIds as jest.Mock).mockResolvedValue([]);
        (reportService.getLatestReportBefore as jest.Mock).mockResolvedValue(null);

        const ctx = await builder.build(userId, start, end, ReportType.WEEKLY);

        expect(ctx.totalEntries).toBe(0);
        expect(ctx.avgMoodScore).toBe(0);
        expect(ctx.moodTimeSeries).toHaveLength(0);
        expect(ctx.topTags).toHaveLength(0);
        expect(ctx.personaMarkdown).toBe('');
        expect(ctx.topEntities).toHaveLength(0);
    });

    it('falls back to entry-level mood scores when no Mood model records exist', async () => {
        (entryService.getEntriesForReport as jest.Mock).mockResolvedValue(MOCK_ENTRIES);
        (moodService.getMoods as jest.Mock).mockResolvedValue([]); // No dedicated mood records
        (agentService.getPersona as jest.Mock).mockResolvedValue(null);
        (entityService.getEntitiesByIds as jest.Mock).mockResolvedValue([]);
        (reportService.getLatestReportBefore as jest.Mock).mockResolvedValue(null);

        const ctx = await builder.build(userId, start, end, ReportType.WEEKLY);

        // avgMoodScore should fall back to entry moodMetadata scores: (4 + 2) / 2 = 3
        expect(ctx.avgMoodScore).toBe(3);
        expect(ctx.moodTimeSeries).toHaveLength(0);
    });

    it('populates previousReport when one exists before the current period', async () => {
        const previousContent = { overallScore: 72, executiveSummary: 'A strong month.' };

        (entryService.getEntriesForReport as jest.Mock).mockResolvedValue([]);
        (moodService.getMoods as jest.Mock).mockResolvedValue([]);
        (agentService.getPersona as jest.Mock).mockResolvedValue(null);
        (entityService.getEntitiesByIds as jest.Mock).mockResolvedValue([]);
        (reportService.getLatestReportBefore as jest.Mock).mockResolvedValue({ content: previousContent, startDate: start });

        const ctx = await builder.build(userId, start, end, ReportType.MONTHLY);

        expect(ctx.previousReport).not.toBeNull();
        expect((ctx.previousReport as any).content.overallScore).toBe(72);
        expect((ctx.previousReport as any).content.executiveSummary).toBe('A strong month.');
    });

    it('aggregates top tags correctly across all entries', async () => {
        const entriesWithTags = [
            { ...MOCK_ENTRIES[0], tags: ['work', 'focus', 'morning'] },
            { ...MOCK_ENTRIES[1], tags: ['work', 'gym'] },
            { ...MOCK_ENTRIES[0], tags: ['work'] },
        ];

        (entryService.getEntriesForReport as jest.Mock).mockResolvedValue(entriesWithTags);
        (moodService.getMoods as jest.Mock).mockResolvedValue([]);
        (agentService.getPersona as jest.Mock).mockResolvedValue(null);
        (entityService.getEntitiesByIds as jest.Mock).mockResolvedValue([]);
        (reportService.getLatestReportBefore as jest.Mock).mockResolvedValue(null);

        const ctx = await builder.build(userId, start, end, ReportType.WEEKLY);

        // 'work' appears 3x — should be first
        expect(ctx.topTags[0]).toContain('work');
        expect(ctx.topTags[0]).toContain('3x');
    });

    it('truncates entry narrative at MAX_ENTRY_NARRATIVE_LENGTH', async () => {
        const longEntry = {
            ...MOCK_ENTRIES[0],
            content: 'x'.repeat(15000), // Exceeds 10k cap
        };

        (entryService.getEntriesForReport as jest.Mock).mockResolvedValue([longEntry]);
        (moodService.getMoods as jest.Mock).mockResolvedValue([]);
        (agentService.getPersona as jest.Mock).mockResolvedValue(null);
        (entityService.getEntitiesByIds as jest.Mock).mockResolvedValue([]);
        (reportService.getLatestReportBefore as jest.Mock).mockResolvedValue(null);

        const ctx = await builder.build(userId, start, end, ReportType.WEEKLY);

        expect(ctx.entryNarrative).toContain('[Narrative Truncated]');
        expect(ctx.entryNarrative.length).toBeLessThan(15000);
    });
});
