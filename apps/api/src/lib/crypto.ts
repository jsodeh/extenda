import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Encrypts data using AES-256-GCM with a key derived from JWT_SECRET
 */
export const encrypt = (data: string): string => {
    const password = process.env.JWT_SECRET || 'default-secret-key';
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, 32);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
};

/**
 * Decrypts data using AES-256-GCM with a key derived from JWT_SECRET
 */
export const decrypt = (encryptedData: string): string => {
    const password = process.env.JWT_SECRET || 'default-secret-key';
    const buffer = Buffer.from(encryptedData, 'base64');

    const salt = buffer.subarray(0, 16);
    const iv = buffer.subarray(16, 28);
    const tag = buffer.subarray(28, 44);
    const encrypted = buffer.subarray(44);

    const key = scryptSync(password, salt, 32);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final('utf8');
};
