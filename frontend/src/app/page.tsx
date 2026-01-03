'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Search, Home, History, Settings, LogOut, Star, ExternalLink, Clock, AlertCircle, Zap, Sparkles, ArrowUp, Square } from 'lucide-react';

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

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant';
    content: string;
    recommendations?: Recommendation[];
    data_source?: string;
    response_time_ms?: number;
    isLoading?: boolean;
}

export default function HomePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const hasExecutedUrlQuery = useRef(false);

    useEffect(() => {
        const checkAuth = () => {
            const authenticated = api.isAuthenticated();
            setIsAuthenticated(authenticated);
            setIsLoading(false);
        };
        checkAuth();
        window.addEventListener('focus', checkAuth);
        return () => window.removeEventListener('focus', checkAuth);
    }, []);

    // Handle query from URL (from history page)
    useEffect(() => {
        const urlQuery = searchParams.get('q');
        if (urlQuery && !hasExecutedUrlQuery.current && !isLoading && isAuthenticated) {
            hasExecutedUrlQuery.current = true;
            // Clear URL param
            router.replace('/', { scroll: false });
            // Execute search
            executeSearch(urlQuery);
        }
    }, [searchParams, isLoading, isAuthenticated]);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const executeSearch = async (searchQuery: string) => {
        if (!searchQuery.trim() || isSearching) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            type: 'user',
            content: searchQuery,
        };

        const loadingMessage: ChatMessage = {
            id: (Date.now() + 1).toString(),
            type: 'assistant',
            content: 'Searching for the best products...',
            isLoading: true,
        };

        setMessages(prev => [...prev, userMessage, loadingMessage]);
        setQuery('');
        setIsSearching(true);

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const data = await api.queryProducts(searchQuery);

            const assistantMessage: ChatMessage = {
                id: loadingMessage.id,
                type: 'assistant',
                content: data.summary,
                recommendations: data.recommendations,
                data_source: data.data_source,
                response_time_ms: data.response_time_ms,
            };

            setMessages(prev => prev.map(m => m.id === loadingMessage.id ? assistantMessage : m));
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                setMessages(prev => prev.filter(m => m.id !== loadingMessage.id));
            } else {
                const errorMessage: ChatMessage = {
                    id: loadingMessage.id,
                    type: 'assistant',
                    content: err instanceof Error ? err.message : 'Something went wrong',
                };
                setMessages(prev => prev.map(m => m.id === loadingMessage.id ? errorMessage : m));
            }
        } finally {
            setIsSearching(false);
            setAbortController(null);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim() || isSearching) return;

        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        executeSearch(query);
    };

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setIsSearching(false);
        }
    };

    const handleLogout = async () => {
        await api.logout();
        setIsAuthenticated(false);
        setMessages([]);
    };

    const getSourceBadge = (source: string) => {
        switch (source) {
            case 'indexed':
                return <span className="badge badge-success"><Zap size={10} /> Indexed</span>;
            case 'external_api':
                return <span className="badge badge-warning"><ExternalLink size={10} /> External</span>;
            case 'demo':
                return <span className="badge badge-accent"><Sparkles size={10} /> Demo</span>;
            default:
                return <span className="badge">{source}</span>;
        }
    };

    const getPickBadge = (pickType: string | null) => {
        if (!pickType) return null;
        switch (pickType) {
            case 'best':
                return <span className="badge badge-success"><Star size={10} /> Best Pick</span>;
            case 'value':
                return <span className="badge badge-accent"><Sparkles size={10} /> Best Value</span>;
            case 'budget':
                return <span className="badge badge-warning"><Zap size={10} /> Budget Pick</span>;
            default:
                return null;
        }
    };

    if (isLoading) {
        return (
            <div className="app-layout">
                <div className="main-wrapper">
                    <div className="main-content" style={{ justifyContent: 'center' }}>
                        <div className="spinner" />
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
                    <div className="sidebar-link active">
                        <Home size={20} />
                    </div>
                    {isAuthenticated && (
                        <div className="sidebar-link" onClick={() => router.push('/history')}>
                            <History size={20} />
                        </div>
                    )}
                </nav>

                <div className="sidebar-bottom">
                    <div className="sidebar-link">
                        <Settings size={20} />
                    </div>
                    {isAuthenticated ? (
                        <div className="sidebar-link" onClick={handleLogout}>
                            <LogOut size={20} />
                        </div>
                    ) : (
                        <div className="sidebar-link" onClick={() => router.push('/login')}>
                            <LogOut size={20} />
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content */}
            <div className="main-wrapper">
                <main className="chat-container">
                    {/* Show Hero when no messages */}
                    {messages.length === 0 && (
                        <div className="hero-section fade-in">
                            <h1 className="hero-greeting">Hello,</h1>
                            <p className="hero-tagline">Shop at the Speed of Thought.</p>
                        </div>
                    )}

                    {/* Chat Messages */}
                    {messages.length > 0 && (
                        <div className="chat-messages">
                            {messages.map((message) => (
                                <div key={message.id} className={`chat-message ${message.type}`}>
                                    {message.type === 'user' ? (
                                        <div className="user-bubble">
                                            {message.content}
                                        </div>
                                    ) : (
                                        <div className="assistant-response">
                                            {message.isLoading ? (
                                                <div className="loading-indicator">
                                                    <div className="spinner" />
                                                    <span>{message.content}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    {message.recommendations && message.recommendations.length > 0 ? (
                                                        <>
                                                            <div className="response-header">
                                                                <p className="summary-text">{message.content}</p>
                                                                <div className="results-meta">
                                                                    {message.data_source && getSourceBadge(message.data_source)}
                                                                    {message.response_time_ms && (
                                                                        <span><Clock size={12} /> {message.response_time_ms}ms</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="products-grid">
                                                                {message.recommendations.map((rec) => (
                                                                    <div key={rec.product.id} className="product-card-mini">
                                                                        <img
                                                                            src={rec.product.image_url || 'https://placehold.co/200x200?text=No+Image'}
                                                                            alt={rec.product.title}
                                                                            className="product-image-mini"
                                                                        />
                                                                        <div className="product-info">
                                                                            <div className="product-header">
                                                                                <span className="product-rank">{rec.rank}</span>
                                                                                {getPickBadge(rec.pick_type)}
                                                                            </div>
                                                                            <h4 className="product-title-mini">{rec.product.title}</h4>
                                                                            <div className="product-meta">
                                                                                <span className="product-rating">
                                                                                    <Star size={12} fill="currentColor" />
                                                                                    {rec.product.rating?.toFixed(1) || 'N/A'}
                                                                                </span>
                                                                                <span className="product-price-mini">
                                                                                    ${rec.product.price?.toFixed(2) || 'N/A'}
                                                                                </span>
                                                                            </div>
                                                                            {rec.pros.length > 0 && (
                                                                                <ul className="pros-list-mini">
                                                                                    {rec.pros.slice(0, 2).map((pro, i) => (
                                                                                        <li key={i}>{pro}</li>
                                                                                    ))}
                                                                                </ul>
                                                                            )}
                                                                            <a
                                                                                href={rec.product.affiliate_url || '#'}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="btn btn-primary btn-sm"
                                                                            >
                                                                                <ExternalLink size={12} />
                                                                                View
                                                                            </a>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="error-message">
                                                            <AlertCircle size={16} />
                                                            {message.content}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </main>

                {/* Floating Search Bar */}
                <div className="search-container">
                    <form onSubmit={handleSearch}>
                        <div className="search-box">
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Shop Anything..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                disabled={isSearching}
                            />
                            {isSearching ? (
                                <button type="button" className="search-btn stop-btn" onClick={handleStop}>
                                    <Square size={16} fill="currentColor" />
                                </button>
                            ) : (
                                <button type="submit" className="search-btn" disabled={!query.trim()}>
                                    <ArrowUp size={20} />
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
