import { showToast } from '../components/Toast';

export type Environment = 'local' | 'cloud';

export interface EnvironmentState {
    current: Environment;
    localReachable: boolean;
    cloudReachable: boolean;
    isSwitching: boolean;
    lastError?: string;
}

const LOCAL_URL = import.meta.env.VITE_API_URL_LOCAL || 'http://localhost:3000';
const CLOUD_URL = import.meta.env.VITE_API_URL_CLOUD || 'https://extenda-pxa6.onrender.com';

class EnvironmentService {
    private state: EnvironmentState = {
        current: 'cloud',
        localReachable: false,
        cloudReachable: false,
        isSwitching: false
    };

    private listeners: ((state: EnvironmentState) => void)[] = [];
    private _probeCounter: number = 0;

    constructor() {
        this.initialize();
    }

    private async initialize() {
        // Load stored preference
        if (typeof chrome !== 'undefined' && chrome.storage) {
            const result = await chrome.storage.local.get(['extenda_backend_target', 'extenda_backend_url']);
            
            // Migrate old settings if present
            if (result.extenda_backend_url && !result.extenda_backend_target) {
                const target: Environment = result.extenda_backend_url.includes('render') ? 'cloud' : 'local';
                this.state.current = target;
                await chrome.storage.local.set({ extenda_backend_target: target });
            } else if (result.extenda_backend_target) {
                this.state.current = result.extenda_backend_target;
            }
        }
        
        this.notify();
        this.startProbing();
    }

    public subscribe(listener: (state: EnvironmentState) => void) {
        this.listeners.push(listener);
        listener(this.state);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l({ ...this.state }));
    }

    private async startProbing() {
        // Probe immediately then every 30s
        this.probe();
        setInterval(() => this.probe(), 30000);
    }

    public async probe() {
        const check = async (url: string) => {
            try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 3000); // 3s timeout
                const res = await fetch(`${url}/health`, { signal: controller.signal });
                clearTimeout(id);
                return res.ok;
            } catch {
                return false;
            }
        };

        // Always probe the active environment
        const activeUrl = this.state.current === 'local' ? LOCAL_URL : CLOUD_URL;
        const activeResult = await check(activeUrl);

        if (this.state.current === 'local') {
            this.state.localReachable = activeResult;
        } else {
            this.state.cloudReachable = activeResult;
        }

        // Only probe the INACTIVE environment occasionally (every ~60s via the probeCounter)
        // to avoid flooding the console with ERR_CONNECTION_REFUSED when local isn't running
        this._probeCounter++;
        if (this._probeCounter % 2 === 0) {
            const inactiveUrl = this.state.current === 'local' ? CLOUD_URL : LOCAL_URL;
            const inactiveResult = await check(inactiveUrl);
            if (this.state.current === 'local') {
                this.state.cloudReachable = inactiveResult;
            } else {
                this.state.localReachable = inactiveResult;
            }
        }

        this.notify();
    }

    public async switchTo(target: Environment, options: { skipSync?: boolean } = {}) {
        if (this.state.isSwitching) return;
        if (target === this.state.current) return;

        this.state.isSwitching = true;
        this.state.lastError = undefined;
        this.notify();

        try {
            const newUrl = target === 'local' ? LOCAL_URL : CLOUD_URL;
            const oldUrl = this.state.current === 'local' ? LOCAL_URL : CLOUD_URL;

            console.log(`[EnvService] Initiating switch from ${this.state.current} to ${target}...`);

            // 1. Verify target is reachable before committing
            const isReachable = await this.probeTarget(newUrl);
            if (!isReachable) {
                throw new Error(`Target environment (${target}) is unreachable.`);
            }

            // 2. Automated Sync (if skipSync is false)
            if (!options.skipSync) {
                await this.performSync(oldUrl, newUrl);
            }

            // 3. Commit switch
            if (typeof chrome !== 'undefined' && chrome.storage) {
                await chrome.storage.local.set({ 
                    extenda_backend_target: target,
                    extenda_backend_url: newUrl,
                    lastBackendUrl: oldUrl // Used by existing sync logic in App.tsx as backup
                });
            }

            this.state.current = target;
            showToast('success', `Switched to ${target.toUpperCase()} successfully.`);
            
            // Force a slight delay for better UX visibility
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Switch failed';
            this.state.lastError = msg;
            showToast('error', msg);
            console.error('[EnvService] Switch Error:', error);
        } finally {
            this.state.isSwitching = false;
            this.notify();
        }
    }

    private async probeTarget(url: string): Promise<boolean> {
        try {
            const res = await fetch(`${url}/health`);
            return res.ok;
        } catch {
            return false;
        }
    }

    private async performSync(fromUrl: string, toUrl: string) {
        console.log(`[EnvService] Synchronizing data...`);
        const token = localStorage.getItem('accessToken');
        if (!token) {
            console.log('[EnvService] No access token, skipping data sync.');
            return;
        }

        try {
            // Export
            const exportRes = await fetch(`${fromUrl}/api/sync/export`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!exportRes.ok) {
                if (exportRes.status === 401 || exportRes.status === 404) {
                    console.log('[EnvService] Source data not available or unauthorized. Proceeding with empty sync.');
                    return;
                }
                throw new Error('Sync Export failed');
            }
            
            const { bundle } = await exportRes.json();
            if (!bundle) return;

            // Import
            const importRes = await fetch(`${toUrl}/api/sync/import`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ bundle })
            });

            if (!importRes.ok) {
                throw new Error('Sync Import failed');
            }
        } catch (err) {
            console.error('[EnvService] Sync failed, but proceeding with switch:', err);
            // We don't throw here to avoid blocking the switch, as per user requirement.
        }
    }

    public getUrl(): string {
        return this.state.current === 'local' ? LOCAL_URL : CLOUD_URL;
    }

    public getState(): EnvironmentState {
        return { ...this.state };
    }
}

export const envService = new EnvironmentService();
