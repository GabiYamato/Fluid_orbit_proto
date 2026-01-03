'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Sparkles, ArrowLeft, Trash2, Clock, Search, AlertCircle } from 'lucide-react';

interface QueryHistoryItem {
    id: string;
    query_text: string;
    response_summary: string | null;
    source_type: string | null;
    created_at: string;
}

export default function HistoryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [history, setHistory] = useState<QueryHistoryItem[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!api.isAuthenticated()) {
            router.push('/login');
            return;
        }

        loadHistory();
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
            setHistory(history.filter(q => q.id !== id));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        }
    };

    const handleClearAll = async () => {
        if (!confirm('Are you sure you want to clear all history?')) return;

        try {
            await api.clearHistory();
            setHistory([]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to clear history');
        }
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

    return (
        <div className="app-layout">
            {/* Header */}
            <header className="header">
                <div className="logo">
                    <div className="logo-icon">
                        <Sparkles size={18} color="white" />
                    </div>
                    <span>ShopGPT</span>
                </div>
                <nav className="nav-links">
                    <button className="btn btn-ghost" onClick={() => router.push('/')}>
                        <ArrowLeft size={18} />
                        Back
                    </button>
                </nav>
            </header>

            {/* Main Content */}
            <main className="main-content">
                <div className="container" style={{ maxWidth: 800 }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 32
                    }}>
                        <h1 style={{ fontSize: 28, fontWeight: 700 }}>Query History</h1>
                        {history.length > 0 && (
                            <button className="btn btn-ghost" onClick={handleClearAll}>
                                <Trash2 size={16} />
                                Clear All
                            </button>
                        )}
                    </div>

                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '12px 16px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 24,
                            color: 'var(--error)',
                            fontSize: 14,
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    {isLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
                            <div className="spinner" />
                        </div>
                    ) : history.length === 0 ? (
                        <div className="empty-state">
                            <Search size={80} className="empty-icon" strokeWidth={1} />
                            <h3 className="empty-title">No search history yet</h3>
                            <p className="empty-text">
                                Your product searches will appear here
                            </p>
                            <button
                                className="btn btn-primary"
                                style={{ marginTop: 24 }}
                                onClick={() => router.push('/')}
                            >
                                Start Searching
                            </button>
                        </div>
                    ) : (
                        <div className="history-list">
                            {history.map((item) => (
                                <div key={item.id} className="card history-item">
                                    <div style={{ flex: 1 }}>
                                        <p className="history-query">{item.query_text}</p>
                                        {item.response_summary && (
                                            <p style={{
                                                fontSize: 13,
                                                color: 'var(--text-muted)',
                                                marginTop: 4,
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                maxWidth: 500,
                                            }}>
                                                {item.response_summary}
                                            </p>
                                        )}
                                        <p className="history-date">
                                            <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                                            {formatDate(item.created_at)}
                                            {item.source_type && (
                                                <span className="badge" style={{ marginLeft: 8 }}>
                                                    {item.source_type}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <button
                                        className="btn btn-ghost"
                                        onClick={() => handleDelete(item.id)}
                                        style={{ padding: 8 }}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
