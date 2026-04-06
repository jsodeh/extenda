import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env relative to the 'src' directory
const envPath = resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

console.log('✅ Environment loaded from:', envPath);
console.log('Environment:', process.env.NODE_ENV);
