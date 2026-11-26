const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const { createRequire } = require('node:module');
const { randomUUID, randomBytes } = require('node:crypto');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const http = require('node:http');
const assert = require('node:assert/strict');
const path = require('node:path');
const repo = process.cwd();
const apiRequire = createRequire(path.join(repo, 'apps/api/package.json'));
const { Pool } = apiRequire('pg'),
    { sign } = apiRequire('hono/jwt');
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(connectionString).hostname))
    throw Error('Select a disposable local TEST_DATABASE_URL');
const extensionDir = path.resolve(process.env.SMOKE_EXTENSION_DIR);
const { io } = createRequire(path.join(repo, 'apps/extension/package.json'))('socket.io-client');
const { tmpdir } = require('node:os');
const pool = new Pool({ connectionString });
const owner = randomUUID(),
    secret = randomBytes(32).toString('hex');
let browser,
    api,
    model,
    client,
    profile,
    receivedSource = false,
    apiOutput = '';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
(async () => {
    await pool.query('INSERT INTO users(id,email,name) VALUES($1,$2,$3)', [
        owner,
        owner + '@example.test',
        'Fixture User'
    ]);
    model = http
        .createServer(async (req, res) => {
            if (req.url === '/application') {
                res.writeHead(200, { 'content-type': 'text/html' });
                res.end(
                    '<form><label>Education<input id="education" required></label><label>Certification<input id="certificate" required></label></form>'
                );
                return;
            }
            if (req.method === 'GET') {
                res.writeHead(200, { 'content-type': 'text/html' });
                res.end(`<form action="/apply"><label>Full name<input id="name" name="name" required></label><button type="button" id="next">Continue</button></form><script>
        document.querySelector('#next').onclick=e=>{e.target.outerHTML='<button id="send" type="submit">Apply</button>';};
        document.querySelector('form').onsubmit=e=>{e.preventDefault();document.body.insertAdjacentHTML('beforeend','<h2>Application received</h2>');};</script>`);
                return;
            }
            let body = '';
            for await (const chunk of req) body += chunk;
            const prompt = JSON.parse(body).messages[0].content;
            let content = JSON.stringify({ type: 'workflow_request', confidence: 0.9 });
            if (prompt.includes('Create a JSON execution plan')) {
                receivedSource = prompt.includes('MSc Fixture Science') && prompt.includes('fixture-cv.txt');
                content = JSON.stringify({
                    directResponse: receivedSource
                        ? 'MSc Fixture Science; employment at Fixture Lab [fixture-cv.txt].'
                        : 'No source available',
                    steps: []
                });
            }
            if (
                prompt.includes('Create a JSON execution plan') &&
                prompt.includes('Use my CV to complete the fixture application')
            ) {
                const step = (id, tool, params, dependencies = []) => ({
                    id,
                    type: 'tool',
                    tool,
                    params,
                    dependencies
                });
                content = JSON.stringify({
                    steps: [
                        step('inspect', 'DOMReader', { action: 'inspect_form' }),
                        step('answers', 'FormAnswers', { fields: '{{inspect.result}}' }, ['inspect']),
                        step(
                            'fill',
                            'FormFiller',
                            {
                                action: 'fill_form',
                                formData: '{{answers.result.formData}}',
                                missing: '{{answers.result.missing}}'
                            },
                            ['answers']
                        ),
                        step(
                            'draft',
                            'LinkedInAdapter_save_draft',
                            { text: 'Project work at Fixture Lab', visibility: 'CONNECTIONS' },
                            ['fill']
                        ),
                        step(
                            'reminder',
                            'PlanningAdapter_schedule',
                            {
                                at: new Date(Date.now() + 3600000).toISOString(),
                                timezone: 'Africa/Lagos',
                                action: 'reminder',
                                payload: { message: 'Review progress' },
                                recurrence: 'weekly'
                            },
                            ['draft']
                        )
                    ]
                });
            } else if (prompt.startsWith('Map form fields to evidence')) {
                const data = JSON.parse(prompt.slice(prompt.lastIndexOf('\n') + 1));
                const index = data.sources.findIndex((s) => s.includes('MSc Fixture Science'));
                content = JSON.stringify([
                    {
                        selector: '#education',
                        value: 'MSc Fixture Science',
                        quote: 'MSc Fixture Science',
                        source: index,
                        kind: 'fact'
                    }
                ]);
            }
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ message: { content } }));
        })
        .listen(55872, '127.0.0.1');
    api = spawn(process.execPath, ['apps/api/dist/index.js'], {
        env: {
            ...process.env,
            DATABASE_URL: connectionString,
            JWT_SECRET: secret,
            ENCRYPTION_KEY: randomBytes(32).toString('hex'),
            PORT: '55871',
            NODE_ENV: 'test'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    api.stdout.on('data', (b) => (apiOutput += b));
    api.stderr.on('data', (b) => (apiOutput += b));
    for (let i = 0; i < 100; i++) {
        try {
            if ((await fetch('http://localhost:55871/health')).ok) break;
        } catch {}
        if (api.exitCode !== null) throw Error(apiOutput.slice(-1400));
        await delay(150);
    }
    profile = await fs.mkdtemp(path.join(tmpdir(), 'extenda-chrome-fixture-'));
    browser = await chromium.launchPersistentContext(profile, {
        executablePath: process.env.CHROME_BIN,
        headless: true,
        args: [
            `--disable-extensions-except=${extensionDir}`,
            `--load-extension=${extensionDir}`,
            '--disable-background-networking',
            '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'
        ]
    });
    const sw = browser.serviceWorkers()[0] || (await browser.waitForEvent('serviceworker', { timeout: 15000 }));
    const token = await sign({ userId: owner, exp: Math.floor(Date.now() / 1000) + 300 }, secret);
    await sw.evaluate(async (data) => chrome.storage.local.set(data), {
        user: { id: owner, name: 'Fixture User', email: 'fixture@example.test' },
        accessToken: token,
        extenda_backend_target: 'local',
        extenda_active_provider: 'ollama',
        extenda_provider_keys: { ollama: 'fixture' },
        extenda_default_models: { ollama: 'fixture-model' },
        extenda_ollama_url: 'http://127.0.0.1:55872'
    });
    const url = sw.url().split('/').slice(0, 3).join('/') + '/src/sidepanel/index.html';
    let page = await browser.newPage();
    await page.goto(url);
    await page.evaluate(() => localStorage.setItem('onboarding_complete', 'true'));
    await page.reload();
    const library = async () => {
        await page.getByTitle('Menu', { exact: true }).click();
        await page.getByRole('button', { name: 'Knowledgebase' }).click();
    };
    await library();
    await page
        .locator('#file-upload')
        .setInputFiles({
            name: 'fixture-cv.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('Education: MSc Fixture Science. Employment: Fixture Lab.')
        });
    await page.getByText('fixture-cv.txt', { exact: true }).waitFor({ timeout: 10000 });
    await page.close();
    page = await browser.newPage();
    await page.goto(url);
    await library();
    await page.getByText('fixture-cv.txt', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Preview / profile' }).click();
    await page.getByText('Education: MSc Fixture Science. Employment: Fixture Lab.', { exact: true }).waitFor();
    console.log('PASS: MV3 library upload, close, reopen, preview');
    await page.getByTitle('Back', { exact: true }).click();
    const input = page.locator('textarea').last();
    await input.fill('What are my qualifications and previous work experiences?');
    await input.press('Enter');
    await page
        .getByText(/MSc Fixture Science; employment at Fixture Lab/)
        .first()
        .waitFor({ timeout: 25000 });
    assert.equal(receivedSource, true);
    console.log('PASS: real chat socket retrieves persisted CV and cites its source using a local model fixture');
    const formUrl = 'http://127.0.0.1:55872/form';
    const form = await browser.newPage();
    await form.goto(formUrl);
    const dispatch = (type, params) =>
        sw.evaluate(
            async ({ formUrl, type, params }) => {
                const tab = (await chrome.tabs.query({ url: formUrl }))[0];
                return chrome.tabs.sendMessage(tab.id, { type, params: { targetUrl: formUrl, ...params } });
            },
            { formUrl, type, params }
        );
    const read = await dispatch('EXECUTE_DOM_READER', { action: 'inspect_form' });
    assert.ok(read.data.some((row) => row.label === 'Full name' && row.required));
    const changed = await dispatch('EXECUTE_FORM_FILLER', {
        action: 'fill_text',
        selector: '#name',
        value: 'Fixture',
        targetUrl: formUrl + '?x'
    });
    assert.equal(changed.success, false);
    assert.equal(
        (await dispatch('EXECUTE_FORM_FILLER', { action: 'fill_text', selector: '#name', value: 'Fixture' }))
            .success,
        true
    );
    assert.equal((await dispatch('EXECUTE_FORM_FILLER', { action: 'advance', selector: '#next' })).success, true);
    form.once('dialog', async (d) => {
        assert.match(d.message(), /name: Fixture/);
        await d.accept();
    });
    const receipt = await dispatch('EXECUTE_FORM_FILLER', { action: 'submit', selector: '#send' });
    assert.equal(receipt.data, 'Application received');
    console.log(
        'PASS: MV3 form detection, target change rejection, filling, next step, local approval and confirmation receipt'
    );
    const application = 'http://127.0.0.1:55872/application';
    await form.goto(application);
    const tabId = await sw.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, application);
    const config = {
        provider: 'ollama',
        model: 'fixture-model',
        baseURL: 'http://127.0.0.1:55872',
        apiKey: 'fixture',
        mode: 'Fast'
    };
    client = io('http://localhost:55871', { auth: { token }, transports: ['websocket'] });
    const reviewed = [];
    await new Promise((resolve, reject) => {
        const timeout = setTimeout(
            () => reject(Error('Combined workflow timed out. Reviews: ' + reviewed.join(', '))),
            30000
        );
        client.on('workflow:error', (data) => {
            clearTimeout(timeout);
            reject(Error(data.error));
        });
        client.on('workflow:complete', () => {
            clearTimeout(timeout);
            resolve();
        });
        client.on('workflow:plan', (data) => {
            if (data.status !== 'paused') return;
            try {
                const step = data.plan.definition.steps.find((s) => s.id === data.pendingStepId);
                if (step.id === 'fill') {
                    assert.equal(step.params.targetUrl, application);
                    assert.deepEqual(step.params.formData, { '#education': 'MSc Fixture Science' });
                    assert.deepEqual(step.params.missing, ['Certification']);
                } else assert.equal(step.id, 'reminder');
                reviewed.push(step.id);
                client.emit('workflow:resume', {
                    executionId: data.executionId,
                    approved: true,
                    approval: data.approval,
                    modelConfig: config
                });
            } catch (e) {
                clearTimeout(timeout);
                reject(e);
            }
        });
        client.emit('workflow:start', {
            requestId: randomUUID(),
            intent: 'Use my CV to complete the fixture application, draft a LinkedIn post and set a weekly reminder',
            modelConfig: config,
            context: { browserTarget: { tabId, targetUrl: application } }
        });
    });
    assert.deepEqual(reviewed, ['fill', 'reminder']);
    assert.equal(await form.locator('#education').inputValue(), 'MSc Fixture Science');
    assert.equal(await form.locator('#certificate').inputValue(), '');
    assert.equal(
        (await pool.query('SELECT content FROM linkedin_drafts WHERE user_id=$1', [owner])).rows[0].content,
        'Project work at Fixture Lab'
    );
    assert.equal(
        (await pool.query('SELECT recurrence FROM scheduled_jobs WHERE user_id=$1', [owner])).rows[0].recurrence,
        'weekly'
    );
    console.log(
        'PASS: CV-grounded browser fill, missing qualification, saved draft and approved weekly reminder through Socket.IO'
    );
})()
    .catch((e) => {
        console.error(e.message);
        console.error(
            apiOutput
                .split('\n')
                .filter((l) => /error|failed/i.test(l))
                .slice(-5)
                .join('\n')
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        client?.disconnect();
        try {
            await browser?.close();
            if (profile) await fs.rm(profile, { recursive: true, force: true });
        } finally {
            api?.kill();
            model?.close();
            await pool.query('DELETE FROM users WHERE id=$1', [owner]);
            await pool.end();
        }
    });
