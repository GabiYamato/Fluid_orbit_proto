'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import ProfilePopup from './ProfilePopup';
import NameEditPopup from './NameEditPopup';
import PersonalizationPopup from './PersonalizationPopup';
import SettingsPopup from './SettingsPopup';
import EmailUpdatePopup from './EmailUpdatePopup';
import PasswordUpdatePopup from './PasswordUpdatePopup';
import HelpPopup from './HelpPopup';
import SupportChatbot from './SupportChatbot';
import Sidebar from './Sidebar';

interface ChatSession {
  id: string;
  timestamp: string;
  messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
  preview: string;
}

interface HomePageProps {
  username?: string;
  email?: string;
  onSearch: (query: string, options?: { hideUserMessage?: boolean }) => void;
  onLogout?: () => void;
  onSettingsClick?: () => void;
  onNameUpdate?: (name: string) => void;
  onPersonalizationClick?: () => void;
  onHelpClick?: () => void;
  onEmailUpdate?: (email: string) => void;
  onNewChat?: () => void;
  onHistoryClick?: () => void;
  onLogoClick?: () => void;
  onSavedProductsClick?: () => void;
  chatSessions?: ChatSession[];
  onRestoreSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  sidebarExpanded?: boolean;
  onToggleSidebar?: () => void;
}

// Icon components
const HomeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const SettingsIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2.82l-.15.1a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0-2.82l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ArrowUpIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    {...props}
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m5 12 7-7 7 7" />
    <path d="M12 19V5" />
  </svg>
);

export default function HomePage({
  username = '',
  email = 'user@example.com',
  onSearch,
  onLogout,
  onSettingsClick,
  onNameUpdate,
  onPersonalizationClick,
  onHelpClick,
  onEmailUpdate,
  onNewChat,
  onHistoryClick,
  onLogoClick,
  onSavedProductsClick,
  chatSessions = [],
  onRestoreSession,
  onDeleteSession,
  sidebarExpanded = false,
  onToggleSidebar,
}: HomePageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showNameEdit, setShowNameEdit] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmailUpdate, setShowEmailUpdate] = useState(false);
  const [showPasswordUpdate, setShowPasswordUpdate] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Sidebar - Desktop Only */}
      <div className="hidden md:block">
        <Sidebar
          onHomeClick={() => { }}
          onProfileClick={() => setShowProfilePopup(true)}
          onSettingsClick={() => setShowSettings(true)}
          onLogoClick={onLogoClick}
          onNewChat={onNewChat}
          onHistoryClick={onHistoryClick}
          onSavedProductsClick={onSavedProductsClick}
          activeTab="home"
          showProfilePopup={showProfilePopup}
          chatSessions={chatSessions}
          onRestoreSession={onRestoreSession}
          onDeleteSession={onDeleteSession}
          isExpanded={sidebarExpanded}
          onToggleExpand={onToggleSidebar}
        />
      </div>

      {/* Profile Popup */}
      <ProfilePopup
        isOpen={showProfilePopup}
        onClose={() => setShowProfilePopup(false)}
        username={username}
        email={email}
        onPersonalizationClick={() => {
          setShowProfilePopup(false);
          setShowPersonalization(true);
        }}
        onSettingsClick={() => {
          setShowProfilePopup(false);
          setShowSettings(true);
        }}
        onHelpClick={() => setShowHelp(true)}
        onLogout={onLogout}
      />

      {/* Name Edit Popup */}
      <NameEditPopup
        isOpen={showNameEdit}
        onClose={() => setShowNameEdit(false)}
        currentName={username}
        onSave={(name) => onNameUpdate?.(name)}
      />

      {/* Personalization Popup */}
      <PersonalizationPopup
        isOpen={showPersonalization}
        onClose={() => setShowPersonalization(false)}
        username={username}
        email={email}
        onSave={(data) => {
          console.log('Personalization saved:', data);
          onNameUpdate?.(data.displayName);
          setShowPersonalization(false);
        }}
      />

      {/* Settings Popup */}
      <SettingsPopup
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onEmailChange={() => {
          setShowSettings(false);
          setShowEmailUpdate(true);
        }}
        onPasswordChange={() => {
          setShowSettings(false);
          setShowPasswordUpdate(true);
        }}
      />

      {/* Email Update Popup */}
      <EmailUpdatePopup
        isOpen={showEmailUpdate}
        onClose={() => setShowEmailUpdate(false)}
        currentEmail={email}
        onSendOTP={async (newEmail) => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_URL}/auth/otp/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: newEmail, username: username }),
            });
            return response.ok;
          } catch (error) {
            console.error('Send OTP error:', error);
            return false;
          }
        }}
        onVerify={async (newEmail, otp, password) => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_URL}/auth/otp/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: newEmail, otp }),
            });

            if (!response.ok) {
              console.error('OTP verification failed');
              return false;
            }

            onEmailUpdate?.(newEmail);
            localStorage.setItem('user_email', newEmail);
            return true;
          } catch (error: any) {
            console.error('❌ Email update error:', error);
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
            return true;
          } catch (error: any) {
            console.error('Password update error:', error);
            return false;
          }
        }}
        onForgotPassword={async () => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const customName = localStorage.getItem('user_custom_name') || '';

            const response = await fetch(`${API_URL}/auth/otp/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, username: customName }),
            });

            if (response.ok) {
              alert('Password reset code sent! Please check your email.');
            } else {
              throw new Error('Failed to send reset email');
            }
          } catch (error: any) {
            console.error('❌ Forgot password error:', error);
            alert('Failed to send password reset email. Please try again.');
          }
        }}
      />

      {/* Help Popup */}
      <HelpPopup isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 transition-colors duration-300">
        <div className="flex items-center justify-around py-3 px-4">
          <button className="flex flex-col items-center gap-1 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors">
            <HomeIcon className="h-6 w-6" />
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <SettingsIcon className="h-6 w-6" />
            <span className="text-xs">Settings</span>
          </button>
          <button
            onClick={() => setShowProfilePopup(true)}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <UserIcon className="h-6 w-6" />
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, marginLeft: sidebarExpanded ? 280 : 64 }}
        transition={{ duration: 0.3 }}
        className="flex-1 flex flex-col overflow-hidden pb-20 md:pb-0 hidden md:flex"
      >
        {/* Centered Heading */}
        <div className="flex-1 flex h-full flex-col justify-center items-center text-center px-4 sm:px-8 md:px-16 lg:px-40">
          <div className="flex items-center gap-4 sm:gap-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-widest text-black dark:text-white">
              Hello,
            </h1>
            {username && username.trim() !== '' ? (
              <h1
                onClick={() => setShowNameEdit(true)}
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-widest text-black dark:text-white cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Click to edit name"
              >
                {username}
              </h1>
            ) : (
              <button
                onClick={() => setShowNameEdit(true)}
                className="flex items-center gap-2 sm:gap-3 px-2 sm:pr-3 py-4 sm:py-4 border-2 border-dashed border-green-600 dark:border-green-400 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200 group"
              >
                <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 bg-white dark:bg-gray-800 rounded-full shadow-sm">
                  <span className="text-black-500 dark:text-green-400 text-xl sm:text-2xl font-light">+</span>
                </div>
                <span className="text-lg sm:text-xl md:text-xl lg:text-xl font-medium text-green-600 dark:text-green-400 tracking-wide">
                  Add Name
                </span>
              </button>
            )}
          </div>
          <p className="mt-4 text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-400 tracking-wider">
            Shop at the Speed of Thought.
          </p>
        </div>

        {/* Bottom Input Area */}
        <div className="px-4 pb-6 sm:px-8 sm:pb-8 md:pb-12">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={handleSubmit}>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-[26px] p-2 px-4 flex items-center border-gray-200 dark:border-gray-700 border shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-colors duration-300">
                <textarea
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none text-base text-gray-700 dark:text-gray-300 placeholder:text-gray-500 dark:placeholder:text-gray-400 tracking-wide outline-none transition-colors duration-300 max-h-32 overflow-y-auto py-2"
                  placeholder="Shop Anything..."
                  rows={1}
                  style={{ minHeight: '1.5rem' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                />
                <button
                  type="submit"
                  className="ml-2 p-2 bg-black dark:bg-white text-white dark:text-black rounded-full hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors flex-shrink-0"
                >
                  <ArrowUpIcon className="h-5 w-5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.main>

      {/* Mobile Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden pb-20 md:hidden">
        {/* Centered Heading */}
        <div className="flex-1 flex h-full flex-col justify-center items-center text-center px-4">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-widest text-black dark:text-white">
              Hello,
            </h1>
            {username && username.trim() !== '' ? (
              <h1
                onClick={() => setShowNameEdit(true)}
                className="text-3xl font-bold tracking-widest text-black dark:text-white cursor-pointer"
              >
                {username}
              </h1>
            ) : (
              <button
                onClick={() => setShowNameEdit(true)}
                className="flex items-center gap-2 px-2 py-4 border-2 border-dashed border-green-600 rounded-lg"
              >
                <span className="text-lg font-medium text-green-600">Add Name</span>
              </button>
            )}
          </div>
          <p className="mt-4 text-base text-gray-600 dark:text-gray-400">
            Shop at the Speed of Thought.
          </p>
        </div>

        {/* Bottom Input Area */}
        <div className="px-4 pb-6">
          <form onSubmit={handleSubmit}>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-[26px] p-2 px-4 flex items-center border border-gray-200 dark:border-gray-700 shadow-sm">
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent border-none resize-none text-base text-gray-700 dark:text-gray-300 placeholder:text-gray-500 outline-none py-2"
                placeholder="Shop Anything..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <button
                type="submit"
                className="ml-2 p-2 bg-black dark:bg-white text-white dark:text-black rounded-full"
              >
                <ArrowUpIcon className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
