import { logger } from '../../config/logger';
import { User } from '../auth/auth.model';
import { getEmailQueue } from '../email/queue/email.queue';
import { IReport, ReportType } from './report.types';

// ─── HTML Templates ───────────────────────────────────────────────────────────

const BRAND_COLOR = '#7C5CFC';         // Indigo primary
const BRAND_DARK = '#0E0E12';
const SURFACE = '#1A1A22';
const TEXT_PRIMARY = '#F8F8FF';
const TEXT_MUTED = '#888899';

function baseLayout(title: string, preheader: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${BRAND_DARK}; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color: ${TEXT_PRIMARY}; }
  a { color: ${BRAND_COLOR}; text-decoration: none; }
  .card { background: ${SURFACE}; border-radius: 16px; padding: 32px; margin: 0 auto; max-width: 600px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: ${TEXT_MUTED}; }
  .score-pill { display: inline-block; padding: 6px 18px; background: rgba(124,92,252,0.15); border-radius: 100px; color: ${BRAND_COLOR}; font-weight: 900; font-size: 28px; }
  .divider { border: none; border-top: 1px solid #2A2A38; margin: 24px 0; }
  .truth { border-left: 3px solid #F59E0B; padding: 10px 14px; background: rgba(245,158,11,0.07); border-radius: 0 8px 8px 0; margin-bottom: 8px; font-size: 14px; color: ${TEXT_PRIMARY}; line-height: 1.5; }
  .win  { border-left: 3px solid #10B981; padding: 10px 14px; background: rgba(16,185,129,0.07); border-radius: 0 8px 8px 0; margin-bottom: 8px; font-size: 14px; color: ${TEXT_PRIMARY}; line-height: 1.5; }
  .cta  { display: inline-block; margin-top: 28px; padding: 14px 32px; background: ${BRAND_COLOR}; color: #fff; border-radius: 100px; font-weight: 700; font-size: 15px; }
  .footer { text-align: center; font-size: 12px; color: ${TEXT_MUTED}; padding: 24px 0 16px; }
</style>
</head>
<body>
<div style="padding: 32px 16px;">
  <!-- Preheader (hidden, for email clients) -->
  <div style="display:none;max-height:0;overflow:hidden;">${preheader}&#847; &zwnj;&nbsp;&#847; &zwnj;&nbsp;</div>

  <!-- Header -->
  <div style="text-align:center;margin-bottom:24px;">
    <span style="font-size:22px;font-weight:900;color:${BRAND_COLOR};letter-spacing:-0.5px;">Memolink</span>
  </div>

  ${body}

  <div class="footer">
    You're receiving this because you have report notifications enabled.<br/>
    <a href="{{FRONTEND_URL}}/settings">Manage notification preferences</a>
  </div>
</div>
</body>
</html>`;
}

function buildWeeklyEmailHtml(content: any, period: string, frontendUrl: string): string {
    const headline = content?.headline ?? 'Your Weekly Report is Ready';
    const summary = (content?.periodNarrative ?? content?.periodSummary ?? '').substring(0, 300);
    const score = content?.alignmentScore ?? content?.score ?? null;
    const singleBestBet = content?.singleBestBet ?? content?.nextWeekFocus ?? '';
    const hardTruth = content?.hardTruths?.[0] ?? content?.areasForImprovement?.[0] ?? '';
    const topTags = (content?.stats?.topTags ?? []).slice(0, 5).join('  ·  ');
    const reportUrl = `${frontendUrl}/reports/weekly`;

    const body = `
  <div class="card">
    <div class="label">${period}</div>
    <h1 style="font-size:22px;font-weight:900;margin:12px 0 6px;line-height:1.3;">${headline}</h1>
    ${score !== null ? `<div class="score-pill">${score}</div><span style="font-size:13px;color:${TEXT_MUTED};margin-left:10px;vertical-align:middle;">/ 100 alignment</span>` : ''}

    <hr class="divider"/>

    ${summary ? `<p style="font-size:15px;line-height:1.7;color:rgba(248,248,255,0.85);margin-bottom:20px;">${summary}</p>` : ''}

    ${hardTruth ? `
    <div class="label" style="margin-bottom:8px;">This Week's Hard Truth</div>
    <div class="truth">${hardTruth}</div>
    ` : ''}

    ${singleBestBet ? `
    <hr class="divider"/>
    <div class="label" style="margin-bottom:8px;">Your Single Best Bet Next Week</div>
    <p style="font-size:15px;font-weight:700;color:${TEXT_PRIMARY};line-height:1.5;">"${singleBestBet}"</p>
    ` : ''}

    ${topTags ? `<p style="margin-top:20px;font-size:12px;color:${TEXT_MUTED};">${topTags}</p>` : ''}

    <a href="${reportUrl}" class="cta">Read Full Report →</a>
  </div>`;

    return baseLayout(headline, `${headline} · Score ${score ?? ''}`, body).replace('{{FRONTEND_URL}}', frontendUrl);
}

function buildMonthlyEmailHtml(content: any, period: string, frontendUrl: string): string {
    const monthTitle = content?.monthTitle ?? 'Your Monthly Report is Ready';
    const summary = (content?.executiveSummary ?? content?.monthOverview ?? '').substring(0, 400);
    const score = content?.overallScore ?? content?.score ?? null;
    const hardTruths: string[] = (content?.hardTruths ?? []).slice(0, 2);
    const topWin = content?.documentedWins?.[0]?.win ?? content?.achievements?.[0] ?? '';
    const topWinEvidence = content?.documentedWins?.[0]?.evidence ?? '';
    const contract = content?.nextMonthContract;
    const reportUrl = `${frontendUrl}/reports/monthly`;

    const hardTruthsHtml = hardTruths.map(t => `<div class="truth">${t}</div>`).join('');
    const winHtml = topWin ? `
    <div class="label" style="margin-bottom:8px;color:#10B981;">Top Win This Month</div>
    <div class="win">${topWin}${topWinEvidence ? `<br/><span style="font-size:12px;opacity:0.7;margin-top:4px;display:block;">${topWinEvidence}</span>` : ''}</div>` : '';

    const contractHtml = contract?.themeSentence ? `
    <hr class="divider"/>
    <div class="label" style="margin-bottom:8px;">Your Contract for Next Month</div>
    <p style="font-size:16px;font-weight:700;color:${TEXT_PRIMARY};font-style:italic;line-height:1.5;">"${contract.themeSentence}"</p>
    ` : '';

    const body = `
  <div class="card">
    <div class="label">${period} · Monthly Synthesis</div>
    <h1 style="font-size:24px;font-weight:900;margin:12px 0 6px;line-height:1.25;">${monthTitle}</h1>
    ${score !== null ? `<div class="score-pill">${score}</div><span style="font-size:13px;color:${TEXT_MUTED};margin-left:10px;vertical-align:middle;">/ 100 alignment</span>` : ''}

    <hr class="divider"/>

    ${summary ? `<p style="font-size:15px;line-height:1.7;color:rgba(248,248,255,0.85);margin-bottom:20px;">${summary}</p>` : ''}

    ${winHtml}

    ${hardTruths.length > 0 ? `
    <hr class="divider"/>
    <div class="label" style="margin-bottom:8px;">Hard Truths</div>
    ${hardTruthsHtml}
    ` : ''}

    ${contractHtml}

    <a href="${reportUrl}" class="cta">Read Full Report →</a>
  </div>`;

    return baseLayout(monthTitle, `${monthTitle} · Your ${period} Reckoning`, body).replace('{{FRONTEND_URL}}', frontendUrl);
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ReportEmailService {

    async sendReportReadyEmail(report: IReport): Promise<void> {
        const userId = report.userId.toString();
        const user = await User.findById(userId).select('email name preferences').lean();
        if (!user?.email) {
            logger.debug(`[ReportEmailService] No email for user ${userId} — skipping`);
            return;
        }

        // Respect notification preferences
        if (user.preferences?.notifications === false) {
            logger.debug(`[ReportEmailService] Email notifications disabled for user ${userId}`);
            return;
        }

        const frontendUrl = process.env.FRONTEND_URL ?? 'https://app.memolink.ai';
        const period = this.formatPeriod(report.startDate, report.endDate);

        let subject: string;
        let html: string;

        if (report.type === ReportType.WEEKLY) {
            const score = report.content?.alignmentScore ?? report.content?.score ?? null;
            const headline = report.content?.headline ?? 'Your Weekly Report is Ready';
            subject = score !== null
                ? `📊 ${headline} — Score: ${score}/100`
                : `📊 ${headline}`;
            html = buildWeeklyEmailHtml(report.content, period, frontendUrl);
        } else {
            const monthTitle = report.content?.monthTitle ?? "Your Monthly Reckoning is Ready";
            const score = report.content?.overallScore ?? report.content?.score ?? null;
            subject = score !== null
                ? `📅 ${monthTitle} — Score: ${score}/100`
                : `📅 ${monthTitle}`;
            html = buildMonthlyEmailHtml(report.content, period, frontendUrl);
        }

        try {
            const queue = getEmailQueue();
            await queue.add(`report-email-${report.type}-${userId}-${Date.now()}`, {
                type: 'GENERIC',
                data: { to: user.email, subject, html },
            });
            logger.info(`[ReportEmailService] ${report.type} email queued for user ${userId}`);
        } catch (error) {
            // Non-fatal: log and continue — report is already saved
            logger.error(`[ReportEmailService] Failed to queue email for user ${userId}`, error);
        }
    }

    private formatPeriod(startDate: Date, endDate: Date): string {
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `${fmt(new Date(startDate))} – ${fmt(new Date(endDate))}`;
    }
}

export const reportEmailService = new ReportEmailService();
