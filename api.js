/**
 * Memory Palace API Client
 * Handles all communication with the backend server
 */
class MemoryPalaceAPI {
    static BASE_URL = window.location.origin + '/api';
    static timeout = 10000; // 10 second timeout

    /**
     * Make an API request with timeout and error handling
     */
    static async request(endpoint, options = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(`${this.BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                signal: controller.signal,
                ...options
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('Request timeout - server not responding');
            }

            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    }

    // Block operations
    static async getAllBlocks() {
        return this.request('/blocks');
    }

    static async getBlock(id) {
        return this.request(`/blocks/${id}`);
    }

    static async createBlock(blockData) {
        return this.request('/blocks', {
            method: 'POST',
            body: JSON.stringify(blockData)
        });
    }

    static async updateBlock(id, blockData) {
        return this.request(`/blocks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(blockData)
        });
    }

    static async deleteBlock(id) {
        return this.request(`/blocks/${id}`, {
            method: 'DELETE'
        });
    }

    static async bulkSaveBlocks(blocks) {
        return this.request('/blocks/bulk', {
            method: 'POST',
            body: JSON.stringify({ blocks })
        });
    }

    // Camera state
    static async getCameraState() {
        return this.request('/blocks/camera/state');
    }

    static async saveCameraState(position, rotation) {
        return this.request('/blocks/camera/state', {
            method: 'PUT',
            body: JSON.stringify({ position, rotation })
        });
    }

    // Statistics
    static async getStatistics() {
        return this.request('/blocks/stats');
    }

    // Health check
    static async healthCheck() {
        return this.request('/health');
    }
}