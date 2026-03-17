import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Local interface for file objects (compatible with multer)
export interface MulterFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}

interface ProcessedFile {
    filename: string;
    type: string;
    content: string;
    success: boolean;
    error?: string;
}

/**
 * Process files using Gemini's multimodal capabilities
 * Extracts text content from images, PDFs, documents, etc.
 */
export async function processFiles(files: MulterFile[]): Promise<ProcessedFile[]> {
    const results: ProcessedFile[] = [];

    for (const file of files) {
        try {
            const content = await processFile(file);
            results.push({
                filename: file.originalname,
                type: file.mimetype,
                content,
                success: true
            });
        } catch (error) {
            console.error(`Failed to process file ${file.originalname}:`, error);
            results.push({
                filename: file.originalname,
                type: file.mimetype,
                content: '',
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    return results;
}

async function processFile(file: MulterFile): Promise<string> {
    const mimeType = file.mimetype;

    // For images - use Gemini vision
    if (mimeType.startsWith('image/')) {
        return await processImage(file);
    }

    // For PDFs - extract with Gemini
    if (mimeType === 'application/pdf') {
        return await processPDF(file);
    }

    // For text-based files
    if (mimeType.startsWith('text/') ||
        mimeType.includes('document') ||
        mimeType.includes('json') ||
        mimeType.includes('csv')) {
        return await processTextFile(file);
    }

    // For audio - transcription would need specific API
    if (mimeType.startsWith('audio/')) {
        return `[Audio file: ${file.originalname}] - Audio transcription not yet implemented`;
    }

    // For video - extract key frames or metadata
    if (mimeType.startsWith('video/')) {
        return `[Video file: ${file.originalname}] - Video analysis not yet implemented`;
    }

    return `[File: ${file.originalname}] - Unsupported file type: ${mimeType}`;
}

async function processImage(file: MulterFile): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const imagePart = {
        inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype
        }
    };

    const prompt = `Analyze this image and provide a detailed description of its contents. 
If there is text in the image, extract it verbatim.
If it's a document, screenshot, or diagram, describe its structure and content.
If it's a photo, describe what you see in detail.

Be concise but comprehensive.`;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;

    return `[Image: ${file.originalname}]\n${response.text()}`;
}

async function processPDF(file: MulterFile): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Gemini 1.5 can process PDFs directly
    const pdfPart = {
        inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: 'application/pdf'
        }
    };

    const prompt = `Extract and summarize the text content from this PDF document.
Preserve important information like headings, key points, and any structured data.
If it contains tables, describe their structure.
Be thorough but concise.`;

    const result = await model.generateContent([prompt, pdfPart]);
    const response = await result.response;

    return `[PDF: ${file.originalname}]\n${response.text()}`;
}

async function processTextFile(file: MulterFile): Promise<string> {
    // For text files, just decode the buffer
    const content = file.buffer.toString('utf-8');

    // If content is too long, summarize with AI
    if (content.length > 10000) {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `The following is the content of a text file named "${file.originalname}".
Provide a concise summary of its contents, preserving key information:

${content.slice(0, 30000)}

${content.length > 30000 ? '... (truncated)' : ''}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;

        return `[Text file: ${file.originalname}]\n${response.text()}`;
    }

    return `[Text file: ${file.originalname}]\n${content}`;
}

/**
 * Extract just the text content strings for passing to workflow
 */
export function getFileContents(processedFiles: ProcessedFile[]): string[] {
    return processedFiles
        .filter(f => f.success)
        .map(f => f.content);
}
