'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Sidebar from './Sidebar';

interface PersonalizationPageProps {
  username?: string;
  email?: string;
  onHomeClick?: () => void;
  onSettingsClick?: () => void;
  onSave?: (data: { displayName: string; language: string }) => void;
  onLogoClick?: () => void;
  chatSessions?: Array<{
    id: string;
    timestamp: string;
    messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
    preview: string;
  }>;
  onRestoreSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
];

export default function PersonalizationPage({
  username = 'ENUID',
  email = 'user@example.com',
  onHomeClick,
  onSettingsClick,
  onSave,
  onLogoClick,
  chatSessions = [],
  onRestoreSession,
  onDeleteSession,
}: PersonalizationPageProps) {
  const [displayName, setDisplayName] = useState(username);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [showEmailTooltip, setShowEmailTooltip] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  const handleSave = () => {
    if (onSave) {
      onSave({ displayName, language: selectedLanguage });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
      {/* Sidebar */}
      <Sidebar
        onHomeClick={onHomeClick}
        onProfileClick={() => setShowProfilePopup(true)}
        onSettingsClick={onSettingsClick}
        onLogoClick={onLogoClick}
        activeTab="profile"
        showProfilePopup={showProfilePopup}
        chatSessions={chatSessions}
        onRestoreSession={onRestoreSession}
        onDeleteSession={onDeleteSession}
      />

      {/* Main Content */}
      <div className="flex-1 ml-16">
        <div className="max-w-2xl mx-auto px-8 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end mb-8"
          >
            <h1 className="text-2xl font-bold text-black dark:text-white">Personalization</h1>
          </motion.div>

          {/* Profile Settings Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-6">Profile Settings</h2>

            {/* Display Name */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-black dark:text-white bg-white dark:bg-gray-700"
                placeholder="Enter your display name"
              />
            </div>

            {/* Email (Read-only with tooltip) */}
            <div className="mb-6 relative">
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onClick={() => setShowEmailTooltip(true)}
                  onBlur={() => setTimeout(() => setShowEmailTooltip(false), 200)}
                  readOnly
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                  placeholder="your@email.com"
                />
                {showEmailTooltip && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute top-full mt-2 left-0 right-0 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg p-3 shadow-lg z-10"
                  >
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      💡 You can update your email ID in Settings
                    </p>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Language */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-black dark:text-white mb-2">
                Language
              </label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-white text-black dark:text-white bg-white dark:bg-gray-700"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="w-full py-4 bg-black dark:bg-white text-white dark:text-black rounded-xl font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
            >
              Save Changes
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
