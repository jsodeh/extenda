import { createClerkClient, verifyToken } from '@clerk/backend';

if (!process.env.CLERK_SECRET_KEY) {
    throw new Error('CLERK_SECRET_KEY is not set');
}

export const clerkClient = createClerkClient({ 
    secretKey: process.env.CLERK_SECRET_KEY 
});

export const verifyClerkToken = async (token: string) => {
    return verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY
    });
};
