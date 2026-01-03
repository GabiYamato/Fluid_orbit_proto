const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ApiError {
    detail: string | { message: string };
}

class ApiClient {
    setToken(token: string | null) {
        if (typeof window !== 'undefined') {
            if (token) {
                localStorage.setItem('accessToken', token);
            } else {
                localStorage.removeItem('accessToken');
            }
        }
    }

    getToken(): string | null {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('accessToken');
        }
        return null;
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        retries: number = 2
    ): Promise<T> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        const token = this.getToken();
        if (token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(`${API_URL}${endpoint}`, {
                    ...options,
                    headers,
                    credentials: 'include',
                });

                if (!response.ok) {
                    const error: ApiError = await response.json().catch(() => ({ detail: 'Request failed' }));
                    const message = typeof error.detail === 'string'
                        ? error.detail
                        : error.detail?.message || 'Request failed';
                    throw new Error(message);
                }

                return response.json();
            } catch (err) {
                lastError = err instanceof Error ? err : new Error('Network error');

                // Only retry on network errors (Failed to fetch), not HTTP errors
                if (lastError.message !== 'Failed to fetch' || attempt === retries) {
                    throw lastError;
                }

                // Wait a bit before retrying
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        throw lastError || new Error('Request failed');
    }

    // Auth endpoints
    async signup(email: string, password: string) {
        const data = await this.request<{ access_token: string; expires_in: number }>('/auth/signup', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.access_token);
        return data;
    }

    async login(email: string, password: string) {
        const data = await this.request<{ access_token: string; expires_in: number }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        this.setToken(data.access_token);
        return data;
    }

    async logout() {
        try {
            await this.request('/auth/logout', { method: 'POST' });
        } finally {
            this.setToken(null);
        }
    }

    async getCurrentUser() {
        return this.request<{ id: string; email: string; created_at: string }>('/auth/me');
    }

    // Query endpoints
    async queryProducts(query: string, maxResults: number = 5) {
        return this.request<{
            query: string;
            parsed_intent: {
                category: string | null;
                budget_min: number | null;
                budget_max: number | null;
                features: string[];
                brand_preferences: string[];
                use_case: string | null;
            };
            recommendations: Array<{
                product: {
                    id: string;
                    title: string;
                    description: string;
                    price: number;
                    rating: number;
                    review_count: number;
                    image_url: string;
                    affiliate_url: string;
                    source: string;
                    scores: {
                        price_score: number;
                        rating_score: number;
                        review_volume_score: number;
                        spec_match_score: number;
                        final_score: number;
                    };
                };
                rank: number;
                pros: string[];
                cons: string[];
                pick_type: string | null;
            }>;
            summary: string;
            data_source: string;
            confidence_level: string;
            disclaimer: string | null;
            response_time_ms: number;
        }>('/query', {
            method: 'POST',
            body: JSON.stringify({ query, max_results: maxResults }),
        });
    }

    // History endpoints
    async getQueryHistory(page: number = 1, perPage: number = 20) {
        return this.request<{
            queries: Array<{
                id: string;
                query_text: string;
                response_summary: string | null;
                source_type: string | null;
                created_at: string;
            }>;
            total: number;
            page: number;
            per_page: number;
        }>(`/history?page=${page}&per_page=${perPage}`);
    }

    async deleteQueryFromHistory(queryId: string) {
        return this.request(`/history/${queryId}`, { method: 'DELETE' });
    }

    async clearHistory() {
        return this.request('/history', { method: 'DELETE' });
    }
}

export const api = new ApiClient();
export default api;
