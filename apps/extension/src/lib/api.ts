import { envService } from './environment-service';

/**
 * Dynamically resolves the Backend API URL from the environment service.
 */
export const getApiUrl = async (): Promise<string> => {
    return envService.getUrl();
};
