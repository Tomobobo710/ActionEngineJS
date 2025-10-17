class MemoryPalaceAPI {
    static API_BASE_URL = '/api/blocks'; // Base URL for block-related API endpoints

    static async request(method, endpoint, data = null) {
        const url = `${MemoryPalaceAPI.API_BASE_URL}${endpoint}`;
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API request failed with status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            // console.error(`MemoryPalaceAPI Error (${method} ${url}):`, error);
            throw error;
        }
    }

    // Health check
    static async healthCheck() {
        try {
            const response = await fetch('/api/health', { method: 'GET' });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `API health check failed with status ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            // console.error(`MemoryPalaceAPI Error (healthCheck):`, error);
            throw error;
        }
    }

    // Block operations
    static async getAllBlocks() {
        return this.request('GET', '/');
    }

    static async getBlock(id) {
        return this.request('GET', `/${id}`);
    }

    static async createBlock(blockData) {
        return this.request('POST', '/', blockData);
    }

    static async updateBlock(id, blockData) {
        return this.request('PUT', `/${id}`, blockData);
    }

    static async deleteBlock(id) {
        return this.request('DELETE', `/${id}`);
    }

    static async bulkSaveBlocks(blocks) {
        return this.request('POST', '/bulk', { blocks });
    }

    // Camera state operations
    static async getCameraState() {
        return this.request('GET', '/camera/state');
    }

    static async saveCameraState(position, rotation) {
        return this.request('PUT', '/camera/state', { position, rotation });
    }

    // Statistics
    static async getStatistics() {
        return this.request('GET', '/stats');
    }
}

export { MemoryPalaceAPI };