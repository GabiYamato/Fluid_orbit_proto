'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '@/lib/api';
import { Search, Home, History, Settings, LogOut, Star, ExternalLink, Clock, AlertCircle, Zap, Sparkles, ArrowUp, Square, PlusCircle } from 'lucide-react';

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
    isLoadingMore?: boolean;
    loadingStatus?: string;
    scrapedCount?: number;
    visibleCount?: number;
}


const FakeLoader = ({ status, realCount }: { status: string, realCount?: number }) => {
    const [displayCount, setDisplayCount] = useState(0);
    const [msgIndex, setMsgIndex] = useState(0);

    // Animate to realCount
    useEffect(() => {
        if (realCount && realCount > 0 && displayCount < realCount) {
            const interval = setInterval(() => {
                setDisplayCount(prev => {
                    const diff = realCount - prev;
                    if (diff <= 0) return realCount;
                    const step = Math.max(1, Math.floor(diff / 5));
                    return prev + step;
                });
            }, 50);
            return () => clearInterval(interval);
        }
    }, [realCount, displayCount]);

    // Cycle messages
    useEffect(() => {
        if (realCount && displayCount >= realCount) {
            const interval = setInterval(() => {
                setMsgIndex(prev => (prev + 1) % 4);
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [realCount, displayCount]);

    const messages = [
        "Analyzing specs...",
        "Measuring demand...",
        "Checking reviews...",
        "Preparing results..."
    ];

    if (!realCount || realCount === 0) {
        return (
            <span className="loading-status-text" style={{ color: '#444', fontWeight: 500 }}>
                {status}
            </span>
        );
    }

    let content;
    if (displayCount < realCount) {
        content = <>Found <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{displayCount}</span> products...</>;
    } else {
        content = <>{messages[msgIndex]}</>;
    }

    return (
        <span className="loading-status-text" style={{ color: '#444', fontWeight: 500 }}>
            {content}
        </span>
    );
};
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

    // Handle Google OAuth token from URL
    useEffect(() => {
        const accessToken = searchParams.get('access_token');
        if (accessToken && typeof window !== 'undefined') {
            localStorage.setItem('accessToken', accessToken);
            setIsAuthenticated(true);
            // Clear the token from URL
            router.replace('/', { scroll: false });
        }
    }, [searchParams, router]);

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

    const executeSearch = async (searchQuery: string, offset: number = 0) => {
        if ((!searchQuery.trim() && offset === 0) || isSearching) return;

        let assistantMessageId: string;

        if (offset === 0) {
            // New Search
            const userMessage: ChatMessage = {
                id: Date.now().toString(),
                type: 'user',
                content: searchQuery,
            };

            const loadingMessage: ChatMessage = {
                id: (Date.now() + 1).toString(),
                type: 'assistant',
                content: '',
                isLoading: true,
                recommendations: [],
                visibleCount: 3,
            };

            setMessages(prev => [...prev, userMessage, loadingMessage]);
            setQuery('');
            assistantMessageId = loadingMessage.id;
        } else {
            // Load More
            const lastMsg = messages[messages.length - 1];
            if (lastMsg.type === 'assistant') {
                assistantMessageId = lastMsg.id;
                // Set loading state for "Show More"
                setMessages(prev => prev.map(m =>
                    m.id === assistantMessageId ? { ...m, isLoadingMore: true } : m
                ));
            } else {
                return;
            }
        }

        setIsSearching(true);

        // Keep track of products count for rank
        const currentRankStart = offset + 1;
        const limit = 50;

        // Construct history
        const history = messages.slice(-4).map(m => {
            let content = m.content;
            if (m.type === 'assistant' && m.recommendations && m.recommendations.length > 0) {
                const products = m.recommendations.map(r => r.product.title).join(', ');
                content += `\n[Items shown: ${products}]`;
            }
            return { role: m.type, content: content || '' };
        });

        await api.streamQuery(
            searchQuery || messages[messages.length - 2]?.content || '',
            history,
            limit,
            offset,
            {
                onProducts: (products: any[]) => {
                    const newRecs = products.map((p: Product, i: number) => ({
                        product: p,
                        rank: currentRankStart + i,
                        pros: [],
                        cons: [],
                        pick_type: null,
                    }));

                    setMessages(prev => prev.map(m => {
                        if (m.id === assistantMessageId) {
                            return {
                                ...m,
                                recommendations: offset === 0 ? newRecs : [...(m.recommendations || []), ...newRecs],
                                data_source: 'mixed',
                                isLoadingMore: false, // Turn off skeleton
                            };
                        }
                        return m;
                    }));
                },
                onStatus: (status) => {
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const msgIndex = newMessages.findIndex(m => m.id === assistantMessageId);
                        if (msgIndex !== -1) {
                            newMessages[msgIndex].loadingStatus = status;
                        }
                        return newMessages;
                    });
                },
                onScrapedCount: (count) => {
                    setMessages((prev) => {
                        const newMessages = [...prev];
                        const msgIndex = newMessages.findIndex(m => m.id === assistantMessageId);
                        if (msgIndex !== -1) {
                            newMessages[msgIndex].scrapedCount = count;
                        }
                        return newMessages;
                    });
                },
                onToken: (text) => {
                    setMessages(prev => prev.map(m => {
                        if (m.id === assistantMessageId) {
                            return {
                                ...m,
                                content: m.content + text,
                            };
                        }
                        return m;
                    }));
                },
                onDone: () => {
                    setIsSearching(false);
                    setMessages(prev => prev.map(m =>
                        m.id === assistantMessageId ? { ...m, isLoading: false, isLoadingMore: false } : m
                    ));
                },
                onError: (err) => {
                    console.error('Streaming error:', err);
                    setMessages(prev => prev.map(m => {
                        if (m.id === assistantMessageId) {
                            return {
                                ...m,
                                isLoading: false,
                                isLoadingMore: false,
                                content: m.content || 'Sorry, something went wrong while searching.',
                            };
                        }
                        return m;
                    }));
                    setIsSearching(false);
                }
            }
        );
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
                    <div className="sidebar-link" onClick={() => {
                        setMessages([]);
                        setQuery('');
                        handleStop();
                    }} title="New Chat">
                        <PlusCircle size={20} />
                    </div>

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
                                            {message.isLoading && !message.content && (!message.recommendations || message.recommendations.length === 0) ? (
                                                <div className="loading-indicator">
                                                    <div className="spinner" />
                                                    <FakeLoader status={message.loadingStatus || 'Searching...'} realCount={message.scrapedCount} />
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Text Response Moved Below */}

                                                    {/* Products Grid */}
                                                    {message.recommendations && message.recommendations.length > 0 ? (
                                                        <>
                                                            <div className="products-grid fade-in">
                                                                {message.recommendations.slice(0, message.visibleCount || 3).map((rec) => (
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
                                                                {/* Skeletons for Load More */}
                                                                {message.isLoadingMore && Array.from({ length: 5 }).map((_, i) => (
                                                                    <div key={`skeleton-${i}`} className="product-card-mini skeleton-card">
                                                                        <div className="skeleton-image" />
                                                                        <div className="product-info">
                                                                            <div className="skeleton-line short" />
                                                                            <div className="skeleton-line medium" />
                                                                            <div className="skeleton-line long" />
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {/* Show More Button */}
                                                            {!message.isLoading && !isSearching && message.recommendations && message.recommendations.length > 0 && (
                                                                <div style={{ textAlign: 'center', marginTop: 20 }}>
                                                                    <button
                                                                        className="nav-cta"
                                                                        onClick={() => {
                                                                            const visible = message.visibleCount || 3;
                                                                            if (visible < (message.recommendations?.length || 0)) {
                                                                                // Show more locally
                                                                                setMessages(prev => prev.map(m =>
                                                                                    m.id === message.id ? { ...m, visibleCount: visible + 10 } : m
                                                                                ));
                                                                            } else {
                                                                                // Fetch more from server
                                                                                const msgIndex = messages.findIndex(m => m.id === message.id);
                                                                                const userMsg = messages[msgIndex - 1];
                                                                                if (userMsg) {
                                                                                    executeSearch(userMsg.content, message.recommendations?.length);
                                                                                }
                                                                            }
                                                                        }}
                                                                        style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                                                                    >
                                                                        Show More Results
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </>
                                                    ) : null}

                                                    {/* Text Response (Markdown) - Now Below */}
                                                    {message.content && (
                                                        <div className="response-footer markdown-body" style={{ marginTop: 16 }}>
                                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                                {message.content}
                                                            </ReactMarkdown>
                                                            {message.isLoading && <span className="cursor-blink">▍</span>}
                                                        </div>
                                                    )}
                                                    {/* Error State */}
                                                    {!message.isLoading && message.type === 'assistant' && !message.content && (!message.recommendations || message.recommendations.length === 0) && (
                                                        <div className="error-message">
                                                            <AlertCircle size={16} />
                                                            Sorry, I couldn't find any products matching that.
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
                            <textarea
                                className="search-input"
                                placeholder="Shop Anything..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSearch(e);
                                    }
                                }}
                                disabled={isSearching}
                                rows={1}
                                style={{ resize: 'none', minHeight: 44, maxHeight: 120, height: 'auto', paddingTop: 12 }}
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
