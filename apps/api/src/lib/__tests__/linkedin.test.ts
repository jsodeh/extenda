import { it } from 'node:test';
import assert from 'node:assert/strict';
import { publishPost, ProviderFailure } from '../../services/linkedin.js';

const post = { author: 'urn:li:person:fixture', text: 'Fixture launch', visibility: 'CONNECTIONS' as const };
it('publishes the exact approved text and accepts a provider-issued receipt', async () => {
    let writes = 0;
    const receipt = await publishPost(post, 'fixture', async (input, init) => {
        if (String(input).endsWith('/userinfo')) return Response.json({ sub: 'fixture' });
        writes++;
        const data = JSON.parse(String(init?.body));
        assert.equal(data.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text, post.text);
        assert.equal(data.visibility['com.linkedin.ugc.MemberNetworkVisibility'], 'CONNECTIONS');
        return new Response(null, { status: 201, headers: { 'x-restli-id': 'urn:li:share:123' } });
    });
    assert.equal(writes, 1);
    assert.equal(receipt.postUrl, 'https://www.linkedin.com/feed/update/urn:li:share:123/');
});
it('refuses expired tokens, changed identity and ambiguous publication results', async () => {
    await assert.rejects(
        publishPost(post, 'fixture', async () => new Response(null, { status: 401 })),
        ProviderFailure
    );
    await assert.rejects(
        publishPost(post, 'fixture', async () => Response.json({ sub: 'other' })),
        /account changed/
    );
    await assert.rejects(
        publishPost(post, 'fixture', async (input) =>
            String(input).endsWith('userinfo')
                ? Response.json({ sub: 'fixture' })
                : new Response(null, { status: 201 })
        ),
        /unknown/
    );
});
