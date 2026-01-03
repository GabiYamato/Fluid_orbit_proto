'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Home, History, Settings, LogOut, Trash2, Clock, Search } from 'lucide-react';

interface HistoryItem {
    id: string;
    query_text: string;
    response_summary: string | null;
    source_type: string | null;
    created_at: string;
}

export default function HistoryPage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkAuth = () => {
            if (!api.isAuthenticated()) {
                router.push('/login');
                return;
            }
            setIsAuthenticated(true);
            loadHistory();
        };
        checkAuth();
    }, [router]);

    const loadHistory = async () => {
        try {
            const data = await api.getQueryHistory();
            setHistory(data.queries);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load history');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.deleteQueryFromHistory(id);
            setHistory(prev => prev.filter(item => item.id !== id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Clear all history?')) return;
        try {
            await api.clearHistory();
            setHistory([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clear history');
        }
    };

    const handleLogout = async () => {
        await api.logout();
        router.push('/login');
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (isLoading) {
        return (
            <div className="app-layout">
                <div className="main-wrapper">
                    <div className="main-content" style={{ justifyContent: 'center' }}>
                        <div className="spinner" style={{ borderColor: 'var(--gray-200)', borderTopColor: 'var(--gray-600)' }} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <div className="sidebar-logo" style={{ background: 'none', padding: 0 }}>
                    <img src="/fluidorbitlogo.jpg" alt="ShopGPT" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                </div>

                <nav className="sidebar-nav">
                    <div className="sidebar-link" onClick={() => router.push('/')}>
                        <Home size={20} />
                    </div>
                    <div className="sidebar-link active">
                        <History size={20} />
                    </div>
                </nav>

                <div className="sidebar-bottom">
                    <div className="sidebar-link">
                        <Settings size={20} />
                    </div>
                    <div className="sidebar-link" onClick={handleLogout}>
                        <LogOut size={20} />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-wrapper">
                <div className="history-container">
                    <div className="history-header">
                        <h1 className="history-title">Search History</h1>
                        {history.length > 0 && (
                            <button className="btn btn-ghost" onClick={handleClearAll}>
                                <Trash2 size={16} />
                                Clear All
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="error-message" style={{ marginBottom: 'var(--space-lg)' }}>
                            {error}
                        </div>
                    )}

                    {history.length === 0 ? (
                        <div className="empty-state">
                            <Search size={48} className="empty-icon" strokeWidth={1} />
                            <h3 className="empty-title">No search history yet</h3>
                            <p className="empty-text">Your product searches will appear here</p>
                            <button className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }} onClick={() => router.push('/')}>
                                Start Searching
                            </button>
                        </div>
                    ) : (
                        <div className="history-list">
                            {history.map((item) => (
                                <div key={item.id} className="card history-item">
                                    <div style={{ flex: 1 }}>
                                        <p className="history-query">{item.query_text}</p>
                                        <p className="history-date">
                                            <Clock size={12} />
                                            {formatDate(item.created_at)}
                                        </p>
                                    </div>
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => handleDelete(item.id)}
                                        style={{ padding: 'var(--space-sm)' }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
