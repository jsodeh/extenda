import { generateText } from '../lib/gemini.js';

export type IntentType = 'conversational' | 'simple_command' | 'workflow_request' | 'hybrid';

export interface IntentClassification {
    type: IntentType;
    confidence: number;
    tool?: string;              // For simple commands
    params?: any;               // For simple commands
    workflowIntent?: string;    // Extracted if type is workflow_request or hybrid
}

export class IntentClassifier {
    private guessUrl(target: string): string {
        const targetLower = target.toLowerCase().trim();

        // Common site shortcuts
        const shortcuts: Record<string, string> = {
            'gmail': 'https://mail.google.com',
            'google mail': 'https://mail.google.com',
            'calendar': 'https://calendar.google.com',
            'drive': 'https://drive.google.com',
            'docs': 'https://docs.google.com',
            'sheets': 'https://sheets.google.com',
            'slack': 'https://slack.com',
            'github': 'https://github.com',
            'linkedin': 'https://linkedin.com',
            'twitter': 'https://twitter.com',
            'youtube': 'https://youtube.com'
        };

        // Check shortcuts
        if (shortcuts[targetLower]) {
            return shortcuts[targetLower];
        }

        // If it looks like a URL already, return it
        if (targetLower.startsWith('http://') || targetLower.startsWith('https://')) {
            return target;
        }

        // If it has a domain extension, add https://
        if (targetLower.match(/\.(com|org|net|io|co|ai|dev)$/)) {
            return `https://${target}`;
        }

        // Default: treat as search query
        return `https://www.google.com/search?q=${encodeURIComponent(target)}`;
    }

    private simpleCommandMatch(message: string): IntentClassification | null {
        const lowerMsg = message.toLowerCase().trim();

        // Pattern: "open X" or "go to X" or "navigate to X"
        const openMatch = lowerMsg.match(/^(open|go to|navigate to|visit)\s+(.+)/i);
        if (openMatch) {
            const target = openMatch[2].trim();
            return {
                type: 'simple_command',
                confidence: 1.0,
                tool: 'TabManager',
                params: {
                    action: 'open',
                    url: this.guessUrl(target)
                }
            };
        }

        // Pattern: "close tab" or "close window"
        const closeMatch = lowerMsg.match(/^(close|exit)\s+(tab|window|this)/i);
        if (closeMatch) {
            return {
                type: 'simple_command',
                confidence: 1.0,
                tool: 'TabManager',
                params: {
                    action: 'close'
                }
            };
        }

        // Pattern: "show notification" or "notify me" or "alert me"
        const notifyMatch = lowerMsg.match(/^(show|display|notify|alert)(.+)/i);
        if (notifyMatch) {
            return {
                type: 'simple_command',
                confidence: 1.0,
                tool: 'Notifier',
                params: {
                    action: 'notify',
                    message: notifyMatch[2].trim()
                }
            };
        }

        return null;
    }

    private quickMatch(message: string): IntentClassification | null {
        const lowerMsg = message.toLowerCase().trim();
        const greetings = ['hi', 'hello', 'hey', 'greetings', 'sup', 'yo', 'thanks', 'thank you', 'ok', 'okay', 'great', 'cool'];

        // Exact matches or starts with greeting followed by punctuation only (e.g. "Hi!", "Hello.", "Hi there")
        if (greetings.some(g => lowerMsg === g || lowerMsg.match(new RegExp(`^${g}[!.?]*$`)) || lowerMsg === `hi there`)) {
            return {
                type: 'conversational',
                confidence: 1.0,
                workflowIntent: undefined
            };
        }
        return null;
    }

    async classify(message: string, conversationHistory: string[] = []): Promise<IntentClassification> {
        // 1. Try simple command match first for immediate execution
        const simpleResult = this.simpleCommandMatch(message);
        if (simpleResult) {
            console.log('Intent classified as simple command:', simpleResult.tool, simpleResult.params);
            return simpleResult;
        }

        // 2. Try quick match for conversational
        const quickResult = this.quickMatch(message);
        if (quickResult) {
            console.log('Intent classified via quick match:', quickResult.type);
            return quickResult;
        }

        const historyContext = conversationHistory.length > 0
            ? `\n\nRecent conversation:\n${conversationHistory.slice(-5).join('\n')}`
            : '';

        const prompt = `Classify the following user message as one of these intent types:
- "conversational": Greetings, thanks, acknowledgments, casual chat (e.g., "Hi", "Thank you", "How are you?")
- "workflow_request": Clear actionable task requests (e.g., "Create a Jira ticket", "Send an email to John")
- "hybrid": Contains both conversational elements AND a workflow request (e.g., "Thanks! Now create a task")

Message: "${message}"${historyContext}

Return a JSON object with:
{
  "type": "conversational" | "workflow_request" | "hybrid",
  "confidence": 0.0-1.0,
  "workflowIntent": "extracted workflow request if type is workflow_request or hybrid, otherwise omit"
}

Return ONLY valid JSON, no markdown.`;

        try {
            // Add timeout for classification
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Classification timeout')), 10000)
            );

            const response = await Promise.race([
                generateText(prompt),
                timeoutPromise
            ]) as string;

            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanJson);

            return {
                type: result.type || 'conversational',
                confidence: result.confidence || 0.5,
                workflowIntent: result.workflowIntent
            };
        } catch (error) {
            console.error('Intent classification failed:', error);
            // Default to conversational to prevent accidental workflow execution on error
            return {
                type: 'conversational',
                confidence: 0.0,
                workflowIntent: undefined
            };
        }
    }
}

export const intentClassifier = new IntentClassifier();
