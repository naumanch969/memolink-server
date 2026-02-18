import mongoose from 'mongoose';
import cron from 'node-cron';
import { logger } from '../../config/logger';
import { Challenge } from '../challenge/challenge.model';
import notificationDispatcher from '../notification/notification.dispatcher';
import { NotificationType } from '../notification/notification.types';
import { ScheduleAction, ScheduleStatus } from './schedule.interfaces';
import { Schedule } from './schedule.model';

let isRunning = false;

export const processSchedules = async () => {
    if (isRunning) return;

    // Safety check: Don't process if database isn't connected
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    isRunning = true;

    try {
        const now = new Date();
        const batchSize = 20;
        let processedCount = 0;

        while (processedCount < batchSize) {
            const schedule = await Schedule.findOneAndUpdate(
                {
                    status: ScheduleStatus.ACTIVE,
                    nextRunAt: { $lte: now }
                },
                {
                    $set: { status: ScheduleStatus.PAUSED } // Temp lock
                },
                {
                    new: true,
                    sort: { nextRunAt: 1 }
                }
            );

            if (!schedule) break;
            processedCount++;

            try {
                // Execute Action
                if (schedule.action === ScheduleAction.SEND_PUSH_NOTIFICATION) {
                    let title = schedule.payload.title;
                    let body = schedule.payload.body;

                    // Context-Aware Nudging Logic
                    if (schedule.type === 'challenge' && schedule.referenceModel === 'Challenge') {
                        const challenge = await Challenge.findById(schedule.referenceId);
                        if (challenge) {
                            const diffTime = Math.abs(now.getTime() - challenge.startDate.getTime());
                            const dayIndex = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

                            // Dynamic Title
                            title = `Day ${dayIndex}/${challenge.duration}: ${challenge.title}`;

                            // Dynamic Body (Aggressive/Contextual)
                            if (challenge.stats.currentStreak >= 5) {
                                body = `🔥 ${challenge.stats.currentStreak} day streak! You're crushing it. Don't stop now.`;
                            } else if (challenge.stats.missedDays > 0) {
                                body = `You've missed ${challenge.stats.missedDays} days. Today is the perfect day to bounce back.`;
                            } else if (dayIndex === Math.floor(challenge.duration / 2)) {
                                body = `🏁 Halfway there! You've already proven you can do this.`;
                            }
                        }
                    }

                    await notificationDispatcher.dispatch({
                        userId: schedule.userId.toString(),
                        type: NotificationType.REMINDER,
                        title,
                        message: body,
                        referenceId: schedule.referenceId?.toString(),
                        referenceModel: schedule.referenceModel,
                        // actionUrl can be added here if we want deep linking
                        eventId: `schedule-${schedule._id}-${now.toDateString()}`
                    });
                }

                // Calculate Next Run or Complete
                if (schedule.cronExpression) {
                    // For now, assuming daily schedules based on cron. 
                    // In a production app, we'd use a library like 'cron-parser' here.
                    const next = new Date(schedule.nextRunAt);
                    next.setDate(next.getDate() + 1);

                    schedule.nextRunAt = next;
                    schedule.status = ScheduleStatus.ACTIVE;
                } else {
                    schedule.status = ScheduleStatus.COMPLETED;
                }

                await schedule.save();

            } catch (err: any) {
                logger.error(`Failed to process schedule record ${schedule._id}`, err);
                schedule.status = ScheduleStatus.ACTIVE; // Put back for retry
                await schedule.save();
            }
        }

        if (processedCount > 0) {
            logger.info(`[ScheduleProcessor] Processed ${processedCount} schedules.`);
        }
    } catch (error) {
        logger.error('Error in Schedule Processor:', error);
    } finally {
        isRunning = false;
    }
};

export const initScheduleProcessor = () => {
    logger.info('Initializing Generic Schedule Processor (Every Minute)...');
    // Run every minute
    cron.schedule('* * * * *', processSchedules);
};
