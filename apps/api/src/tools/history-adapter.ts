// Browser history management tool
// Executes in extension background script via message passing

export interface HistorySearchParams {
    query: string;
    maxResults?: number;
    startTime?: number;
    endTime?: number;
}

export interface HistoryResult {
    url: string;
    title: string;
    lastVisitTime: number;
    visitCount: number;
    typedCount: number;
}

export class HistoryAdapter {
    /**
     * Search browser history
     */
    static async search(params: HistorySearchParams): Promise<HistoryResult[]> {
        // This will be executed in the browser extension
        throw new Error('HistoryAdapter must be executed in browser context');
    }

    /**
     * Get last visit to a specific URL
     */
    static async getLastVisit(url: string): Promise<HistoryResult | null> {
        throw new Error('HistoryAdapter must be executed in browser context');
    }

    /**
     * Get visits within date range
     */
    static async getVisitsByDate(startDate: Date, endDate: Date): Promise<HistoryResult[]> {
        throw new Error('HistoryAdapter must be executed in browser context');
    }

    /**
     * Execute - route to appropriate action
     */
    static async execute(params: any): Promise<any> {
        const { action, ...actionParams } = params;

        switch (action) {
            case 'search':
                return this.search(actionParams);
            case 'get_last_visit':
                return this.getLastVisit(actionParams.url);
            case 'get_visits_by_date':
                return this.getVisitsByDate(
                    new Date(actionParams.startDate),
                    new Date(actionParams.endDate)
                );
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }
}

// Tool registration
export const HistoryAdapterTool = {
    name: 'HistoryAdapter',
    description: 'Query browser history: search history, get last visit to URL, get visits by date range',
    executionType: 'browser' as const,
    execute: HistoryAdapter.execute.bind(HistoryAdapter),
    validate: (params: any) => {
        if (!params.action) {
            return { valid: false, error: 'Missing action parameter' };
        }
        const validActions = ['search', 'get_last_visit', 'get_visits_by_date'];
        if (!validActions.includes(params.action)) {
            return { valid: false, error: `Invalid action. Must be one of: ${validActions.join(', ')}` };
        }
        return { valid: true };
    }
};
