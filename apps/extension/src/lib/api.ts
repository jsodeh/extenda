import { envService } from './environment-service';

/**
 * Dynamically resolves the Backend API URL from the environment service.
 */
export const getApiUrl = async (): Promise<string> => {
    await envService.initialized;
    return envService.getUrl();
};

export async function privateRequest(path: string, options: RequestInit = {}) {
    const { accessToken } = await chrome.storage.local.get('accessToken');
    if (!accessToken) throw new Error('Sign in to continue');
    const response = await fetch((await getApiUrl()) + path, {
        ...options, headers: { ...options.headers, Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || detail.metadata?.error || 'Request failed');
    }
    return response;
}

export async function uploadDocument(data:FormData,onProgress:(percent:number)=>void) {
    const {accessToken}=await chrome.storage.local.get('accessToken');
    if (!accessToken) throw new Error('Sign in to upload');
    const url=await getApiUrl();
    await new Promise<void>((resolve,reject)=>{
        const xhr=new XMLHttpRequest();
        xhr.open('POST',url+'/api/knowledge/upload');
        xhr.setRequestHeader('Authorization','Bearer '+accessToken);
        xhr.responseType='json';
        xhr.upload.onprogress=e=>{if(e.lengthComputable) onProgress(Math.round(100*e.loaded/e.total));};
        xhr.onload=()=>xhr.status>=200 && xhr.status<300 ? resolve() : reject(new Error(xhr.response?.metadata?.error || xhr.response?.error || 'Upload failed'));
        xhr.onerror=()=>reject(new Error('Upload interrupted. Reload the library to check processing status.'));
        xhr.send(data);
    });
}
