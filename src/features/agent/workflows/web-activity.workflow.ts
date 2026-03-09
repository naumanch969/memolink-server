import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { entryService } from '../../entry/entry.service';
import { tagService } from '../../tag/tag.service';
import { PassiveSession } from '../../web-activity/passive-session.model';
import { WebActivity } from '../../web-activity/web-activity.model';
import { IAgentTaskDocument } from '../agent.model';
import { AgentTaskType, AgentWorkflowResult, IAgentWorkflow } from '../agent.types';

export class WebActivityWorkflow implements IAgentWorkflow {
    public readonly type = AgentTaskType.WEB_ACTIVITY_SUMMARY;

    async execute(task: IAgentTaskDocument): Promise<AgentWorkflowResult> {
        const { userId, inputData } = task;
        const { date } = (inputData as any) || {};

        if (!date) {
            return { status: 'failed', error: 'Missing date in inputData' };
        }

        try {
            logger.info(`Running Web Activity Summary for user ${userId} on ${date}`);

            // 1. Fetch Activity Details
            const activity = await WebActivity.findOne({ userId, date });
            if (!activity || activity.totalSeconds === 0) {
                logger.info(`No activity to summarize for user ${userId} on ${date}`);
                return { status: 'completed', result: { skipped: true, reason: 'no_activity' } };
            }

            // 2. Fetch PassiveSessions for deeper cognitive insights
            const sessions = await PassiveSession.find({ userId, date }).sort({ startTime: 1 }).lean();

            // 3. Format data for LLM
            // Convert map to array and sort by time
            const topDomains = Object.entries(activity.domainMap || {})
                .map(([domain, seconds]) => ({ domain: domain.replace(/__dot__/g, '.'), seconds }))
                .sort((a, b) => b.seconds - a.seconds)
                .slice(0, 15);

            const formatSeconds = (s: number) => {
                const h = Math.floor(s / 3600);
                const m = Math.floor((s % 3600) / 60);
                return h > 0 ? `${h}h ${m}m` : `${m}m`;
            };

            const domainList = topDomains.map(d => `- ${d.domain}: ${formatSeconds(d.seconds)}`).join('\n');

            const totalFocus = formatSeconds(activity.productiveSeconds);
            const totalDistraction = formatSeconds(activity.distractingSeconds);
            const totalTime = formatSeconds(activity.totalSeconds);

            const contextSwitches = sessions.reduce((acc: number, s: any) => acc + (s.metrics?.contextSwitchCount || 0), 0);
            const maxFlow = formatSeconds(
                sessions.reduce((acc: number, s: any) => Math.max(acc, s.metrics?.flowDuration || 0), 0)
            );

            // 4. Generate Narrative
            const prompt = `
            You are the "Personal Growth Librarian" for MemoLink.
            The user has spent time on the web today (${date}). 
            Your job is to write a concise (2-3 sentences) but insightful summary for their journal.
            
            STATS:
            - Total Time Tracked: ${totalTime}
            - Deep Work / Productive: ${totalFocus}
            - Distraction / Entertainment: ${totalDistraction}
            - Context Switches: ${contextSwitches}
            - Longest Flow State: ${maxFlow}
            
            TOP DOMAINS:
            ${domainList}
            
            INSTRUCTIONS:
            - Focus on the balance between Deep Work and Distraction.
            - Mention significant domains (e.g. if they spent hours on GitHub, praise the progress).
            - If distraction was high, be encouraging but firm about "reclaiming time".
            - Avoid being robotic. Be conversational.
            - Use the first person "You".
          `;

            const summary = await LLMService.generateText(prompt, {
                workflow: 'web_activity_summary',
                userId,
            });

            // 4. Resolve Tags first
            const tag1 = await tagService.findOrCreateTag(userId, 'web-activity');
            const tag2 = await tagService.findOrCreateTag(userId, 'automatic-summary');

            // 5. Create Journal Entry
            await entryService.createEntry(userId, {
                content: summary,
                type: 'text',
                date: new Date(date),
                tags: [tag1._id.toString(), tag2._id.toString()],
                isPrivate: true,
                metadata: {
                    isPassiveSummary: true,
                    stats: {
                        totalTime,
                        totalFocus,
                        totalDistraction,
                        contextSwitches,
                        maxFlow
                    },
                    topDomains
                }
            });

            // 6. Mark as processed
            activity.summaryCreated = true;
            await activity.save();

            return { status: 'completed', result: { summaryCreated: true } };

        } catch (error: any) {
            logger.error(`Web activity summary failed for user ${userId}`, error);
            return { status: 'failed', error: error.message };
        }
    }
}

export const webActivityWorkflow = new WebActivityWorkflow();
