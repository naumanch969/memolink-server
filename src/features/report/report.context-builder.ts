import { Types } from 'mongoose';
import { StringUtil } from '../../shared/utils/string.utils';
import { IReportContextBuilder } from './report.interfaces';
import { DailyMoodPoint, IReport, ReportContext, ReportType } from './report.types';
import { entryService } from '../entry/entry.service';
import { moodService } from '../mood/mood.service';
import { entityService } from '../entity/entity.service';
import { agentService } from '../agent/services/agent.service';
import { reportService } from './report.service';
import { REPORT_CONSTANTS } from './report.constants';
import { ArrayUtil } from '../../shared/utils/array.utils';
import { MathUtil } from '../../shared/utils/math.utils';

// ReportContextBuilder aggregates data from multiple features to provide a comprehensive context for LLM-based analysis.
export class ReportContextBuilder implements IReportContextBuilder {

    async build(userId: string | Types.ObjectId, start: Date, end: Date, type: ReportType): Promise<ReportContext> {
        const entries = await this.fetchEntries(userId, start, end);

        const [moodPoints, topEntities, persona, previousReport] = await Promise.all([
            this.fetchMoodTimeSeries(userId, start, end),
            this.fetchTopEntities(userId, entries),
            this.fetchPersona(userId),
            this.fetchPreviousReport(userId, type, start),
        ]);

        const topTags = this.aggregateTopTags(entries);
        const totalWords = entries.reduce((sum, e) => sum + StringUtil.wordCount(e.content), 0);
        const avgMoodScore = this.computeAvgMood(moodPoints, entries);
        const entryNarrative = this.buildEntryNarrative(entries);

        return {
            period: { start, end, type },
            totalEntries: entries.length,
            totalWords,
            avgMoodScore,
            moodTimeSeries: moodPoints,
            entryNarrative,
            topTags,
            topEntities,
            personaMarkdown: persona,
            // Web activity is currently out of scope for production reports
            webActivitySummary: '',
            previousReport,
        };
    }

    // ─── Private Fetchers ────────────────────────────────────────────────────

    private async fetchEntries(userId: string | Types.ObjectId, start: Date, end: Date) {
        return entryService.getEntriesForReport(userId, start, end);
    }

    private async fetchMoodTimeSeries(userId: string | Types.ObjectId, start: Date, end: Date): Promise<DailyMoodPoint[]> {
        const records = await moodService.getMoods(userId, { dateFrom: start.toISOString(), dateTo: end.toISOString() });

        return records.map(r => ({
            date: r.date.toISOString().split('T')[0],
            score: r.score,
            note: r.note,
        }));
    }

    // Optimized entity extraction: $O(N)$ pass over entries to build context mapping.
    private async fetchTopEntities(userId: string | Types.ObjectId, entries: any[]): Promise<string[]> {
        // 1. Count mention frequencies
        const counts = new Map<string, number>();
        for (const entry of entries) {
            if (!entry.mentions) continue;
            for (const mention of entry.mentions) {
                const id = mention.toString();
                counts.set(id, (counts.get(id) || 0) + 1);
            }
        }

        if (counts.size === 0) return [];

        // 2. Sort by frequency and take top X
        const topMentionIds = Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, REPORT_CONSTANTS.TOP_ENTITIES_COUNT)
            .map(([id]) => id);

        const entities = await entityService.getEntitiesByIds(topMentionIds, userId);

        // 3. Extract snippets only for the top entities
        // Re-pass entries once to find first available context for these specific IDs
        const topEntityContexts = new Map<string, string>();
        for (const entry of entries) {
            if (!entry.mentions) continue;
            for (const mention of entry.mentions) {
                const id = mention.toString();
                if (topMentionIds.includes(id) && !topEntityContexts.has(id)) {
                    topEntityContexts.set(id, entry.content || '');
                }
            }
            if (topEntityContexts.size === topMentionIds.length) break;
        }

        return entities.map(entity => {
            const id = entity._id.toString();
            const rawContent = topEntityContexts.get(id) || '';
            const context = rawContent ? StringUtil.extractSnippet(rawContent, entity.name, REPORT_CONSTANTS.CONTEXT_SNIPPET_PADDING) : '';
            return `${entity.name}${context ? ` (Context: "${context}")` : ''}`;
        });
    }


    private async fetchPersona(userId: string | Types.ObjectId): Promise<string> {
        const persona = await agentService.getPersona(userId);
        return persona?.rawMarkdown ?? '';
    }

    private async fetchPreviousReport(userId: string | Types.ObjectId, type: ReportType, currentStart: Date): Promise<IReport | null> {
        return reportService.getLatestReportBefore(userId, type, currentStart);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private aggregateTopTags(entries: any[]): string[] {
        const allTags = entries.flatMap(e => e.tags ?? []);
        return ArrayUtil.sortByFrequency(allTags)
            .slice(0, REPORT_CONSTANTS.TOP_TAGS_COUNT)
            .map(([tag, count]) => `${tag} (${count}x)`);
    }

    private computeAvgMood(moodPoints: DailyMoodPoint[], entries: any[]): number {
        // Prefer dedicated Mood model data
        if (moodPoints.length > 0) {
            return MathUtil.average(moodPoints.map(p => p.score));
        }

        // Fall back to entry-level mood scores
        const entryScores = entries
            .filter(e => typeof e.moodMetadata?.score === 'number')
            .map(e => e.moodMetadata.score);

        return MathUtil.average(entryScores);
    }

    private buildEntryNarrative(entries: any[]): string {
        const narrative = entries.map(e => {
            const date = new Date(e.createdAt).toISOString().split('T')[0];
            const mood = e.moodMetadata?.category ?? e.mood ?? 'neutral';
            const important = e.isImportant ? ' [★]' : '';
            const content = (e.content ?? '').replace(/\n/g, ' ');
            return `[${date}]${important} Mood: ${mood} — ${content}`;
        }).join('\n');

        // Apply safety truncation to prevent token overflow
        if (narrative.length > REPORT_CONSTANTS.MAX_ENTRY_NARRATIVE_LENGTH) {
            return narrative.substring(0, REPORT_CONSTANTS.MAX_ENTRY_NARRATIVE_LENGTH) + '\n... [Narrative Truncated]';
        }

        return narrative;
    }

}

export const reportContextBuilder = new ReportContextBuilder();
