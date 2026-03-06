import DateUtil from './date.utils';

describe('DateUtil', () => {
    describe('getSessionId', () => {
        it('should return correct session IDs for each 4-hour window', () => {
            const date = new Date('2026-03-07T02:00:00'); // s0 (00-04)
            expect(DateUtil.getSessionId(date)).toContain('-s0');

            const date2 = new Date('2026-03-07T05:00:00'); // s1 (04-08)
            expect(DateUtil.getSessionId(date2)).toContain('-s1');

            const date3 = new Date('2026-03-07T10:00:00'); // s2 (08-12)
            expect(DateUtil.getSessionId(date3)).toContain('-s2');

            const date4 = new Date('2026-03-07T14:00:00'); // s3 (12-16)
            expect(DateUtil.getSessionId(date4)).toContain('-s3');

            const date5 = new Date('2026-03-07T18:00:00'); // s4 (16-20)
            expect(DateUtil.getSessionId(date5)).toContain('-s4');

            const date6 = new Date('2026-03-07T22:00:00'); // s5 (20-24)
            expect(DateUtil.getSessionId(date6)).toContain('-s5');
        });

        it('should use current date if none provided', () => {
            const sid = DateUtil.getSessionId();
            expect(sid).toMatch(/^\d{4}-\d{2}-\d{2}-s\d$/);
        });
    });
});
