
/**
 * Badge Achievement Email Templates
 * Designed to feel premium, high-fidelity, and human.
 * Inspired by Brinn's modern web aesthetics: Bold typography, crisp borders, and refined gradients.
 */

interface CustomBadgeContent {
    headline: string;
    subtext: string;
    accentColor: string;
}

const CUSTOM_CONTENT: Record<string, CustomBadgeContent> = {
    founding_customer: {
        headline: "You're one of<br><em>fifty.</em>",
        subtext: "When we opened Brinn on April 13th, you were one of the first people through the door. That means something to us.",
        accentColor: "#F59E0B", // Amber (Legendary)
    },
    early_adopter: {
        headline: "Ahead of the<br><em>curve.</em>",
        subtext: "You joined Brinn when it was still a whisper. You're part of the reason it's growing.",
        accentColor: "#A855F7", // Purple (Epic)
    },
    beta_tester: {
        headline: "Shape of things<br><em>to come.</em>",
        subtext: "Your feedback helped build this foundation. You were here when it was just an idea.",
        accentColor: "#3B82F6", // Blue (Rare)
    },
    first_thought: {
        headline: "The first<br><em>spark.</em>",
        subtext: "Every great mind starts with a single thought. You've just taken your first step.",
        accentColor: "#94A3B8", // Slate (Common)
    },
    memory_keeper: {
        headline: "Building your<br><em>knowledge.</em>",
        subtext: "100 entries. You're no longer just capturing data — you're building a reservoir of personal wisdom.",
        accentColor: "#10B981", // Emerald (Uncommon)
    },
    deep_archivist: {
        headline: "The wisdom<br><em>collector.</em>",
        subtext: "500 memories. Your vault is becoming a library of your life's journey.",
        accentColor: "#3B82F6",
    },
    mind_vault: {
        headline: "Titan of<br><em>memory.</em>",
        subtext: "1,000 thoughts captured. Brinn is now a living extension of your self.",
        accentColor: "#A855F7",
    },
    pattern_spotter: {
        headline: "Mirror of the<br><em>mind.</em>",
        subtext: "Brinn has surfaced your first AI insight. You're starting to see your patterns from the outside in.",
        accentColor: "#10B981",
    },
    recall_master: {
        headline: "Master of the<br><em>past.</em>",
        subtext: "50 semantic searches. You don't just store memories; you navigate them with precision.",
        accentColor: "#3B82F6",
    },
    self_aware: {
        headline: "Threshold of<br><em>being.</em>",
        subtext: "Your mental model is complete. You have been deeply understood by your digital reflection.",
        accentColor: "#A855F7",
    },
    streak_thinker: {
        headline: "Unstoppable<br><em>habit.</em>",
        subtext: "7 days of consistency. You've turned reflection into a daily ritual.",
        accentColor: "#10B981",
    },
    loyal_mind: {
        headline: "A month of<br><em>clarity.</em>",
        subtext: "30 days with Brinn. You've committed to a better way of remembering.",
        accentColor: "#3B82F6",
    },
    devoted_mind: {
        headline: "Quarter-year of<br><em>growth.</em>",
        subtext: "90 days. Brinn has become part of how you process the world.",
        accentColor: "#A855F7",
    },
    voice_thinker: {
        headline: "Speed of<br><em>thought.</em>",
        subtext: "25 voice notes. Your mind moves faster than fingers, and Brinn is keeping up.",
        accentColor: "#10B981",
    },
    network_builder: {
        headline: "Graph of<br><em>connection.</em>",
        subtext: "10 people tracked. You're building a network of how others shape your perspective.",
        accentColor: "#10B981",
    },
    mcp_pioneer: {
        headline: "Bridge to your<br><em>tools.</em>",
        subtext: "You've connected Brinn to your AI assistance. Your knowledge is now truly portable.",
        accentColor: "#A855F7",
    }
};

export const getBadgeUnlockedEmailTemplate = (
    userName: string,
    badgeName: string,
    badgeDescription: string,
    badgeId: string,
    rarity: string
) => {
    const frontendUrl = process.env.FRONTEND_URL || 'https://brinn.app';
    const content = CUSTOM_CONTENT[badgeId] || {
        headline: "A new milestone achieved.",
        subtext: "Your vault is growing. You've just unlocked a new piece of your Brinn identity.",
        accentColor: "#6366f1"
    };

    const iconUrl = `${frontendUrl}/images/badges/${badgeId}.png`;
    const subject = badgeId === 'founding_customer' ? "You're one of 50." : `🎉 New Achievement: ${badgeName}`;
    const accent = content.accentColor;

    return {
        subject,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
                <style>
                    :root { color-scheme: light dark; supported-color-schemes: light dark; }
                    body { margin: 0; padding: 0; background-color: #f8fafc; }
                    .email-shell { background: #f8fafc; padding: 48px 10px; text-align: center; }
                    .email-card {
                        background: #ffffff;
                        border: 0.5px solid #e2e8f0;
                        border-radius: 12px;
                        max-width: 520px;
                        width: 100%;
                        margin: 0 auto;
                        overflow: hidden;
                        text-align: left;
                        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    }
                    .email-header { padding: 32px 40px; border-bottom: 0.5px solid #f1f5f9; }
                    .brinn-mark {
                        font-family: 'DM Sans', sans-serif;
                        font-size: 13px;
                        font-weight: 500;
                        color: ${accent};
                        letter-spacing: 0.12em;
                        text-transform: uppercase;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        text-decoration: none;
                    }
                    .brinn-dot { width: 6px; height: 6px; border-radius: 50%; background: ${accent}; display: inline-block; margin-right: 8px; }
                    .email-body { padding: 48px 40px 40px; }
                    .badge-ring {
                        width: 80px;
                        height: 80px;
                        border-radius: 50%;
                        border: 1px solid ${accent};
                        display: flex; align-items: center; justify-content: center;
                        margin-bottom: 32px; position: relative;
                        background: rgba(0,0,0,0.02);
                    }
                    .badge-icon-img { width: 44px; height: 44px; display: block; }
                    .email-eyebrow {
                        font-family: 'DM Sans', sans-serif;
                        font-size: 11px;
                        font-weight: 400;
                        letter-spacing: 0.18em;
                        text-transform: uppercase;
                        color: ${accent};
                        margin: 0 0 12px 0;
                    }
                    .email-headline {
                        font-family: 'Cormorant Garamond', Georgia, serif;
                        font-size: 38px; font-weight: 600; color: #0f172a;
                        line-height: 1.15; margin: 0 0 24px 0; letter-spacing: -0.01em;
                    }
                    .email-headline em { font-style: italic; color: ${accent}; }
                    .divider { width: 40px; height: 1px; background: #e2e8f0; margin-bottom: 24px; }
                    .email-body-text {
                        font-family: 'DM Sans', sans-serif;
                        font-size: 15px; font-weight: 300; color: #475569;
                        line-height: 1.8; margin: 0 0 20px 0;
                    }
                    .badge-pill {
                        display: table; background: rgba(0,0,0,0.01);
                        border: 0.5px solid #e2e8f0; border-radius: 999px;
                        padding: 8px 16px; margin: 24px 0 32px;
                    }
                    .pill-dot { width: 5px; height: 5px; border-radius: 50%; background: ${accent}; display: inline-block; margin-right: 8px; vertical-align: middle; }
                    .pill-label {
                        font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 500;
                        color: ${accent}; letter-spacing: 0.04em; display: inline-block; vertical-align: middle;
                    }
                    .cta-button {
                        display: inline-block; background: ${accent}; color: #ffffff !important;
                        font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600;
                        letter-spacing: 0.12em; text-transform: uppercase;
                        padding: 16px 32px; border-radius: 4px; text-decoration: none; margin-bottom: 40px;
                    }
                    .email-sign { font-family: 'Cormorant Garamond', Georgia, serif; font-style: italic; font-size: 18px; color: #64748b; margin: 24px 0 0 0; }
                    .email-footer { padding: 24px 40px; border-top: 0.5px solid #f1f5f9; background: #f8fafc; }
                    .footer-text { font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 300; color: #94a3b8; letter-spacing: 0.1em; text-transform: uppercase; }

                    @media (prefers-color-scheme: dark) {
                        body, .email-shell, .email-footer { background-color: #09090b !important; }
                        .email-card { background-color: #141416 !important; border-color: #27272a !important; }
                        .email-header, .divider, .badge-pill { border-color: #27272a !important; }
                        .email-headline { color: #f8fafc !important; }
                        .email-body-text, .email-sign { color: #94a3b8 !important; }
                        .footer-text { color: #475569 !important; }
                        .badge-ring { background-color: rgba(255,255,255,0.02) !important; border-color: ${accent} !important; }
                        .badge-pill { background-color: rgba(255,255,255,0.03) !important; }
                        .cta-button { color: #09090b !important; }
                    }

                </style>
            </head>
            <body>
                <div class="email-shell">
                    <div class="email-card">
                        <div class="email-header">
                            <a href="${frontendUrl}" class="brinn-mark">
                                <span class="brinn-dot"></span>
                                BRINN
                            </a>
                        </div>
                        <div class="email-body">
                            <div class="badge-ring">
                                <img src="${iconUrl}" class="badge-icon-img" alt="${badgeName}">
                            </div>
                            <p class="email-eyebrow">Achievement Unlocked</p>
                            <h1 class="email-headline">${content.headline}</h1>
                            <div class="divider"></div>
                            <p class="email-body-text">${content.subtext}</p>
                            <div class="badge-pill">
                                <span class="pill-dot"></span>
                                <span class="pill-label">${badgeName} — ${rarity} Milestone</span>
                            </div>
                            <a href="${frontendUrl}/achievements" class="cta-button">View Achievement</a>
                            <p class="email-body-text" style="font-size: 14px;">Thank you for following your curiosity.</p>
                            <p class="email-sign">— The Brinn team</p>
                        </div>
                        <div class="email-footer">
                            <span class="footer-text">Brinn · You Think. Brinn Remembers</span>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `
    };
};

