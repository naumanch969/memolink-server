import { logger } from '../../config/logger';
import { LLMService } from '../../core/llm/LLMService';
import DateManager from '../../core/utils/DateManager';
import { entryService } from '../entry/entry.service';
import { goalService } from '../goal/goal.service';
import reminderService from '../reminder/reminder.service';
import webActivityService from '../web-activity/web-activity.service';

export class BriefingService {
    async getDailyBriefing(userId: string): Promise<string> {
        try {
            const now = new Date();
            const twoDaysAgo = new Date();
            twoDaysAgo.setDate(now.getDate() - 2);

            const [entriesData, upcomingReminders, overdueReminders, goals, webActivity] = await Promise.all([
                entryService.searchEntries(userId, { dateFrom: twoDaysAgo.toISOString(), limit: 5 }),
                reminderService.getUpcomingReminders(userId, 15),
                reminderService.getOverdueReminders(userId),
                goalService.getGoals(userId, {}),
                webActivityService.getTodayStats(userId, DateManager.getYesterdayDateKey())
            ]);

            const entries = entriesData.entries || [];
            const todayStr = now.toDateString();

            const todayReminders: any[] = [];
            const futureReminders: any[] = [];

            (upcomingReminders || []).forEach((r: any) => {
                const rDate = new Date(r.date).toDateString();
                if (rDate === todayStr) {
                    todayReminders.push(r);
                } else {
                    futureReminders.push(r);
                }
            });

            const entryContext = entries.map(e => `- [${new Date(e.date).toLocaleDateString()}] ${e.content}`).join('\n');
            const goalContext = goals.map(g => `- ${g.title} (${g.status})`).join('\n');
            const overdueContext = (overdueReminders || []).map((r: any) => `- [OVERDUE: ${new Date(r.date).toLocaleDateString()}] ${r.title}`).join('\n');
            const todayContext = todayReminders.map(r => `- [TODAY] ${r.title} ${r.startTime ? `@ ${r.startTime}` : '(All Day)'}`).join('\n');
            const futureContext = futureReminders.map(r => `- [${new Date(r.date).toLocaleDateString()}] ${r.title} ${r.startTime ? `@ ${r.startTime}` : ''}`).join('\n');

            let activityContext = "No web activity tracked for yesterday.";
            if (webActivity && webActivity.totalSeconds > 0) {
                const h = Math.floor(webActivity.totalSeconds / 3600);
                const m = Math.floor((webActivity.totalSeconds % 3600) / 60);
                const focus = Math.round((webActivity.productiveSeconds / webActivity.totalSeconds) * 100);
                activityContext = `Tracked ${h}h ${m}m of web activity yesterday. Focus Score: ${focus}%.`;

                const top3 = Object.entries(webActivity.domainMap || {})
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 3)
                    .map(([d, s]) => `${d.replace(/__dot__/g, '.')}(${Math.round(s / 60)}m)`)
                    .join(', ');
                activityContext += ` Top sites: ${top3}.`;
            }

            const prompt = `
            You are the "Chief of Staff" for a user in the MemoLink application.
            It is currently ${now.toDateString()}. 
            
            Based on the following data, provide a structured daily briefing.
            
            CRITICAL INSTRUCTIONS:
            1. **Tone**: DIRECT, PROACTIVE, and EFFICIENT. No fluff.
            2. **Structure**:
               - **Greeting**: functional (e.g., "Good morning.").
               - **Today's Mission**: List essential tasks for TODAY. Check RECENT LOGS for "Plan for Tomorrow".
               - **Goal Pulse**: succinct reminder of active goals.
               - **Activity Insight**: Briefly mention yesterday's web activity and offer one tactical coaching tip.
               - **Daily Boost**: A short quote.
            
            DATA:
            RECENT LOGS:
            ${entryContext || 'No recent logs.'}
            WEB ACTIVITY YESTERDAY:
            ${activityContext}
            OVERDUE TASKS:
            ${overdueContext || 'None.'}
            SCHEDULE FOR TODAY:
            ${todayContext || 'No specific tasks scheduled for today.'}
            UPCOMING:
            ${futureContext || 'No upcoming tasks found.'}
            ACTIVE GOALS:
            ${goalContext || 'No active goals - Encourage them to set one!'}
            `;

            return await LLMService.generateText(prompt);
        } catch (error) {
            logger.error('Failed to generate daily briefing', error);
            return "Good morning. I was unable to compile your full briefing at this time.";
        }
    }
}

export const briefingService = new BriefingService();
