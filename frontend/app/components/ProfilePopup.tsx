'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface ProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  email?: string;
  onPersonalizationClick?: () => void;
  onSettingsClick?: () => void;
  onHelpClick?: () => void;
  onLogout?: () => void;
}

export default function ProfilePopup({
  isOpen,
  onClose,
  username = 'ENUID',
  email = 'user@example.com',
  onPersonalizationClick,
  onSettingsClick,
  onHelpClick,
  onLogout,
}: ProfilePopupProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Popup - Positioned above Profile button */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.3, damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-4 md:bottom-4 md:right-auto md:left-20 bg-white dark:bg-white rounded-2xl shadow-2xl pointer-events-auto w-80 z-50"
          >
              {/* Profile Header */}
              <div className="px-5 py-4">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 bg-gray-900 dark:bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-bold text-white dark:text-white">
                      {username.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-900 truncate">
                      {email}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-500">Active</p>
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-gray-200 mx-4" />

              {/* Menu Items */}
              <div className="px-3 py-2">
                {/* Personalization */}
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onPersonalizationClick?.();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-gray-700 dark:text-gray-700 flex-shrink-0"
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
                  <span className="text-sm text-gray-900 dark:text-gray-900">Personalization</span>
                </motion.button>

                {/* Settings */}
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onSettingsClick?.();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-gray-700 dark:text-gray-700 flex-shrink-0"
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
                  <span className="text-sm text-gray-900 dark:text-gray-900">Settings</span>
                </motion.button>
              </div>

              {/* Divider */}
              <div className="h-px bg-gray-200 dark:bg-gray-200 mx-4" />

              {/* Bottom Items */}
              <div className="px-3 py-2 pb-5">
                {/* Help */}
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onHelpClick?.();
                    onClose();
                  }}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-700 dark:text-gray-700 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span className="text-sm text-gray-900 dark:text-gray-900">Help</span>
                  </div>
                  <svg
                    className="w-4 h-4 text-gray-600 dark:text-gray-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </motion.button>

                {/* Logout */}
                <motion.button
                  whileHover={{ backgroundColor: 'rgba(0, 0, 0, 0.05)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onLogout?.();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors"
                >
                  <svg
                    className="w-5 h-5 text-gray-700 dark:text-gray-700 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  <span className="text-sm text-gray-900 dark:text-gray-900">Log out</span>
                </motion.button>
              </div>
            </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
