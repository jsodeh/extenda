/**
 * Gmail Scraper - Extract emails from Gmail
 * Runs in Gmail context (mail.google.com)
 */

export interface GmailEmail {
    id: string;
    from: string;
    to: string[];
    subject: string;
    date: string;
    snippet: string;
    body?: string;
    labels: string[];
}

export class GmailScraper {
    /**
     * Get emails from inbox
     */
    static getInboxEmails(limit: number = 10): GmailEmail[] {
        const emails: GmailEmail[] = [];

        // Gmail uses specific class names for email rows
        const emailRows = document.querySelectorAll('tr.zA'); // Email row class

        for (let i = 0; i < Math.min(emailRows.length, limit); i++) {
            const row = emailRows[i];

            try {
                const email = this.parseEmailRow(row, i);
                if (email) {
                    emails.push(email);
                }
            } catch (error) {
                console.error('Failed to parse email row:', error);
            }
        }

        return emails;
    }

    /**
     * Parse email row into structured data
     */
    private static parseEmailRow(row: Element, index: number): GmailEmail | null {
        // Extract sender
        const senderEl = row.querySelector('.yW span[email]');
        const from = senderEl?.getAttribute('email') ||
            senderEl?.getAttribute('name') ||
            row.querySelector('.yW')?.textContent?.trim() || 'Unknown';

        // Extract subject
        const subjectEl = row.querySelector('.y6 span');
        const subject = subjectEl?.textContent?.trim() || '(No subject)';

        // Extract snippet/preview
        const snippetEl = row.querySelector('.y2');
        const snippet = snippetEl?.textContent?.trim() || '';

        // Extract date
        const dateEl = row.querySelector('.xW span');
        const date = dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '';

        // Extract labels (categories)
        const labelEls = row.querySelectorAll('.at');
        const labels = Array.from(labelEls).map(el => el.getAttribute('title') || '').filter(Boolean);

        // Check if starred
        const isStarred = row.querySelector('.T-KT-Jp')?.classList.contains('T-KT-Jp-aXw');
        if (isStarred) {
            labels.push('STARRED');
        }

        // Check if unread
        const isUnread = row.classList.contains('zE');
        if (isUnread) {
            labels.push('UNREAD');
        }

        return {
            id: `gmail-${index}-${Date.now()}`,
            from,
            to: [], // Not visible in list view
            subject,
            date,
            snippet,
            labels
        };
    }

    /**
     * Get currently open email details
     */
    static getOpenEmail(): GmailEmail | null {
        // Check if an email is open
        const emailContainer = document.querySelector('.nH.aHU');
        if (!emailContainer) {
            return null;
        }

        try {
            // Extract from
            const fromEl = emailContainer.querySelector('.gD');
            const from = fromEl?.getAttribute('email') || fromEl?.textContent?.trim() || 'Unknown';

            // Extract to
            const toEls = emailContainer.querySelectorAll('.g2');
            const to = Array.from(toEls).map(el => el.getAttribute('email') || el.textContent?.trim()).filter(Boolean) as string[];

            // Extract subject
            const subjectEl = emailContainer.querySelector('.hP');
            const subject = subjectEl?.textContent?.trim() || '(No subject)';

            // Extract date
            const dateEl = emailContainer.querySelector('.g3');
            const date = dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '';

            // Extract body
            const bodyEl = emailContainer.querySelector('.a3s');
            const body = (bodyEl as HTMLElement)?.innerText || bodyEl?.textContent || '';

            return {
                id: `gmail-open-${Date.now()}`,
                from,
                to,
                subject,
                date,
                snippet: body.substring(0, 200),
                body,
                labels: []
            };
        } catch (error) {
            console.error('Failed to parse open email:', error);
            return null;
        }
    }

    /**
     * Search emails by query
     */
    static async searchEmails(query: string): Promise<GmailEmail[]> {
        // Find search box
        const searchBox = document.querySelector('input[aria-label="Search mail"]') as HTMLInputElement;
        if (!searchBox) {
            throw new Error('Search box not found');
        }

        // Enter query
        searchBox.value = query;
        searchBox.dispatchEvent(new Event('input', { bubbles: true }));

        // Trigger search (press Enter)
        const enterEvent = new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            bubbles: true
        });
        searchBox.dispatchEvent(enterEvent);

        // Wait for results to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get results
        return this.getInboxEmails();
    }

    /**
     * Check if currently on Gmail
     */
    static isGmail(): boolean {
        return window.location.hostname === 'mail.google.com';
    }

    /**
     * Get unread count
     */
    static getUnreadCount(): number {
        const unreadEl = document.querySelector('.aim .aio span');
        const text = unreadEl?.textContent?.trim() || '0';
        return parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
    }
}
