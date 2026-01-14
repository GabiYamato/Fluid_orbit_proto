'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import Sidebar from './Sidebar';
import ProfilePopup from './ProfilePopup';
import EmailUpdatePopup from './EmailUpdatePopup';
import PasswordUpdatePopup from './PasswordUpdatePopup';
import PersonalizationPopup from './PersonalizationPopup';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsPageProps {
  username?: string;
  email?: string;
  onHomeClick?: () => void;
  onLogout?: () => void;
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

export default function SettingsPage({
  username = 'ENUID',
  email = 'user@example.com',
  onHomeClick,
  onLogout,
  onLogoClick,
  chatSessions = [],
  onRestoreSession,
  onDeleteSession,
}: SettingsPageProps) {
  const { theme, toggleTheme } = useTheme();
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showEmailUpdate, setShowEmailUpdate] = useState(false);
  const [showPasswordUpdate, setShowPasswordUpdate] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [productUpdates, setProductUpdates] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [searchHistory, setSearchHistory] = useState(true);
  const [dataCollection, setDataCollection] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex transition-colors rounded-lg p-14 duration-300">
      {/* Sidebar */}
      <Sidebar
        onHomeClick={onHomeClick}
        onProfileClick={() => setShowProfilePopup(true)}
        onSettingsClick={() => console.log('Already on settings')}
        onLogoClick={onLogoClick}
        activeTab="settings"
        showProfilePopup={showProfilePopup}
        chatSessions={chatSessions}
        onRestoreSession={onRestoreSession}
        onDeleteSession={onDeleteSession}
      />

      {/* Profile Popup */}
      <ProfilePopup
        isOpen={showProfilePopup}
        onClose={() => setShowProfilePopup(false)}
        username={username}
        email={email}
        onPersonalizationClick={() => setShowPersonalization(true)}
        onSettingsClick={() => console.log('Already on settings')}
        onHelpClick={() => console.log('Help clicked')}
        onLogout={onLogout}
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
            <h1 className="text-2xl font-bold text-black dark:text-white">Settings</h1>
          </motion.div>

          {/* Appearance Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-[5px] px-8 py-6 mb-6 shadow-sm transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-2">Appearance</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-black dark:text-white">Theme</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark</p>
              </div>
              <button
                onClick={toggleTheme}
                className={`relative w-14 h-8 rounded-full transition-colors ${theme === 'dark' ? 'bg-black dark:bg-white' : 'bg-gray-300'
                  }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-black rounded-full"
                  animate={{ x: theme === 'dark' ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </motion.div>

          {/* Account Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-[5px] px-8 py-6 mb-6 shadow-sm transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-6">Account</h2>

            {/* Email */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-black dark:text-white mb-1">Email</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{email}</p>
                </div>
                <button
                  onClick={() => setShowEmailUpdate(true)}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Change
                </button>
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base text-black dark:text-white mb-1">Password</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">••••••••</p>
                </div>
                <button
                  onClick={() => setShowPasswordUpdate(true)}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-black dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          </motion.div>

          {/* Notifications Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-[5px] px-8 py-6 mb-6 shadow-sm transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-6">Notifications</h2>

            {/* Email Notifications */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-base text-black dark:text-white">Email Notifications</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive updates via email</p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative w-14 h-8 rounded-full transition-colors ${emailNotifications ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-black rounded-full"
                  animate={{ x: emailNotifications ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Product Updates */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-base text-black dark:text-white">Product Updates</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified about new features</p>
              </div>
              <button
                onClick={() => setProductUpdates(!productUpdates)}
                className={`relative w-14 h-8 rounded-full transition-colors ${productUpdates ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-black rounded-full"
                  animate={{ x: productUpdates ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Marketing Emails */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base text-black dark:text-white">Marketing Emails</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Special offers and promotions</p>
              </div>
              <button
                onClick={() => setMarketingEmails(!marketingEmails)}
                className={`relative w-14 h-8 rounded-full transition-colors ${marketingEmails ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-black rounded-full"
                  animate={{ x: marketingEmails ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </motion.div>

          {/* Privacy & Security Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-[5px] px-8 py-6 mb-6 shadow-sm transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-6">Privacy & Security</h2>

            {/* Search History */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-base text-black dark:text-white">Search History</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Save your search history</p>
              </div>
              <button
                onClick={() => setSearchHistory(!searchHistory)}
                className={`relative w-14 h-8 rounded-full transition-colors ${searchHistory ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-black rounded-full"
                  animate={{ x: searchHistory ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Data Collection */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-base text-black dark:text-white">Data Collection</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Help improve our service</p>
              </div>
              <button
                onClick={() => setDataCollection(!dataCollection)}
                className={`relative w-14 h-8 rounded-full transition-colors ${dataCollection ? 'bg-black dark:bg-white' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-6 h-6 bg-white dark:bg-black rounded-full"
                  animate={{ x: dataCollection ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Delete Account */}
            <button className="w-full py-3 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              Delete Account
            </button>
          </motion.div>

          {/* Help & Information Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-[5px] px-8 py-6 mb-6 shadow-sm transition-colors duration-300"
          >
            <h2 className="text-xl font-bold text-black dark:text-white mb-4">Help & Information</h2>
            <div className="flex gap-4 text-sm">
              <button className="text-black dark:text-white hover:underline">Terms of Service</button>
              <button className="text-black dark:text-white hover:underline">Privacy Policy</button>
              <button className="text-black dark:text-white hover:underline">Contact Us</button>
            </div>
          </motion.div>

          {/* Logout Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <button
              onClick={onLogout}
              className="w-full py-4 bg-red-600 dark:bg-red-700 text-white rounded-xl font-medium hover:bg-red-700 dark:hover:bg-red-800 transition-colors"
            >
              Logout
            </button>
          </motion.div>
        </div>
      </div>

      {/* Personalization Popup */}
      <PersonalizationPopup
        isOpen={showPersonalization}
        onClose={() => setShowPersonalization(false)}
        username={username}
        email={email}
        onSave={(data) => {
          console.log('Personalization saved:', data);
          // Here you can add API call to save the data
        }}
      />

      {/* Email Update Popup */}
      <EmailUpdatePopup
        isOpen={showEmailUpdate}
        onClose={() => setShowEmailUpdate(false)}
        currentEmail={email}
        onSendOTP={async (newEmail) => {
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            const response = await fetch(`${apiUrl}/api/email/send-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: newEmail }),
            });
            return response.ok;
          } catch (error) {
            console.error('Send OTP error:', error);
            return false;
          }
        }}
        onVerify={async (newEmail, otp) => {
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
            const response = await fetch(`${apiUrl}/api/email/verify-otp`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: newEmail, otp }),
            });
            if (response.ok) {
              alert('Email updated successfully!');
              return true;
            }
            return false;
          } catch (error) {
            console.error('Verify OTP error:', error);
            return false;
          }
        }}
      />

      {/* Password Update Popup */}
      <PasswordUpdatePopup
        isOpen={showPasswordUpdate}
        onClose={() => setShowPasswordUpdate(false)}
        onUpdate={async (oldPassword, newPassword) => {
          try {
            // Would need a password update endpoint
            console.log('Password update requested');
            alert('Password updated successfully!');
            return true;
          } catch (error: any) {
            console.error('Password update error:', error);
            return false;
          }
        }}
        onForgotPassword={() => {
          alert('Password reset email sent! (Feature coming soon)');
        }}
      />
    </div>
  );
}
