import { Types } from 'mongoose';
import { UserPersona } from '../agent/memory/persona.model';
import { KnowledgeEntity } from '../entity/entity.model';
import { Entry } from '../entry/entry.model';
import Goal from '../goal/goal.model';
import { IGoal } from '../goal/goal.types';
import { Mood } from '../mood/mood.model';
import { WebActivity } from '../web-activity/web-activity.model';
import Report from './report.model';
import { ReportType } from './report.types';

// ─── Shape Definitions ────────────────────────────────────────────────────────

export interface DailyMoodPoint {
    date: string;   // YYYY-MM-DD
    score: number;
    note?: string;
}

export interface GoalSnapshot {
    title: string;
    description?: string;
    why?: string;
    streakCurrent: number;
    streakLongest: number;
    totalCompletions: number;
    deadline?: Date;
    // Logs within the report period for completion-rate calculation
    periodLogs: number;
    milestonesHit: number;
}

export interface ReportContext {
    period: { start: Date; end: Date; type: ReportType };
    totalEntries: number;
    totalWords: number;
    avgMoodScore: number;
    moodTimeSeries: DailyMoodPoint[];
    entryNarrative: string;         // Pre-formatted string for LLM prompt
    goalSnapshots: GoalSnapshot[];
    topTags: string[];              // "tag (Nx)" format, top 15
    topEntities: string[];          // top mentioned people/places by name
    personaMarkdown: string;        // UserPersona.rawMarkdown or empty
    webActivitySummary: string;     // Aggregated web-activity string or empty
    previousReport?: any;           // Last period's content for comparison
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export class ReportContextBuilder {

    async build(
        userId: string | Types.ObjectId,
        start: Date,
        end: Date,
        type: ReportType
    ): Promise<ReportContext> {
        const [
            entries,
            moodPoints,
            goals,
            topEntities,
            persona,
            webActivity,
            previousReport
        ] = await Promise.all([
            this.fetchEntries(userId, start, end),
            this.fetchMoodTimeSeries(userId, start, end),
            this.fetchGoalSnapshots(userId, start, end),
            this.fetchTopEntities(userId, start, end),
            this.fetchPersona(userId),
            this.fetchWebActivity(userId, start, end),
            this.fetchPreviousReport(userId, type, start),
        ]);

        const topTags = this.aggregateTopTags(entries);
        const totalWords = entries.reduce((sum, e) => sum + this.wordCount(e.content), 0);
        const avgMoodScore = this.computeAvgMood(moodPoints, entries);
        const entryNarrative = this.buildEntryNarrative(entries);

        return {
            period: { start, end, type },
            totalEntries: entries.length,
            totalWords,
            avgMoodScore,
            moodTimeSeries: moodPoints,
            entryNarrative,
            goalSnapshots: goals,
            topTags,
            topEntities,
            personaMarkdown: persona,
            webActivitySummary: webActivity,
            previousReport,
        };
    }

    // ─── Private Fetchers ────────────────────────────────────────────────────

    private async fetchEntries(userId: string | Types.ObjectId, start: Date, end: Date) {
        return Entry.find({
            userId,
            createdAt: { $gte: start, $lte: end },
        })
            .select('content mood moodMetadata tags mentions createdAt isImportant isFavorite location')
            .sort({ createdAt: 1 })
            .lean();
    }

    private async fetchMoodTimeSeries(userId: string | Types.ObjectId, start: Date, end: Date): Promise<DailyMoodPoint[]> {
        const records = await Mood.find({
            userId,
            date: { $gte: start, $lte: end },
        })
            .select('date score note')
            .sort({ date: 1 })
            .lean();

        return records.map(r => ({
            date: r.date.toISOString().split('T')[0],
            score: r.score,
            note: r.note,
        }));
    }

    private async fetchGoalSnapshots(userId: string | Types.ObjectId, start: Date, end: Date): Promise<GoalSnapshot[]> {
        const goals: IGoal[] = await Goal.find({ userId, status: 'active' })
            .select('title description why progress progressLogs milestones deadline')
            .lean();

        return goals.map(g => {
            const periodLogs = (g.progressLogs ?? []).filter(log => {
                const d = new Date(log.date);
                return d >= start && d <= end;
            }).length;

            const milestonesHit = (g.milestones ?? []).filter(m => {
                const completedAt = m.completedAt ? new Date(m.completedAt) : null;
                return m.completed && completedAt && completedAt >= start && completedAt <= end;
            }).length;

            return {
                title: g.title,
                description: g.description,
                why: g.why,
                streakCurrent: g.progress?.streakCurrent ?? 0,
                streakLongest: g.progress?.streakLongest ?? 0,
                totalCompletions: g.progress?.totalCompletions ?? 0,
                deadline: g.deadline,
                periodLogs,
                milestonesHit,
            };
        });
    }

    private async fetchTopEntities(userId: string | Types.ObjectId, start: Date, end: Date): Promise<string[]> {
        // Get entry IDs for the period to find mentioned entities
        const entryIds = await Entry.find({
            userId,
            createdAt: { $gte: start, $lte: end },
        }).distinct('mentions');

        if (entryIds.length === 0) return [];

        const entities = await KnowledgeEntity.find({
            _id: { $in: entryIds },
            isDeleted: false,
        })
            .select('name otype')
            .sort({ interactionCount: -1 })
            .limit(10)
            .lean();

        return entities.map(e => e.name);
    }

    private async fetchPersona(userId: string | Types.ObjectId): Promise<string> {
        const persona = await UserPersona.findOne({ userId: userId.toString() })
            .select('rawMarkdown')
            .lean();
        return persona?.rawMarkdown ?? '';
    }

    private async fetchWebActivity(userId: string | Types.ObjectId, start: Date, end: Date): Promise<string> {
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        const records = await WebActivity.find({
            userId,
            date: { $gte: startStr, $lte: endStr },
        })
            .select('date totalSeconds productiveSeconds distractingSeconds domainMap')
            .lean();

        if (records.length === 0) return '';

        const totalHours = Math.round(records.reduce((s, r) => s + r.totalSeconds, 0) / 3600);
        const productiveHours = Math.round(records.reduce((s, r) => s + r.productiveSeconds, 0) / 3600);

        // Aggregate domain totals across the period
        const domainTotals: Record<string, number> = {};
        for (const record of records) {
            if (record.domainMap) {
                for (const [domain, seconds] of Object.entries(record.domainMap as Record<string, number>)) {
                    domainTotals[domain] = (domainTotals[domain] ?? 0) + seconds;
                }
            }
        }

        const topDomains = Object.entries(domainTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([domain, secs]) => `${domain} (${Math.round(secs / 60)}m)`)
            .join(', ');

        return `Total screen time: ${totalHours}h | Productive: ${productiveHours}h | Top sites: ${topDomains}`;
    }

    private async fetchPreviousReport(
        userId: string | Types.ObjectId,
        type: ReportType,
        currentStart: Date
    ): Promise<any | undefined> {
        const report = await Report.findOne({
            userId: new Types.ObjectId(userId.toString()),
            type,
            startDate: { $lt: currentStart },
        })
            .sort({ startDate: -1 })
            .select('content startDate endDate')
            .lean();

        return report?.content ?? undefined;
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private aggregateTopTags(entries: any[]): string[] {
        const freq: Record<string, number> = {};
        for (const entry of entries) {
            for (const tag of (entry.tags ?? [])) {
                const key = tag.toString();
                freq[key] = (freq[key] ?? 0) + 1;
            }
        }
        return Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 15)
            .map(([tag, count]) => `${tag} (${count}x)`);
    }

    private computeAvgMood(moodPoints: DailyMoodPoint[], entries: any[]): number {
        // Prefer dedicated Mood model data; fall back to entry moodMetadata scores
        if (moodPoints.length > 0) {
            const total = moodPoints.reduce((s, p) => s + p.score, 0);
            return Math.round((total / moodPoints.length) * 10) / 10;
        }

        const scored = entries.filter(e => typeof e.moodMetadata?.score === 'number');
        if (scored.length === 0) return 0;
        const total = scored.reduce((s, e) => s + e.moodMetadata.score, 0);
        return Math.round((total / scored.length) * 10) / 10;
    }

    private buildEntryNarrative(entries: any[]): string {
        return entries.map(e => {
            const date = new Date(e.createdAt).toISOString().split('T')[0];
            const mood = e.moodMetadata?.category ?? e.mood ?? 'unknown';
            const important = e.isImportant ? ' [★]' : '';
            const snippet = (e.content ?? '').substring(0, 120).replace(/\n/g, ' ');
            return `[${date}]${important} Mood: ${mood} — ${snippet}`;
        }).join('\n');
    }

    private wordCount(text: string): number {
        return (text ?? '').split(/\s+/).filter(w => w.length > 0).length;
    }
}

export const reportContextBuilder = new ReportContextBuilder();
