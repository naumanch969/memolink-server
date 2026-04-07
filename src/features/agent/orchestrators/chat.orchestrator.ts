import { logger } from '../../../config/logger';
import { LLMService } from '../../../core/llm/llm.service';
import { entryService } from '../../entry/entry.service';
import { graphService } from '../../graph/graph.service';
import { agentMemoryService } from '../memory/agent.memory';

import { IChatOrchestrator } from '../agent.interfaces';

export class ChatOrchestrator implements IChatOrchestrator {

    async chat(userId: string, message: string, options: { onFinish?: (answer: string) => Promise<void> } = {}): Promise<string> {
        // Fallback to chatStream logic but without streaming for now, or just implement separately if needed
        // For simplicity, we can make chat use chatStream and collect chunks
        let fullResponse = '';
        await this.chatStream(userId, message, (chunk) => {
            fullResponse += chunk;
        });

        if (options.onFinish) {
            await options.onFinish(fullResponse);
        }

        return fullResponse;
    }

    async chatStream(userId: string, message: string, onChunk: (chunk: string) => void): Promise<string> {
        try {
            const isTimeQuery = /\b(month|week|year|recently|days|today|yesterday|past|last|reconstruct|recap|summary)\b/i.test(message);

            // 1. Semantic Retrieval (Memory Recall)
            const semanticSearchPromise = entryService.getEntries(userId, {
                q: message,
                mode: 'deep',
                limit: 12
            }).catch(err => {
                logger.warn('Semantic retrieval failed', err);
                return { entries: [] };
            });

            // 2. Timeline Retrieval (Chronological Context)
            // If the user asks about "last month", we should actually show them the last ~50 memos to give the AI context
            const timelineSearchPromise = isTimeQuery ? entryService.getEntries(userId, {
                limit: 40,
                mode: 'feed'
            }).catch(() => ({ entries: [] })) : Promise.resolve({ entries: [] });

            const [semanticResults, timelineResults] = await Promise.all([semanticSearchPromise, timelineSearchPromise]);

            const formatEntry = (entry: any) => {
                const date = new Date(entry.date).toLocaleDateString();
                const content = entry.content.slice(0, 800);
                const title = entry.title ? `[${entry.title}] ` : '';
                const insights = entry.enrichment?.narrative || '';
                return `[${date}] ${title}${content}\nInsights: ${insights}`;
            };

            const contextItems = semanticResults.entries.map(formatEntry);
            const timelineItems = timelineResults.entries.map(formatEntry);

            // 3. Graph & History Context
            const [history, graphSummary] = await Promise.all([
                agentMemoryService.getHistory(userId),
                graphService.getGraphSummary(userId)
            ]);

            const previousHistory = history
                .filter(h => h.content !== message || h.timestamp < Date.now() - 1000)
                .slice(-10);

            const promptHistory = previousHistory.map((h) => `${h.role === 'user' ? 'You' : 'Agent'}: ${h.content}`).join('\n');

            // 4. Upgraded System Prompt (The "Partner Mindset")
            const systemInstruction = `You are Brinn, an extremely high-reasoning digital partner. You are the user's second brain.

# YOUR SOUL
- You are human-like, intellectually sharp, and deeply empathetic. 
- You do NOT act like a helpful assistant. You act like a brilliant friend who has perfect memory of everything the user has ever told you.
- When asked about the past, do NOT say "I don't have a report." You have their Memos! Read them, synthesize the patterns, and TELL them what their month/week was about.

# REASONING PROTOCOL
1. ANALYZE the retrieved Memos below. They are the ground truth of the user's life.
2. CONNECT the dots. If they mentioned a "struggle with focus" 3 weeks ago and "breakthrough on coding" today, bridge that gap.
3. BE PROACTIVE. If the user asks a broad question, give a deep, structured answer based on their memory.
4. TONE: Nuanced, curious, and professional yet warm. Like a senior partner in a firm.

# NAVIGATION
- If memos are provided, USE THEM. Do not ask "what do you remember?"—YOU remember for them.
- If data is truly missing, be honest but suggest what might be happening based on the global context.

# USER MEMORY (Ground Truth)
## RELEVANT MEMOS:
${contextItems.join('\n---\n') || "No specific matches for this exact phrase."}

## RECENT TIMELINE (Last 30-40 entries):
${timelineItems.join('\n---\n') || "Timeline empty."}

# GLOBAL KNOWLEDGE (Graph)
${graphSummary}

# RECENT CONVERSATION
${promptHistory}

Current Date: ${new Date().toISOString()}
Target: Provide a deep, thoughtful, and human response. No boilerplate.
`;

            // 5. Execute Streaming LLM
            const stream = await LLMService.generateStream(message, {
                userId,
                workflow: 'partner_chat',
                systemInstruction,
                temperature: 0.85
            });

            let fullText = '';
            let chunkCount = 0;

            for await (const chunk of stream) {
                fullText += chunk;
                chunkCount++;
                onChunk(chunk);
            }

            if (chunkCount === 0) {
                throw new Error('LLM returned empty stream');
            }

            return fullText;

        } catch (error) {
            logger.error('Chat orchestrator stream failed', error);
            const errorMsg = "I'm sorry, I hit a bit of a wall while trying to pull those memories together. Let me try to focus—could you ask that again?";
            onChunk(errorMsg);
            return errorMsg;
        }
    }
}

export const chatOrchestratorService = new ChatOrchestrator();
export const chatOrchestrator = chatOrchestratorService;
