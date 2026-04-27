
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

enum ReportType {
    WEEKLY = 'WEEKLY',
    MONTHLY = 'MONTHLY'
}

function generatePeriods(joinDate: Date, now: Date, type: ReportType) {
    const periods: { startDate: Date; endDate: Date }[] = [];
    const current = type === ReportType.MONTHLY 
        ? startOfMonth(now) 
        : startOfWeek(now, { weekStartsOn: 1 });
        
    const minDate = type === ReportType.MONTHLY
        ? startOfMonth(joinDate)
        : startOfWeek(joinDate, { weekStartsOn: 1 });

    console.log(`Join Date: ${joinDate.toISOString()}`);
    console.log(`Now: ${now.toISOString()}`);
    console.log(`Min Date: ${minDate.toISOString()}`);
    console.log(`Initial Current: ${current.toISOString()}`);

    while (current >= minDate) {
        const startDate = new Date(current);
        const endDate = type === ReportType.MONTHLY 
            ? endOfMonth(current) 
            : endOfWeek(current, { weekStartsOn: 1 });
        
        periods.push({ startDate, endDate });
        
        // Move back
        if (type === ReportType.MONTHLY) {
            current.setMonth(current.getMonth() - 1);
        } else {
            current.setDate(current.getDate() - 7);
        }
    }
    return periods;
}

const joinDate = new Date('2026-03-03T10:00:00Z');
const now = new Date('2026-04-27T10:00:00Z');

console.log('--- WEEKLY ---');
const weeklyPeriods = generatePeriods(joinDate, now, ReportType.WEEKLY);
weeklyPeriods.forEach(p => console.log(`${p.startDate.toISOString()} - ${p.endDate.toISOString()}`));

console.log('\n--- MONTHLY ---');
const monthlyPeriods = generatePeriods(joinDate, now, ReportType.MONTHLY);
monthlyPeriods.forEach(p => console.log(`${p.startDate.toISOString()} - ${p.endDate.toISOString()}`));
