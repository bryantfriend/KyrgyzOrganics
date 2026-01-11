export class BaseTab {
    constructor(tabId) {
        this.tabId = tabId;
        this.container = document.getElementById(tabId);
        this.isInitialized = false;
    }

    /**
     * Called when the tab is switched to.
     */
    async show() {
        if (!this.container) return;

        // Hide all other tabs (Handled by Main Controller usually, but we ensure this one is shown)
        document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
        this.container.style.display = 'block';

        if (!this.isInitialized) {
            await this.init();
            this.isInitialized = true;
        } else {
            // Optional: called every time tab is shown if needed
            this.onShow();
        }
    }

    /**
     * Override this for one-time setup (listeners, initial fetch)
     */
    async init() {
        console.log(`Initializing ${this.tabId}...`);
    }

    /**
     * Override this for logic to run every time tab becomes active
     */
    onShow() {
        // no-op by default
    }
}
