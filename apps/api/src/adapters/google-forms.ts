import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_form',
        name: 'create_form',
        description: 'Create a new Google Form. Returns: formId, id, formUrl, url, editUrl. Use formUrl or url to share the form with respondents.',
        parameters: {
            type: 'object',
            required: ['title'],
            properties: {
                title: { type: 'string', description: 'Form title' },
                description: { type: 'string', description: 'Form description' },
                documentTitle: { type: 'string', description: 'Document title (defaults to title)' }
            }
        }
    },
    {
        id: 'add_questions',
        name: 'add_questions',
        description: 'Add questions to a Google Form. Returns: success, questionsAdded. Note: This does NOT return the form URL - use create_form output for the URL.',
        parameters: {
            type: 'object',
            required: ['formId', 'questions'],
            properties: {
                formId: { type: 'string', description: 'Form ID from create_form output' },
                questions: {
                    type: 'array',
                    description: 'Array of questions to add',
                    items: {
                        type: 'object',
                        required: ['title', 'type'],
                        properties: {
                            title: { type: 'string', description: 'Question text' },
                            type: {
                                type: 'string',
                                description: 'Question type: text, paragraph, multiple_choice, checkboxes, dropdown, email, url',
                                enum: ['text', 'paragraph', 'multiple_choice', 'checkboxes', 'dropdown', 'email', 'url']
                            },
                            required: { type: 'boolean', description: 'Whether question is required' },
                            options: {
                                type: 'array',
                                description: 'Options for multiple_choice, checkboxes, or dropdown',
                                items: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
    },
    {
        id: 'get_responses',
        name: 'get_responses',
        description: 'Get form responses',
        parameters: {
            type: 'object',
            required: ['formId'],
            properties: {
                formId: { type: 'string', description: 'Form ID' }
            }
        }
    }
];

export class GoogleFormsAdapter extends BaseAdapter {
    id = 'google_forms';
    type = 'oauth' as const;
    provider = 'google';
    name = 'GoogleFormsAdapter';
    description = 'Create and manage Google Forms';
    version = '1.0.0';
    scopes = [
        'https://www.googleapis.com/auth/forms.body',
        'https://www.googleapis.com/auth/forms.responses.readonly'
    ];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );

        if (context.tokens) {
            auth.setCredentials(context.tokens);
        }

        const forms = google.forms({ version: 'v1', auth });

        switch (actionName) {
            case 'create_form':
                const newForm = await forms.forms.create({
                    requestBody: {
                        info: {
                            title: params.title,
                            documentTitle: params.documentTitle || params.title
                        }
                    }
                });

                // Add description if provided
                if (params.description) {
                    await forms.forms.batchUpdate({
                        formId: newForm.data.formId!,
                        requestBody: {
                            requests: [{
                                updateFormInfo: {
                                    info: {
                                        description: params.description
                                    },
                                    updateMask: 'description'
                                }
                            }]
                        }
                    });
                }

                return {
                    formId: newForm.data.formId,
                    id: newForm.data.formId, // Alias for AI compatibility
                    formUrl: newForm.data.responderUri,
                    url: newForm.data.responderUri, // Alias for AI compatibility
                    editUrl: `https://docs.google.com/forms/d/${newForm.data.formId}/edit`
                };

            case 'add_questions':
                const requests = params.questions.map((q: any, index: number) => {
                    // Build question object with the question type inside
                    const question: any = {
                        required: q.required || false
                    };

                    // Map question types to Google Forms API format
                    switch (q.type) {
                        case 'text':
                        case 'email':
                        case 'url':
                            question.textQuestion = { paragraph: false };
                            break;
                        case 'paragraph':
                            question.textQuestion = { paragraph: true };
                            break;
                        case 'multiple_choice':
                            question.choiceQuestion = {
                                type: 'RADIO',
                                options: (q.options || ['Option 1']).map((opt: string) => ({ value: opt }))
                            };
                            break;
                        case 'checkboxes':
                            question.choiceQuestion = {
                                type: 'CHECKBOX',
                                options: (q.options || ['Option 1']).map((opt: string) => ({ value: opt }))
                            };
                            break;
                        case 'dropdown':
                            question.choiceQuestion = {
                                type: 'DROP_DOWN',
                                options: (q.options || ['Option 1']).map((opt: string) => ({ value: opt }))
                            };
                            break;
                        default:
                            question.textQuestion = { paragraph: false };
                    }

                    return {
                        createItem: {
                            item: {
                                title: q.title,
                                questionItem: {
                                    question: question
                                }
                            },
                            location: { index }
                        }
                    };
                });

                await forms.forms.batchUpdate({
                    formId: params.formId,
                    requestBody: {
                        requests: requests
                    }
                });

                return { success: true, questionsAdded: params.questions.length };

            case 'get_responses':
                const responses = await forms.forms.responses.list({
                    formId: params.formId
                });

                return {
                    responses: responses.data.responses || [],
                    totalResponses: responses.data.responses?.length || 0
                };

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
