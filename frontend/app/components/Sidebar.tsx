'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';

interface ChatSession {
  id: string;
  timestamp: string;
  messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
  preview: string;
}

interface SavedProduct {
  id: string;
  title: string;
  price?: number;
  image_url?: string;
  affiliate_url: string;
}

interface SidebarProps {
  onHomeClick?: () => void;
  onProfileClick?: () => void;
  onSettingsClick?: () => void;
  onLogoClick?: () => void;
  onNewChat?: () => void;
  onHistoryClick?: () => void;
  onSavedProductsClick?: () => void;
  activeTab?: 'home' | 'profile' | 'settings' | 'saved';
  showProfilePopup?: boolean;
  chatSessions?: ChatSession[];
  savedProducts?: SavedProduct[];
  onRestoreSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onRemoveSavedProduct?: (productId: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export default function Sidebar({
  onHomeClick,
  onProfileClick,
  onSettingsClick,
  onLogoClick,
  onNewChat,
  onHistoryClick,
  onSavedProductsClick,
  activeTab,
  showProfilePopup,
  chatSessions = [],
  savedProducts = [],
  onRestoreSession,
  onDeleteSession,
  onRemoveSavedProduct,
  isExpanded = false,
  onToggleExpand,
}: SidebarProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);
  const expanded = onToggleExpand ? isExpanded : localExpanded;
  const toggleExpand = onToggleExpand || (() => setLocalExpanded(!localExpanded));
  const [chatsVisible, setChatsVisible] = useState(true);

  // Show all past chats (like ChatGPT)
  const allChats = chatSessions;

  return (
    <motion.div
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1, width: expanded ? 280 : 64 }}
      transition={{ duration: 0.3 }}
      className="fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col py-4 z-50 transition-colors duration-300"
    >
      {/* Header Section */}
      <div className="px-3 mb-4">
        {/* Logo and Expand Button */}
        <div className="flex items-center justify-between mb-4">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="cursor-pointer flex items-center gap-3"
            onClick={onLogoClick}
          >
            <img
              src="/fluid-orbit-infinity-logo.png"
              alt="Fluid Orbit"
              className="w-9 h-9 object-contain"
            />
            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-semibold text-gray-900 dark:text-white text-sm whitespace-nowrap overflow-hidden"
                >
                  Fluid Orbit
                </motion.span>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Expand/Collapse Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={toggleExpand}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </motion.button>
        </div>

        {/* New Chat Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewChat}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-black dark:bg-white text-white dark:text-black font-medium transition-colors hover:bg-gray-800 dark:hover:bg-gray-200 ${!expanded ? 'justify-center' : ''}`}
        >
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm whitespace-nowrap overflow-hidden"
              >
                New Chat
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Navigation */}
      <div className="px-3 space-y-1">
        {/* Home Button */}
        <motion.button
          whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onHomeClick}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'home' ? 'bg-gray-100 dark:bg-gray-800' : ''} ${!expanded ? 'justify-center' : ''}`}
          title="Home"
        >
          <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          {expanded && <span className="text-sm text-gray-700 dark:text-gray-300">Home</span>}
        </motion.button>

        {/* Saved Products Button */}
        <motion.button
          whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onSavedProductsClick}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative ${activeTab === 'saved' ? 'bg-gray-100 dark:bg-gray-800' : ''} ${!expanded ? 'justify-center' : ''}`}
          title="Saved Products"
        >
          <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {expanded && <span className="text-sm text-gray-700 dark:text-gray-300">Saved Products</span>}
          {!expanded && savedProducts.length > 0 && (
            <span className="absolute right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
              {savedProducts.length > 9 ? '9+' : savedProducts.length}
            </span>
          )}
          {expanded && savedProducts.length > 0 && (
            <span className="ml-auto w-5 h-5 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
              {savedProducts.length > 9 ? '9+' : savedProducts.length}
            </span>
          )}
        </motion.button>

        {/* Search Conversations Button */}
        <motion.button
          whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onHistoryClick}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${!expanded ? 'justify-center' : ''}`}
          title="Search conversations"
        >
          <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {expanded && <span className="text-sm text-gray-700 dark:text-gray-300">Search conversations</span>}
          {!expanded && chatSessions.length > 0 && (
            <span className="absolute right-1 w-4 h-4 bg-black dark:bg-white text-white dark:text-black text-xs rounded-full flex items-center justify-center">
              {chatSessions.length > 9 ? '9+' : chatSessions.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* Recent Chats Section */}
      {expanded && allChats.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3 mt-4 scrollbar-hide">
          <button 
            onClick={() => setChatsVisible(!chatsVisible)}
            className="w-full flex items-center justify-between py-1 px-3 mb-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md transition-colors group"
          >
            <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              Your Chats
            </span>
            <svg 
              className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${chatsVisible ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <AnimatePresence initial={false}>
            {chatsVisible && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pb-2">
                  {allChats.map((session: ChatSession) => (
                    <motion.div
                      key={session.id}
                      whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onRestoreSession?.(session.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left group cursor-pointer"
                      role="button"
                      tabIndex={0}
                    >
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate">
                          {session.preview}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {new Date(session.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                      {/* Delete button on hover */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession?.(session.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all flex-shrink-0"
                      >
                        <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Saved Products Section */}
      {expanded && savedProducts.length > 0 && (
        <div className="overflow-y-auto px-3 mt-4 max-h-48">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 px-3">
            Saved Products
          </p>
          <div className="space-y-1">
            {savedProducts.slice(0, 5).map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left group cursor-pointer"
              >
                {/* Product Thumbnail */}
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-8 h-8 object-cover rounded flex-shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 dark:text-gray-300 truncate">
                    {product.title}
                  </p>
                  {product.price && (
                    <p className="text-xs text-orange-500 font-medium">
                      ${product.price.toFixed(2)}
                    </p>
                  )}
                </div>
                {/* Action buttons on hover */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {/* Open link */}
                  <a
                    href={product.affiliate_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Open product"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveSavedProduct?.(product.id);
                    }}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                    title="Remove from saved"
                  >
                    <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
            {savedProducts.length > 5 && (
              <button
                onClick={onSavedProductsClick}
                className="w-full text-xs text-orange-500 hover:text-orange-600 py-1 text-center"
              >
                View all {savedProducts.length} saved products →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Spacer */}
      {!expanded && <div className="flex-1" />}

      {/* Bottom Section */}
      <div className="px-3 mt-auto space-y-1 pt-4 border-t border-gray-200 dark:border-gray-700">
        {/* Profile Button */}
        <motion.button
          whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onProfileClick}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${showProfilePopup || activeTab === 'profile' ? 'bg-gray-100 dark:bg-gray-800' : ''} ${!expanded ? 'justify-center' : ''}`}
          title="Profile"
        >
          <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {expanded && <span className="text-sm text-gray-700 dark:text-gray-300">Profile</span>}
        </motion.button>

        {/* Settings Button */}
        <motion.button
          whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
          whileTap={{ scale: 0.98 }}
          onClick={onSettingsClick}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-gray-100 dark:bg-gray-800' : ''} ${!expanded ? 'justify-center' : ''}`}
          title="Settings"
        >
          <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {expanded && <span className="text-sm text-gray-700 dark:text-gray-300">Settings</span>}
        </motion.button>
      </div>
    </motion.div>
  );
}
