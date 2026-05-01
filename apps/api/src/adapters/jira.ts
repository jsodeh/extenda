import { Version3Client } from 'jira.js';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_issue',
        name: 'create_issue',
        description: 'Create a new Jira issue',
        parameters: {
            type: 'object',
            required: ['project', 'summary', 'issuetype'],
            properties: {
                project: { type: 'string', description: 'Project Key (e.g., PROJ)' },
                summary: { type: 'string', description: 'Issue summary/title' },
                issuetype: { type: 'string', description: 'Issue Type ID or name (e.g., Task)' },
                description: { type: 'string', description: 'Issue description' }
            }
        }
    },
    {
        id: 'get_issue',
        name: 'get_issue',
        description: 'Get details of a Jira issue',
        parameters: {
            type: 'object',
            required: ['issueIdOrKey'],
            properties: {
                issueIdOrKey: { type: 'string', description: 'Issue Key (PROJ-1) or ID' }
            }
        }
    },
    {
        id: 'search_issues',
        name: 'search_issues',
        description: 'Search for issues using JQL',
        parameters: {
            type: 'object',
            required: ['jql'],
            properties: {
                jql: { type: 'string', description: 'Jira Query Language string' },
                maxResults: { type: 'number', description: 'Max issues to return' }
            }
        }
    },
    {
        id: 'add_comment',
        name: 'add_comment',
        description: 'Add a comment to an issue',
        parameters: {
            type: 'object',
            required: ['issueIdOrKey', 'body'],
            properties: {
                issueIdOrKey: { type: 'string', description: 'Issue Key or ID' },
                body: { type: 'string', description: 'Comment text' }
            }
        }
    },
    {
        id: 'transition_issue',
        name: 'transition_issue',
        description: 'Change the status of an issue (e.g., move to "In Progress")',
        parameters: {
            type: 'object',
            required: ['issueIdOrKey', 'transitionId'],
            properties: {
                issueIdOrKey: { type: 'string', description: 'Issue Key or ID' },
                transitionId: { type: 'string', description: 'ID of the transition to perform' }
            }
        }
    },
    {
        id: 'list_projects',
        name: 'list_projects',
        description: 'List all available Jira projects',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        id: 'assign_issue',
        name: 'assign_issue',
        description: 'Assign an issue to a user',
        parameters: {
            type: 'object',
            required: ['issueIdOrKey', 'accountId'],
            properties: {
                issueIdOrKey: { type: 'string', description: 'Issue Key or ID' },
                accountId: { type: 'string', description: 'Atlassian Account ID of the assignee' }
            }
        }
    }
];

export class JiraAdapter extends BaseAdapter {
    id = 'jira';
    type = 'oauth' as const;
    provider = 'jira';
    name = 'JiraAdapter';
    description = 'Manage Jira issues';
    version = '1.0.0';
    scopes = ['read:jira-work', 'write:jira-work'];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        // TODO: Use OAuth token from context
        const client = new Version3Client({
            host: process.env.JIRA_HOST || 'https://your-domain.atlassian.net',
            authentication: {
                basic: {
                    email: process.env.JIRA_EMAIL || '',
                    apiToken: process.env.JIRA_API_TOKEN || ''
                }
            }
        });

        switch (actionName) {
            case 'create_issue':
                return await client.issues.createIssue({
                    fields: {
                        project: { key: params.project },
                        summary: params.summary,
                        issuetype: { name: params.issuetype }, // jira.js might imply ID, but name often works if mapped or using robust client
                        description: params.description
                    }
                });

            case 'get_issue':
                return await client.issues.getIssue({
                    issueIdOrKey: params.issueIdOrKey
                });

            case 'search_issues':
                return await client.issueSearch.searchForIssuesUsingJql({
                    jql: params.jql,
                    maxResults: params.maxResults || 10
                });

            case 'add_comment':
                return await client.issueComments.addComment({
                    issueIdOrKey: params.issueIdOrKey,
                    body: params.body
                } as any);

            case 'transition_issue':
                return await client.issues.doTransition({
                    issueIdOrKey: params.issueIdOrKey,
                    transition: { id: params.transitionId }
                });

            case 'list_projects':
                return await (client.projects as any).searchProjects();

            case 'assign_issue':
                return await client.issues.assignIssue({
                    issueIdOrKey: params.issueIdOrKey,
                    accountId: params.accountId
                });

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
