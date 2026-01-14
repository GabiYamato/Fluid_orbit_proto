'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailChange?: () => void;
  onPasswordChange?: () => void;
}

export default function SettingsPopup({
  isOpen,
  onClose,
  onEmailChange,
  onPasswordChange,
}: SettingsPopupProps) {
  const { theme, toggleTheme } = useTheme();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);
  const [searchHistory, setSearchHistory] = useState(true);

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
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50"
          />

          {/* Popup Container */}
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
                scale: { type: 'spring', damping: 25, stiffness: 300 },
              }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden pointer-events-auto flex flex-col"
            >
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0"
              >
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                  Settings
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Manage your preferences
                </p>
              </motion.div>

              {/* Content */}
              <div className="px-6 sm:px-8 py-6 space-y-5 overflow-y-auto flex-1">
                {/* Appearance Section */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                    Appearance
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Theme</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                      </p>
                    </div>
                    <button
                      onClick={toggleTheme}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        theme === 'dark' ? 'bg-white' : 'bg-gray-900'
                      }`}
                    >
                      <motion.div
                        className={`absolute top-1 left-1 w-6 h-6 rounded-full shadow-sm ${
                          theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                        }`}
                        animate={{ x: theme === 'dark' ? 24 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </motion.div>

                {/* Account Section */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                    Account
                  </h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        onEmailChange?.();
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Email</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Change your email address</p>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        onPasswordChange?.();
                        onClose();
                      }}
                      className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Password</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Update your password</p>
                      </div>
                      <svg
                        className="w-5 h-5 text-gray-400 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </motion.div>

                {/* Notifications Section */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                    Notifications
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Email Notifications</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Receive updates via email</p>
                      </div>
                      <button
                        onClick={() => setEmailNotifications(!emailNotifications)}
                        className={`relative w-14 h-8 rounded-full transition-colors ${
                          emailNotifications ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <motion.div
                          className={`absolute top-1 left-1 w-6 h-6 rounded-full shadow-sm ${
                            emailNotifications ? 'bg-white dark:bg-gray-900' : 'bg-white dark:bg-gray-400'
                          }`}
                          animate={{ x: emailNotifications ? 24 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Product Updates</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Get notified about new features</p>
                      </div>
                      <button
                        onClick={() => setProductUpdates(!productUpdates)}
                        className={`relative w-14 h-8 rounded-full transition-colors ${
                          productUpdates ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                        }`}
                      >
                        <motion.div
                          className={`absolute top-1 left-1 w-6 h-6 rounded-full shadow-sm ${
                            productUpdates ? 'bg-white dark:bg-gray-900' : 'bg-white dark:bg-gray-400'
                          }`}
                          animate={{ x: productUpdates ? 24 : 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Privacy Section */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                  className="space-y-3"
                >
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
                    Privacy
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Search History</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Save your search history</p>
                    </div>
                    <button
                      onClick={() => setSearchHistory(!searchHistory)}
                      className={`relative w-14 h-8 rounded-full transition-colors ${
                        searchHistory ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <motion.div
                        className={`absolute top-1 left-1 w-6 h-6 rounded-full shadow-sm ${
                          searchHistory ? 'bg-white dark:bg-gray-900' : 'bg-white dark:bg-gray-400'
                        }`}
                        animate={{ x: searchHistory ? 24 : 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </motion.div>
              </div>

              {/* Action Button */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.3 }}
                className="px-6 sm:px-8 py-6 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0"
              >
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="w-full px-6 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm"
                >
                  Done
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
