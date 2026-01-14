'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import ChatHistoryPopup from './ChatHistoryPopup';

interface ChatSession {
  id: string;
  timestamp: string;
  messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
  preview: string;
}

interface SidebarProps {
  onHomeClick?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogoClick?: () => void;
  activeTab?: 'home' | 'profile' | 'settings';
  showProfilePopup?: boolean;
  chatSessions?: ChatSession[];
  onRestoreSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export default function Sidebar({
  onHomeClick,
  onProfileClick,
  onSettingsClick,
  onLogoClick,
  activeTab,
  showProfilePopup,
  chatSessions = [],
  onRestoreSession,
  onDeleteSession,
}: SidebarProps) {
  const [showChatHistory, setShowChatHistory] = useState(false);
  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed left-0 top-0 h-screen w-16 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-6 z-50 transition-colors duration-300"
    >
      {/* Logo */}
      <div
        className="relative mb-8"
        onMouseEnter={() => setShowChatHistory(true)}
        onMouseLeave={() => setShowChatHistory(false)}
      >
        <motion.div
          whileHover={{ scale: 1.1 }}
          className="cursor-pointer"
          onClick={onLogoClick}
        >
          <Image
            src="/fluidorbitlogo.jpg"
            alt="Fluid Orbit"
            width={40}
            height={40}
            className="rounded-full"
          />
        </motion.div>

        {/* Invisible bridge to maintain hover state */}
        {showChatHistory && (
          <div className="absolute left-10 top-0 w-4 h-full" />
        )}

        {/* Chat History Popup - positioned to be within hover area */}
        <div
          onMouseEnter={() => setShowChatHistory(true)}
          onMouseLeave={() => setShowChatHistory(false)}
        >
          {onRestoreSession && onDeleteSession && (
            <ChatHistoryPopup
              isOpen={showChatHistory}
              sessions={chatSessions}
              onRestoreSession={onRestoreSession}
              onDeleteSession={onDeleteSession}
            />
          )}
        </div>
      </div>

      {/* Navigation Icons */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Home Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onHomeClick}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${activeTab === 'home' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          title="Home"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </motion.button>

        {/* History Button */}
        <div
          className="relative"
          onMouseEnter={() => setShowChatHistory(true)}
          onMouseLeave={() => setShowChatHistory(false)}
        >
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Chat History"
          >
            <svg
              className="w-6 h-6 text-gray-700 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {chatSessions.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-black dark:bg-white text-white dark:text-black text-xs rounded-full flex items-center justify-center">
                {chatSessions.length}
              </span>
            )}
          </motion.button>

          {/* History Popup */}
          {onRestoreSession && onDeleteSession && (
            <ChatHistoryPopup
              isOpen={showChatHistory}
              sessions={chatSessions}
              onRestoreSession={(id) => {
                setShowChatHistory(false);
                onRestoreSession(id);
              }}
              onDeleteSession={onDeleteSession}
            />
          )}
        </div>
      </div>

      {/* Bottom Icons */}
      <div className="flex flex-col gap-6">
        {/* Profile Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onProfileClick}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${showProfilePopup ? 'bg-gray-200 dark:bg-gray-700' : activeTab === 'profile' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          title="Profile"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </motion.button>

        {/* Settings Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={onSettingsClick}
          className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          title="Settings"
        >
          <svg
            className="w-6 h-6 text-gray-700 dark:text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
}
