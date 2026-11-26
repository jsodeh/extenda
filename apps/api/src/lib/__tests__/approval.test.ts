import { it } from 'node:test';
import assert from 'node:assert/strict';
import { needsApproval, approvalDigest } from '../approval.js';

it('requires review of each external write even in Fast mode', () => {
    for (const tool of [
        'FormFiller',
        'SmartClick',
        'LinkedInAdapter_create_post',
        'GoogleCalendarAdapter_create_event',
        'GmailAdapter_send_email',
        'GoogleDriveAdapter_share_file',
        'SlackAdapter_send_message',
        'Unknown'
    ]) {
        assert.equal(needsApproval(tool, { mode: 'Fast' }), true);
    }
});
it('binds approval to the owner, run, action, destination and resolved content', () => {
    const step = { id: 'a', tool: 'send', params: { to: 'test', text: 'hello' } };
    const hash = approvalDigest('one', 'run', step);
    assert.equal(hash, approvalDigest('one', 'run', { ...step, params: { text: 'hello', to: 'test' } }));
    assert.notEqual(hash, approvalDigest('two', 'run', step));
    assert.notEqual(hash, approvalDigest('one', 'another', step));
    assert.notEqual(hash, approvalDigest('one', 'run', { ...step, params: { ...step.params, to: 'other' } }));
});
