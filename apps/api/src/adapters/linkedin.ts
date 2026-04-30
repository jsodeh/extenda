import axios from 'axios';
import { BaseAdapter } from './base-adapter.js';
import { AdapterAction } from '@extenda/shared';

const ACTIONS: AdapterAction[] = [
    {
        id: 'create_post',
        name: 'create_post',
        description: 'Create a post on LinkedIn',
        parameters: {
            type: 'object',
            required: ['text'],
            properties: {
                text: { type: 'string', description: 'Post text content' },
                link: { type: 'string', description: 'Optional link to include' },
                visibility: {
                    type: 'string',
                    description: 'Post visibility: PUBLIC or CONNECTIONS',
                    enum: ['PUBLIC', 'CONNECTIONS']
                }
            }
        }
    },
    {
        id: 'get_profile',
        name: 'get_profile',
        description: 'Get user LinkedIn profile information',
        parameters: {
            type: 'object',
            properties: {}
        }
    },
    {
        id: 'delete_post',
        name: 'delete_post',
        description: 'Delete a post from LinkedIn',
        parameters: {
            type: 'object',
            required: ['postId'],
            properties: {
                postId: { type: 'string', description: 'ID of the post to delete' }
            }
        }
    },
    {
        id: 'list_posts',
        name: 'list_posts',
        description: 'List recent posts by the user',
        parameters: {
            type: 'object',
            properties: {
                count: { type: 'number', description: 'Number of posts to return' }
            }
        }
    }
];

export class LinkedInAdapter extends BaseAdapter {
    id = 'linkedin';
    type = 'oauth' as const;
    provider = 'linkedin';
    name = 'LinkedInAdapter';
    description = 'Post content and manage LinkedIn profile';
    version = '1.0.0';
    scopes = [
        'openid',
        'profile',
        'email',
        'w_member_social'
    ];
    actions = ACTIONS;

    async execute(actionName: string, params: any, context: any): Promise<any> {
        const accessToken = context.tokens?.access_token;

        if (!accessToken) {
            throw new Error('LinkedIn access token not found');
        }

        const api = axios.create({
            baseURL: 'https://api.linkedin.com/v2',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        switch (actionName) {
            case 'create_post':
                // First, get the user's LinkedIn ID
                const meResponse = await api.get('/me');
                const authorId = `urn:li:person:${meResponse.data.id}`;

                // Prepare post data
                const postData: any = {
                    author: authorId,
                    lifecycleState: 'PUBLISHED',
                    specificContent: {
                        'com.linkedin.ugc.ShareContent': {
                            shareCommentary: {
                                text: params.text
                            },
                            shareMediaCategory: params.link ? 'ARTICLE' : 'NONE'
                        }
                    },
                    visibility: {
                        'com.linkedin.ugc.MemberNetworkVisibility': params.visibility || 'PUBLIC'
                    }
                };

                // Add link if provided
                if (params.link) {
                    postData.specificContent['com.linkedin.ugc.ShareContent'].media = [{
                        status: 'READY',
                        originalUrl: params.link
                    }];
                }

                const postResponse = await api.post('/ugcPosts', postData);
                const postId = postResponse.data.id;

                // Extract post URN for URL construction
                const postUrn = postId.split(':').pop();

                return {
                    success: true,
                    postId: postId,
                    postUrl: `https://www.linkedin.com/feed/update/${postId}/`,
                    message: 'Post created successfully on LinkedIn'
                };

            case 'get_profile':
                const profileResponse = await api.get('/me', {
                    params: {
                        projection: '(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))'
                    }
                });

                const profile = profileResponse.data;

                return {
                    id: profile.id,
                    firstName: profile.localizedFirstName,
                    lastName: profile.localizedLastName,
                    fullName: `${profile.localizedFirstName} ${profile.localizedLastName}`,
                    profileUrl: `https://www.linkedin.com/in/${profile.id}`
                };

            case 'delete_post':
                await api.delete(`/ugcPosts/${params.postId}`);
                return { success: true, message: `Post ${params.postId} deleted` };

            case 'list_posts':
                const meRes = await api.get('/me');
                const myUrn = `urn:li:person:${meRes.data.id}`;
                const postsRes = await api.get('/ugcPosts', {
                    params: {
                        q: 'authors',
                        authors: `List(${myUrn})`,
                        count: params.count || 10
                    }
                });
                return postsRes.data.elements;

            default:
                throw new Error(`Action ${actionName} not supported`);
        }
    }
}
