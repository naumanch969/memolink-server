import { Types } from 'mongoose';
import { StringUtil } from '../../shared/utils/string.utils';
import { IReportContextBuilder } from './report.interfaces';
import { DailyMoodPoint, ReportContext, ReportType } from './report.types';
import { entryService } from '../entry/entry.service';
import { moodService } from '../mood/mood.service';
import { entityService } from '../entity/entity.service';
import { agentService } from '../agent/services/agent.service';
import { reportService } from './report.service';
import { REPORT_CONSTANTS } from './report.constants';

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

    /**
     * Optimized entity extraction: $O(N)$ pass over entries to build context mapping.
     */
    private async fetchTopEntities(userId: string | Types.ObjectId, entries: any[]): Promise<string[]> {
        // Build a map of mentionId -> first available context snippet in one pass
        const mentionContextMap = new Map<string, string>();
        const mentionIdsSet = new Set<string>();

        for (const entry of entries) {
            if (!entry.mentions || entry.mentions.length === 0) continue;

            for (const mention of entry.mentions) {
                const mentionId = mention.toString();
                mentionIdsSet.add(mentionId);

                // If we don't have a context for this entity yet, extract it
                if (!mentionContextMap.has(mentionId)) {
                    mentionContextMap.set(mentionId, entry.content || '');
                }
            }
        }

        const mentionIds = Array.from(mentionIdsSet);
        if (mentionIds.length === 0) return [];

        const entities = await entityService.getEntitiesByIds(mentionIds, userId);

        // Take up to limit and format with context
        return entities
            .slice(0, REPORT_CONSTANTS.TOP_ENTITIES_COUNT)
            .map(entity => {
                const mentionId = entity._id.toString();
                const rawContent = mentionContextMap.get(mentionId) || '';
                const context = rawContent ? StringUtil.extractSnippet(rawContent, entity.name, REPORT_CONSTANTS.CONTEXT_SNIPPET_PADDING) : '';
                return `${entity.name}${context ? ` (Context: "${context}")` : ''}`;
            });
    }


    private async fetchPersona(userId: string | Types.ObjectId): Promise<string> {
        const persona = await agentService.getPersona(userId);
        return persona?.rawMarkdown ?? '';
    }

    private async fetchPreviousReport(
        userId: string | Types.ObjectId,
        type: ReportType,
        currentStart: Date
    ): Promise<string | undefined> {
        const report = await reportService.getLatestReportBefore(userId, type, currentStart);
        return report?.content?.text || report?.content?.analysis || undefined;
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
            .slice(0, REPORT_CONSTANTS.TOP_TAGS_COUNT)
            .map(([tag, count]) => `${tag} (${count}x)`);
    }

    private computeAvgMood(moodPoints: DailyMoodPoint[], entries: any[]): number {
        // Prefer dedicated Mood model data
        if (moodPoints.length > 0) {
            const total = moodPoints.reduce((s, p) => s + p.score, 0);
            return Math.round((total / moodPoints.length) * 10) / 10;
        }

        // Fall back to entry-level mood scores
        const scored = entries.filter(e => typeof e.moodMetadata?.score === 'number');
        if (scored.length === 0) return 0;
        const total = scored.reduce((s, e) => s + e.moodMetadata.score, 0);
        return Math.round((total / scored.length) * 10) / 10;
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
