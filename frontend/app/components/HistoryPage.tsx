'use client';

import { motion } from 'framer-motion';
import Sidebar from './Sidebar';
import ProfilePopup from './ProfilePopup';
import { useState } from 'react';

interface ChatSession {
    id: string;
    timestamp: string;
    messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
    preview: string;
}

interface HistoryPageProps {
    username?: string;
    email?: string;
    chatSessions?: ChatSession[];
    onHomeClick?: () => void;
    onSettingsClick?: () => void;
    onNewChat?: () => void;
    onRestoreSession?: (sessionId: string) => void;
    onDeleteSession?: (sessionId: string) => void;
    onLogout?: () => void;
    onLogoClick?: () => void;
    sidebarExpanded?: boolean;
    onToggleSidebar?: () => void;
}

export default function HistoryPage({
    username = '',
    email = '',
    chatSessions = [],
    onHomeClick,
    onSettingsClick,
    onNewChat,
    onRestoreSession,
    onDeleteSession,
    onLogout,
    onLogoClick,
    sidebarExpanded = false,
    onToggleSidebar,
}: HistoryPageProps) {
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Filter sessions by search
    const filteredSessions = chatSessions.filter(session =>
        session.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Group sessions by date
    const groupedSessions = filteredSessions.reduce((groups, session) => {
        const date = new Date(session.timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let groupKey: string;
        if (date.toDateString() === today.toDateString()) {
            groupKey = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            groupKey = 'Yesterday';
        } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
            groupKey = 'This Week';
        } else if (date > new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)) {
            groupKey = 'This Month';
        } else {
            groupKey = 'Older';
        }

        if (!groups[groupKey]) groups[groupKey] = [];
        groups[groupKey].push(session);
        return groups;
    }, {} as Record<string, ChatSession[]>);

    const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
            <Sidebar
                onHomeClick={onHomeClick}
                onProfileClick={() => setShowProfilePopup(true)}
                onSettingsClick={onSettingsClick}
                onLogoClick={onLogoClick}
                onNewChat={onNewChat}
                onHistoryClick={() => { }} // Already on history
                chatSessions={chatSessions}
                onRestoreSession={onRestoreSession}
                onDeleteSession={onDeleteSession}
                isExpanded={sidebarExpanded}
                onToggleExpand={onToggleSidebar}
            />

            <ProfilePopup
                isOpen={showProfilePopup}
                onClose={() => setShowProfilePopup(false)}
                username={username}
                email={email}
                onLogout={onLogout}
            />

            {/* Main Content */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, marginLeft: sidebarExpanded ? 280 : 64 }}
                transition={{ duration: 0.3 }}
                className="min-h-screen p-8"
            >
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                            Chat History
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400">
                            Browse and continue your previous conversations
                        </p>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-6">
                        <div className="relative">
                            <svg
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all"
                            />
                        </div>
                    </div>

                    {/* Sessions List */}
                    {filteredSessions.length === 0 ? (
                        <div className="text-center py-16">
                            <svg
                                className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-4">
                                {searchQuery ? 'Try a different search term' : 'Start a new chat to begin'}
                            </p>
                            <button
                                onClick={onNewChat}
                                className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
                            >
                                New Chat
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {groupOrder.map(groupKey => {
                                const sessions = groupedSessions[groupKey];
                                if (!sessions || sessions.length === 0) return null;

                                return (
                                    <div key={groupKey}>
                                        <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                                            {groupKey}
                                        </h2>
                                        <div className="space-y-2">
                                            {sessions.map((session, index) => (
                                                <motion.div
                                                    key={session.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index * 0.05 }}
                                                    onClick={() => onRestoreSession?.(session.id)}
                                                    className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer transition-all hover:shadow-md"
                                                >
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                                                                {session.preview}
                                                            </h3>
                                                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                                                {session.messages.length} messages • {new Date(session.timestamp).toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    onDeleteSession?.(session.id);
                                                                }}
                                                                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all"
                                                                title="Delete"
                                                            >
                                                                <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                </svg>
                                                            </button>
                                                            <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                            </svg>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
