import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

// Define actions
const ACTIONS: AdapterAction[] = [
    {
        name: 'list_emails',
        description: 'List emails from Gmail inbox',
        parameters: {
            type: 'object',
            properties: {
                maxResults: { type: 'number', description: 'Maximum number of emails to return' },
                q: { type: 'string', description: 'Query string to filter emails (e.g., "is:unread")' }
            }
        }
    },
    {
        name: 'send_email',
        description: 'Send an email',
        parameters: {
            type: 'object',
            required: ['to', 'subject', 'body'],
            properties: {
                to: { type: 'string', description: 'Recipient email address' },
                subject: { type: 'string', description: 'Email subject' },
                body: { type: 'string', description: 'Email body content' }
            }
        }
    }
];

export class GmailAdapter extends BaseAdapter {
    name = 'GmailAdapter';
    description = 'Manage Gmail emails';
    version = '1.0.0';
    scopes = [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send'
    ];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        // TODO: Retrieve tokens from context or DB using context.userId
        // For now, we assume context.tokens contains { access_token, refresh_token }
        // or we need a proper OAuth service.

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        if (context.tokens) {
            auth.setCredentials(context.tokens);
        } else {
            console.warn('No tokens provided in context for GmailAdapter');
            // Allow execution to fail if no tokens (or handle error)
            throw new Error('Authentication required: No tokens found for GmailAdapter');
        }

        const gmail = google.gmail({ version: 'v1', auth });

        switch (actionName) {
            case 'list_emails':
                const listRes = await gmail.users.messages.list({
                    userId: 'me',
                    maxResults: params.maxResults || 10,
                    q: params.q
                });

                const messages = listRes.data.messages || [];

                // Fetch details for each message to get snippet and headers
                const detailedMessages = await Promise.all(messages.map(async (msg) => {
                    if (!msg.id) return null;
                    try {
                        const detail = await gmail.users.messages.get({
                            userId: 'me',
                            id: msg.id,
                            format: 'metadata', // metadata gives us headers + snippet efficiently
                            metadataHeaders: ['From', 'Subject', 'Date']
                        });

                        const headers = detail.data.payload?.headers;
                        const subject = headers?.find(h => h.name === 'Subject')?.value || '(No Subject)';
                        const from = headers?.find(h => h.name === 'From')?.value || '(Unknown Sender)';
                        const date = headers?.find(h => h.name === 'Date')?.value || '';

                        return {
                            id: msg.id,
                            threadId: msg.threadId,
                            snippet: detail.data.snippet,
                            subject,
                            from,
                            date
                        };
                    } catch (e) {
                        console.warn(`Failed to fetch details for message ${msg.id}`, e);
                        return { id: msg.id, error: 'Failed to load details' };
                    }
                }));

                const validMessages = detailedMessages.filter(m => m !== null);

                return {
                    summary: `Found ${listRes.data.resultSizeEstimate || 0} emails. Retrieved details for ${validMessages.length}.`,
                    emails: validMessages,
                    // Alias for LLM friendliness - matches the hint in orchestrator
                    output: { emails: validMessages }
                };

            case 'send_email':
                try {
                    // Validate recipient email format
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(params.to)) {
                        throw new Error(`Invalid recipient email address: ${params.to}`);
                    }

                    // Construct raw email
                    const utf8Subject = `=?utf-8?B?${Buffer.from(params.subject).toString('base64')}?=`;
                    const messageParts = [
                        `To: ${params.to}`,
                        'Content-Type: text/html; charset=utf-8',
                        'MIME-Version: 1.0',
                        `Subject: ${utf8Subject}`,
                        '',
                        params.body
                    ];
                    const message = messageParts.join('\n');

                    // The API expects 'raw' to be base64url encoded
                    const encodedMessage = Buffer.from(message)
                        .toString('base64')
                        .replace(/\+/g, '-')
                        .replace(/\//g, '_')
                        .replace(/=+$/, '');

                    console.log(`[GmailAdapter] Sending email to ${params.to}, subject: "${params.subject}"`);

                    const sendRes = await gmail.users.messages.send({
                        userId: 'me',
                        requestBody: {
                            raw: encodedMessage
                        }
                    });

                    // Verify the email was queued successfully
                    if (!sendRes.data || !sendRes.data.id) {
                        throw new Error('Gmail API did not return a message ID - email may not have been sent');
                    }

                    // Check if email has expected labels (indicates it was processed)
                    const sentLabelId = sendRes.data.labelIds?.includes('SENT');

                    console.log(`[GmailAdapter] Email sent successfully. Message ID: ${sendRes.data.id}, In SENT folder: ${sentLabelId}`);

                    // Return concise success message (NOT the full email content)
                    return {
                        success: true,
                        messageId: sendRes.data.id,
                        recipient: params.to,
                        subject: params.subject,
                        message: `Email sent to ${params.to}`
                    };
                } catch (error: any) {
                    console.error('[GmailAdapter] Email send failed:', error);

                    // Provide user-friendly error messages for common failures
                    if (error.code === 403) {
                        throw new Error('Gmail API quota exceeded or insufficient permissions. Please try again later.');
                    } else if (error.code === 400) {
                        throw new Error(`Invalid email format or parameters: ${error.message}`);
                    } else if (error.message?.includes('Invalid recipient')) {
                        throw new Error(`Invalid recipient email address: ${params.to}`);
                    } else if (error.code === 401) {
                        throw new Error('Gmail authentication expired. Please reconnect your Google account.');
                    }

                    // Re-throw with context
                    throw new Error(`Failed to send email: ${error.message || error}`);
                }

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
