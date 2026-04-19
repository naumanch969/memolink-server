
/**
 * Badge Achievement Email Templates
 * Designed to match Brinn platform aesthetics (OKLCH, modern typography, sleek layout)
 */

interface CustomBadgeContent {
    headline: string;
    subtext: string;
    accentColor: string;
}

const CUSTOM_CONTENT: Record<string, CustomBadgeContent> = {
    founding_customer: {
        headline: "You're one of 50.",
        subtext: "When we opened Brinn on April 13th, you were one of the first people through the door. That means something to us.",
        accentColor: "#f97316", // Legendary Orange
    },
    early_adopter: {
        headline: "Ahead of the curve.",
        subtext: "You joined Brinn when it was still a whisper. You're part of the reason it's growing.",
        accentColor: "#a855f7", // Epic Purple
    },
    beta_tester: {
        headline: "Shape of things to come.",
        subtext: "Your feedback helped build this foundation. You were here when it was just an idea.",
        accentColor: "#3b82f6", // Rare Blue
    },
    first_thought: {
        headline: "The first spark.",
        subtext: "Every great mind starts with a single thought. You've just taken your first step.",
        accentColor: "#64748b", // Common Gray
    },
    memory_keeper: {
        headline: "Building a second brain.",
        subtext: "100 entries. You're no longer just capturing data — you're building a reservoir of wisdom.",
        accentColor: "#10b981", // Uncommon Green
    },
    deep_archivist: {
        headline: "The wisdom collector.",
        subtext: "500 memories. Your vault is becoming a library of your life's journey.",
        accentColor: "#3b82f6",
    },
    mind_vault: {
        headline: "Titan of memory.",
        subtext: "1,000 thoughts captured. Brinn is now a living extension of your consciousness.",
        accentColor: "#a855f7",
    },
    pattern_spotter: {
        headline: "Mirror of the mind.",
        subtext: "Brinn has surfaced your first AI insight. You're starting to see yourself from the outside in.",
        accentColor: "#10b981",
    },
    recall_master: {
        headline: "Master of the past.",
        subtext: "50 semantic searches. You don't just store memories; you navigate them with precision.",
        accentColor: "#3b82f6",
    },
    self_aware: {
        headline: "Threshold of being.",
        subtext: "Your mental model is complete. You have been deeply understood by your second brain.",
        accentColor: "#a855f7",
    },
    streak_thinker: {
        headline: "Unstoppable habit.",
        subtext: "7 days of consistency. You've turned reflection into a daily ritual.",
        accentColor: "#10b981",
    },
    loyal_mind: {
        headline: "A month of clarity.",
        subtext: "30 days with Brinn. You've committed to a better way of remembering.",
        accentColor: "#3b82f6",
    },
    devoted_mind: {
        headline: "Quarter-year of growth.",
        subtext: "90 days. Brinn has become part of how you process the world.",
        accentColor: "#a855f7",
    },
    voice_thinker: {
        headline: "Speed of thought.",
        subtext: "25 voice notes. Your mind moves faster than fingers, and Brinn is keeping up.",
        accentColor: "#10b981",
    },
    network_builder: {
        headline: "Graph of connection.",
        subtext: "10 people tracked. You're building a network of how others shape your perspective.",
        accentColor: "#10b981",
    },
    mcp_pioneer: {
        headline: "Bridge to the machines.",
        subtext: "You've connected Brinn to your AI assistance. Your knowledge is now truly portable.",
        accentColor: "#a855f7",
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
        headline: "Achievement Unlocked!",
        subtext: "You've just unlocked a new piece of your Brinn identity.",
        accentColor: "#6366f1"
    };

    const iconUrl = `${frontendUrl}/images/badges/${badgeId}.png`;
    const subject = badgeId === 'founding_customer' ? "You're one of 50." : `🎉 Achievement: ${badgeName}`;

    return {
        subject,
        html: `
            <div style="font-family: 'Geist Sans', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; color: #131724; background-color: #f8fafc; border-radius: 24px;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${content.accentColor}; background: ${content.accentColor}15; padding: 4px 10px; border-radius: 99px;">
                        ${rarity} Milestone
                    </span>
                </div>

                <div style="text-align: center; margin-bottom: 32px;">
                    <div style="display: inline-block; padding: 12px; border-radius: 20px; background: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                         <img src="${iconUrl}" alt="${badgeName}" style="width: 56px; height: 56px;">
                    </div>
                </div>
                
                <h1 style="font-size: 24px; font-weight: 900; letter-spacing: -0.025em; margin: 0 0 16px; text-align: center;">${content.headline}</h1>
                <p style="font-size: 16px; line-height: 1.6; color: #475569; text-align: center; margin: 0 0 32px;">${content.subtext}</p>
                
                <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; margin-bottom: 32px; text-align: left; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                    <div style="margin-bottom: 12px;">
                        <h3 style="margin: 0 0 4px; font-size: 16px; font-weight: 700; color: #0f172a;">${badgeName}</h3>
                        <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #64748b;">${badgeDescription}</p>
                    </div>
                </div>

                <div style="text-align: center; margin-bottom: 32px;">
                    <a href="${frontendUrl}/achievements" style="display: inline-block; background: #0f172a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 14px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.2);">Open Achievement Gallery</a>
                </div>

                <div style="text-align: center; margin-top: 40px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
                     <p style="font-size: 14px; font-weight: 600; color: #131724; margin: 0 0 8px;">— Brinn team</p>
                     <p style="font-size: 12px; color: #94a3b8; margin: 0;">Sent via achievement@brinn.app</p>
                </div>
            </div>
        `
    };
};
