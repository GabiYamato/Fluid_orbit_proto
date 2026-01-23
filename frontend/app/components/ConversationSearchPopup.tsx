'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface ChatSession {
    id: string;
    timestamp: string;
    messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
    preview: string;
}

interface ConversationSearchPopupProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: ChatSession[];
    onRestoreSession: (sessionId: string) => void;
    onDeleteSession?: (sessionId: string) => void;
}

export default function ConversationSearchPopup({
    isOpen,
    onClose,
    sessions,
    onRestoreSession,
    onDeleteSession,
}: ConversationSearchPopupProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredSessions, setFilteredSessions] = useState<ChatSession[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            setFilteredSessions(sessions);
        } else {
            setSearchQuery('');
        }
    }, [isOpen, sessions]);

    // Handle search filtering
    useEffect(() => {
        if (!searchQuery.trim()) {
            setFilteredSessions(sessions);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = sessions.filter(
            (session) =>
                session.preview.toLowerCase().includes(query) ||
                session.messages.some((m) => m.content.toLowerCase().includes(query))
        );
        setFilteredSessions(filtered);
    }, [searchQuery, sessions]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />

                    {/* Popup */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        transition={{ type: 'spring', duration: 0.3 }}
                        className="fixed inset-0 m-auto w-full max-w-2xl h-[600px] max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-gray-200 dark:border-gray-700"
                    >
                        {/* Header / Search Input */}
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
                            <svg
                                className="w-5 h-5 text-gray-400 flex-shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                />
                            </svg>
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search conversations..."
                                className="flex-1 bg-transparent border-none outline-none text-lg text-gray-900 dark:text-gray-100 placeholder:text-gray-400 font-medium h-10"
                            />
                            <button
                                onClick={onClose}
                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                title="Close"
                            >
                                <svg
                                    className="w-5 h-5 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                    />
                                </svg>
                            </button>
                        </div>

                        {/* Results List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            {filteredSessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                                    <svg
                                        className="w-16 h-16 text-gray-200 dark:text-gray-700 mb-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={1.5}
                                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                        />
                                    </svg>
                                    <p className="text-gray-500 dark:text-gray-400 font-medium">
                                        {searchQuery ? 'No conversations found matching your search.' : 'No conversations history.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {filteredSessions.map((session) => (
                                        <motion.div
                                            key={session.id}
                                            layout
                                            onClick={() => {
                                                onRestoreSession(session.id);
                                                onClose();
                                            }}
                                            className="group flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-gray-700 transition-all"
                                        >
                                            <div className="flex-1 min-w-0 pr-4">
                                                <h4 className="text-gray-900 dark:text-gray-100 font-medium truncate mb-1">
                                                    {session.preview}
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                                    <span>{new Date(session.timestamp).toLocaleDateString()}</span>
                                                    <span>•</span>
                                                    <span>{session.messages.length} messages</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {onDeleteSession && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteSession(session.id);
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                        title="Delete"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                )}
                                                <div className="p-2 text-gray-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
