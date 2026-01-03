'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Search, History, LogOut, Sparkles, Star, ExternalLink, Clock, AlertCircle, Zap } from 'lucide-react';

interface Product {
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
}

interface Recommendation {
    product: Product;
    rank: number;
    pros: string[];
    cons: string[];
    pick_type: string | null;
}

interface QueryResult {
    query: string;
    recommendations: Recommendation[];
    summary: string;
    data_source: string;
    confidence_level: string;
    disclaimer: string | null;
    response_time_ms: number;
}

export default function HomePage() {
    const router = useRouter();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [result, setResult] = useState<QueryResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Check auth on mount and whenever the window gets focus (returning from login)
    useEffect(() => {
        const checkAuth = () => {
            const authenticated = api.isAuthenticated();
            setIsAuthenticated(authenticated);
            setIsLoading(false);
        };

        checkAuth();

        // Re-check when window regains focus (user returns from login page)
        window.addEventListener('focus', checkAuth);
        return () => window.removeEventListener('focus', checkAuth);
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        setIsSearching(true);
        setError(null);
        setResult(null);

        try {
            const data = await api.queryProducts(query);
            setResult(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setIsSearching(false);
        }
    };

    const handleLogout = async () => {
        await api.logout();
        setIsAuthenticated(false);
        setResult(null);
    };

    const getSourceBadge = (source: string) => {
        switch (source) {
            case 'indexed':
                return <span className="badge badge-success"><Zap size={12} /> Indexed</span>;
            case 'external_api':
                return <span className="badge badge-warning"><ExternalLink size={12} /> External</span>;
            case 'demo':
                return <span className="badge badge-accent"><Sparkles size={12} /> Demo</span>;
            default:
                return <span className="badge">{source}</span>;
        }
    };

    const getPickBadge = (pickType: string | null) => {
        if (!pickType) return null;
        switch (pickType) {
            case 'best':
                return <span className="badge badge-success">🏆 Best Pick</span>;
            case 'value':
                return <span className="badge badge-accent">💎 Best Value</span>;
            case 'budget':
                return <span className="badge badge-warning">💰 Budget Pick</span>;
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="app-layout">
                <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="spinner" />
                </div>
            </div>
        );
    }

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
                    {isAuthenticated ? (
                        <>
                            <button className="btn btn-ghost" onClick={() => router.push('/history')}>
                                <History size={18} />
                                History
                            </button>
                            <button className="btn btn-ghost" onClick={handleLogout}>
                                <LogOut size={18} />
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn btn-ghost" onClick={() => router.push('/login')}>
                                Login
                            </button>
                            <button className="btn btn-primary" onClick={() => router.push('/signup')}>
                                Get Started
                            </button>
                        </>
                    )}
                </nav>
            </header>

            {/* Main Content */}
            <main className="main-content">
                {/* Search Section */}
                <section className="search-section">
                    <h1 className="search-title">
                        Find Your <span>Perfect</span> Product
                    </h1>
                    <p className="search-subtitle">
                        AI-powered recommendations with transparent scoring. No BS. Just facts.
                    </p>

                    <form onSubmit={handleSearch}>
                        <div className="search-box">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="e.g., best wireless earbuds under $100 for running"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                disabled={isSearching}
                            />
                            <button type="submit" className="btn btn-primary search-btn" disabled={isSearching}>
                                {isSearching ? (
                                    <div className="spinner" style={{ width: 20, height: 20 }} />
                                ) : (
                                    <>
                                        <Search size={18} />
                                        Search
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </section>

                {/* Error Display */}
                {error && (
                    <div className="response-summary fade-in" style={{ borderColor: 'var(--error)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <AlertCircle size={20} color="var(--error)" />
                            <span style={{ color: 'var(--error)' }}>{error}</span>
                        </div>
                    </div>
                )}

                {/* Results Section */}
                {result && (
                    <section className="results-section fade-in">
                        {/* Response Summary */}
                        <div className="response-summary">
                            <p className="summary-text">{result.summary}</p>
                            {result.disclaimer && (
                                <p className="summary-disclaimer">
                                    <AlertCircle size={14} style={{ display: 'inline', marginRight: 6 }} />
                                    {result.disclaimer}
                                </p>
                            )}
                        </div>

                        {/* Results Header */}
                        <div className="results-header">
                            <h2 className="results-title">
                                Top {result.recommendations.length} Recommendations
                            </h2>
                            <div className="results-meta">
                                {getSourceBadge(result.data_source)}
                                <span>
                                    <Clock size={14} style={{ display: 'inline', marginRight: 4 }} />
                                    {result.response_time_ms}ms
                                </span>
                            </div>
                        </div>

                        {/* Products List */}
                        <div className="results-list">
                            {result.recommendations.map((rec) => (
                                <div key={rec.product.id} className="card product-card">
                                    <img
                                        src={rec.product.image_url || 'https://placehold.co/400x400?text=No+Image'}
                                        alt={rec.product.title}
                                        className="product-image"
                                    />

                                    <div className="product-content">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                            <span className="product-rank">{rec.rank}</span>
                                            {getPickBadge(rec.pick_type)}
                                        </div>

                                        <h3 className="product-title">{rec.product.title}</h3>

                                        <div className="product-meta">
                                            <span className="product-rating">
                                                <Star size={16} fill="currentColor" />
                                                {rec.product.rating?.toFixed(1) || 'N/A'}
                                            </span>
                                            <span>{rec.product.review_count?.toLocaleString() || 0} reviews</span>
                                        </div>

                                        {(rec.pros.length > 0 || rec.cons.length > 0) && (
                                            <div className="product-pros-cons">
                                                {rec.pros.length > 0 && (
                                                    <ul className="pros-cons-list pros">
                                                        {rec.pros.map((pro, i) => (
                                                            <li key={i}>{pro}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {rec.cons.length > 0 && (
                                                    <ul className="pros-cons-list cons">
                                                        {rec.cons.map((con, i) => (
                                                            <li key={i}>{con}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="product-sidebar">
                                        <div className="product-price">
                                            ${rec.product.price?.toFixed(2) || 'N/A'}
                                        </div>
                                        <div className="product-source">
                                            {getSourceBadge(rec.product.source)}
                                        </div>

                                        <a
                                            href={rec.product.affiliate_url || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-primary"
                                            style={{ width: '100%' }}
                                        >
                                            <ExternalLink size={16} />
                                            View Deal
                                        </a>

                                        {rec.product.scores && (
                                            <div className="product-scores">
                                                <div className="score-row">
                                                    <span className="score-label">Price</span>
                                                    <span className="score-value">{rec.product.scores.price_score}</span>
                                                </div>
                                                <div className="score-row">
                                                    <span className="score-label">Rating</span>
                                                    <span className="score-value">{rec.product.scores.rating_score}</span>
                                                </div>
                                                <div className="score-row">
                                                    <span className="score-label">Reviews</span>
                                                    <span className="score-value">{rec.product.scores.review_volume_score}</span>
                                                </div>
                                                <div className="score-row">
                                                    <span className="score-label">Match</span>
                                                    <span className="score-value">{rec.product.scores.spec_match_score}</span>
                                                </div>
                                                <div className="score-row final-score">
                                                    <span className="score-label">Overall</span>
                                                    <span className="score-value">{rec.product.scores.final_score}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Empty State */}
                {!result && !error && !isSearching && (
                    <div className="empty-state">
                        <Search size={80} className="empty-icon" strokeWidth={1} />
                        <h3 className="empty-title">Ready to find the perfect product?</h3>
                        <p className="empty-text">
                            Ask a question like "best noise cancelling headphones for travel" or "budget gaming mouse under $50"
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
