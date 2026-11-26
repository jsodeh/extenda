import { it } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { extractSections, chunksOf } from '../../services/file-processor.js';

it('reads DOCX paragraph boundaries and preserves split text runs', async () => {
    const doc = zipSync({
        'word/document.xml': strToU8(
            '<w:document><w:body><w:p><w:r><w:t>Test </w:t></w:r><w:r><w:t>Engineer</w:t></w:r></w:p></w:body></w:document>'
        )
    });
    assert.deepEqual(await extractSections('cv.docx', Buffer.from(doc)), [
        { source: 'paragraph 1', text: 'Test Engineer' }
    ]);
});
it('extracts literal PDF text with page provenance', async () => {
    const parts = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        '<< >>\nstream\nBT /F1 12 Tf 20 50 Td (Test Engineer) Tj ET\nendstream'
    ];
    const pdf =
        '%PDF-1.4\n' +
        parts.map((p, i) => `${i + 1} 0 obj\n${p}\nendobj\n`).join('') +
        'trailer\n<< /Root 1 0 R /Size 6 >>\n%%EOF';
    assert.deepEqual(await extractSections('cv.pdf', Buffer.from(pdf)), [
        { source: 'page 1', text: 'Test Engineer' }
    ]);
});
it('rejects invalid binary text and preserves long text across chunks', async () => {
    await assert.rejects(extractSections('cv.txt', Buffer.from([0xff, 0, 3])));
    const text = 'x'.repeat(5000);
    assert.equal(
        chunksOf(await extractSections('info.md', Buffer.from(text)))
            .map((c) => c.text)
            .join(''),
        text
    );
});
