'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Sidebar from './Sidebar';
import SupportChatbot from './SupportChatbot';
import ProfilePopup from './ProfilePopup';

interface HelpPageProps {
  onHomeClick?: () => void;
  onSettingsClick?: () => void;
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

export default function HelpPage({ onHomeClick, onSettingsClick, onLogoClick, chatSessions = [], onRestoreSession, onDeleteSession }: HelpPageProps) {
  const [showChatbot, setShowChatbot] = useState(false);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
      {/* Sidebar */}
      <Sidebar
        onHomeClick={onHomeClick}
        onProfileClick={() => setShowProfilePopup(true)}
        onSettingsClick={onSettingsClick}
        onLogoClick={onLogoClick}
        showProfilePopup={showProfilePopup}
        chatSessions={chatSessions}
        onRestoreSession={onRestoreSession}
        onDeleteSession={onDeleteSession}
      />

       {/* Profile Popup */}
       <ProfilePopup
        isOpen={showProfilePopup}
        onClose={() => setShowProfilePopup(false)}
        onSettingsClick={onSettingsClick}
        onHelpClick={() => console.log('Already on help')}
      />

      {/* Main Content */}
      <div className="flex-1 ml-16">
        <div className="max-w-3xl mx-auto px-8 py-12">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-end mb-8"
          >
            <h1 className="text-2xl font-bold text-black dark:text-white">Help & Support</h1>
          </motion.div>

          {/* FAQ Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm mb-6 transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-6">Frequently Asked Questions</h2>

            {/* FAQ Item 1 */}
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-black dark:text-white mb-2">
                How do I search for products?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Simply type your prompt for the product in the conversation box and press Enter or click the search button.
              </p>
            </div>

            {/* FAQ Item 2 */}
            <div className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-base font-semibold text-black dark:text-white mb-2">
                Can I change the theme?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Yes! Go to Settings and toggle between Light and Dark mode.
              </p>
            </div>

            {/* FAQ Item 3 */}
            <div className="mb-6">
              <h3 className="text-base font-semibold text-black dark:text-white mb-2">
                Need more help?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Contact our support team at: support@enuid.com
              </p>
              <button
                onClick={() => setShowChatbot(true)}
                className="px-8 py-3 bg-black dark:bg-white text-white dark:text-black rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors font-medium"
              >
                Contact Support
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Support Chatbot */}
      <SupportChatbot isOpen={showChatbot} onClose={() => setShowChatbot(false)} />
    </div>
  );
}
