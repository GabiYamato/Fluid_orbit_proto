'use client';

import { motion } from 'framer-motion';
import { useState, useRef, useEffect, useCallback } from 'react';
import ProductCard, { ProductCardSkeleton } from './ProductCard';
import Sidebar from './Sidebar';
import ProfilePopup from './ProfilePopup';
import PersonalizationPopup from './PersonalizationPopup';
import SettingsPopup from './SettingsPopup';
import EmailUpdatePopup from './EmailUpdatePopup';
import PasswordUpdatePopup from './PasswordUpdatePopup';
import HelpPopup from './HelpPopup';
import ClarificationWidget from './ClarificationWidget';
import { saveProduct, removeSavedProduct, SaveProductRequest } from '../../lib/savedProductsService';

interface ResultsPageProps {
  onSearch: (query: string, options?: { hideUserMessage?: boolean }) => void;
  username?: string;
  email?: string;
  onLogout?: () => void;
  onHomeClick?: () => void;
  onSettingsClick?: () => void;
  onPersonalizationClick?: () => void;
  onHelpClick?: () => void;
  onEmailUpdate?: (email: string) => void;
  onLogoClick?: () => void;
  onNewChat?: () => void;
  onHistoryClick?: () => void;
  sidebarExpanded?: boolean;
  onToggleSidebar?: () => void;
  chatHistory?: Array<{
    role: 'user' | 'ai';
    content: string;
    timestamp?: string;
    error?: boolean;
    details?: string;
    products?: any[];
    clarification?: {
      message: string;
      widgets: any[];
      parsedSoFar: Record<string, any>;
    };
  }>;
  searchQuery?: string;
  chatSessions?: Array<{
    id: string;
    timestamp: string;
    messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
    preview: string;
  }>;
  onRestoreSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  isStreaming?: boolean;
}

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

export default function ResultsPage({
  onSearch,
  username = 'ENUID',
  email = 'user@example.com',
  onLogout,
  onHomeClick,
  onSettingsClick,
  onPersonalizationClick,
  onHelpClick,
  onEmailUpdate,
  onLogoClick,
  onNewChat,
  onHistoryClick,
  sidebarExpanded = false,
  onToggleSidebar,
  chatHistory = [],
  searchQuery,
  chatSessions = [],
  onRestoreSession,
  onDeleteSession,
  isStreaming = false,
}: ResultsPageProps) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showEmailUpdate, setShowEmailUpdate] = useState(false);
  const [showPasswordUpdate, setShowPasswordUpdate] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [expandedProducts, setExpandedProducts] = useState<Record<number, number>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Saved products state - maps affiliate_url to saved product ID
  const [savedProductIds, setSavedProductIds] = useState<Record<string, string>>({});
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Clear notification after 3 seconds
  useEffect(() => {
    if (saveNotification) {
      const timer = setTimeout(() => setSaveNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveNotification]);

  // Handle saving a product
  const handleSaveProduct = useCallback(async (product: any) => {
    try {
      const productData: SaveProductRequest = {
        product_id: product.id,
        title: product.title || product.name || 'Unknown Product',
        description: product.description,
        price: product.price,
        rating: product.rating,
        review_count: product.review_count,
        image_url: product.image_url || product.image,
        affiliate_url: product.affiliate_url || product.link || product.url || '',
        source: product.source,
        category: product.category,
        brand: product.brand,
      };

      const saved = await saveProduct(productData);
      setSavedProductIds(prev => ({
        ...prev,
        [productData.affiliate_url]: saved.id
      }));
      setSaveNotification(`Saved: ${productData.title.slice(0, 30)}...`);
    } catch (error: any) {
      console.error('Save product error:', error);
      setSaveNotification(error.message || 'Failed to save product');
    }
  }, []);

  // Handle removing a saved product
  const handleUnsaveProduct = useCallback(async (savedProductId: string) => {
    try {
      await removeSavedProduct(savedProductId);
      setSavedProductIds(prev => {
        const updated = { ...prev };
        // Find and remove the entry with this saved ID
        for (const [url, id] of Object.entries(updated)) {
          if (id === savedProductId) {
            delete updated[url];
            break;
          }
        }
        return updated;
      });
      setSaveNotification('Product removed from saved');
    } catch (error: any) {
      console.error('Unsave product error:', error);
      setSaveNotification(error.message || 'Failed to remove product');
    }
  }, []);

  // Check if a product is saved by its URL
  const isProductSaved = useCallback((product: any): { isSaved: boolean; savedId?: string } => {
    const url = product.affiliate_url || product.link || product.url || '';
    const savedId = savedProductIds[url];
    return { isSaved: !!savedId, savedId };
  }, [savedProductIds]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row transition-colors duration-300">
      {/* Save Notification Toast */}
      {saveNotification && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-black dark:bg-white text-white dark:text-black px-4 py-2 rounded-lg shadow-lg text-sm font-medium"
        >
          {saveNotification}
        </motion.div>
      )}
      {/* Sidebar - Desktop Only */}
      <div className="hidden md:block">
        <Sidebar
          onHomeClick={onHomeClick}
          onProfileClick={() => setShowProfilePopup(true)}
          onSettingsClick={() => setShowSettings(true)}
          onLogoClick={onLogoClick}
          onNewChat={onNewChat}
          onHistoryClick={onHistoryClick}
          activeTab="home"
          showProfilePopup={showProfilePopup}
          chatSessions={chatSessions}
          onRestoreSession={onRestoreSession}
          onDeleteSession={onDeleteSession}
          isExpanded={sidebarExpanded}
          onToggleExpand={onToggleSidebar}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 transition-colors duration-300">
        <div className="flex items-center justify-around py-3 px-4">
          <button
            onClick={onHomeClick}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">Home</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">Settings</span>
          </button>
          <button
            onClick={() => setShowProfilePopup(true)}
            className="flex flex-col items-center gap-1 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </nav>



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

      {/* Personalization Popup */}
      <PersonalizationPopup
        isOpen={showPersonalization}
        onClose={() => setShowPersonalization(false)}
        username={username}
        email={email}
        onSave={(data) => {
          console.log('Personalization saved:', data);
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
            const response = await fetch('/api/otp/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: newEmail, username: username }),
            });
            const data = await response.json();
            return data.success;
          } catch (error) {
            console.error('Send OTP error:', error);
            return false;
          }
        }}
        onVerify={async (newEmail, otp, password) => {
          try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const token = localStorage.getItem('access_token');

            // Verify OTP first
            const verifyResponse = await fetch(`${API_URL}/auth/otp/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: newEmail, otp }),
            });

            if (!verifyResponse.ok) {
              console.error('OTP verification failed');
              return false;
            }

            // Update email via backend (would need an endpoint)
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
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const token = localStorage.getItem('access_token');

            // Would need a password update endpoint on backend
            // For now, just return success placeholder
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
            const userEmail = localStorage.getItem('user_email') || email;
            const customName = localStorage.getItem('user_custom_name') || '';

            // Send OTP for password reset
            const response = await fetch(`${API_URL}/auth/otp/send`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userEmail, username: customName }),
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

      {/* Floating Search Bar - Bottom Center */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
          delay: 0.1
        }}
        className="fixed bottom-12 md:bottom-8 left-1/2 md:left-[calc(50%+2.5rem)] -translate-x-1/2 z-30 w-full max-w-[40rem] px-4 md:px-0"
      >
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-white dark:bg-gray-800 rounded-[26px] shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-lg bg-opacity-95 dark:bg-opacity-95 focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 transition-all duration-200"
        >
          <div className="relative flex items-center pl-4 pr-2 py-2">
            <textarea
              placeholder="Message..."
              rows={1}
              style={{ minHeight: '44px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const target = e.target as HTMLTextAreaElement
                  if (target.value.trim()) {
                    onSearch(target.value);
                    target.value = '';
                  }
                }
              }}
              className="w-full px-2 py-2.5 text-sm bg-transparent border-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none max-h-32 overflow-y-auto"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                if (input && input.value.trim()) {
                  onSearch(input.value);
                  input.value = '';
                }
              }}
              className="p-2 bg-black dark:bg-white text-white dark:text-gray-900 rounded-full hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors shrink-0 ml-2"
            >
              <ArrowUpIcon className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, marginLeft: sidebarExpanded ? 280 : 64 }}
        transition={{ duration: 0.3 }}
        className="flex-1 pb-32 md:pb-24 hidden md:block" // Removed pt-20
      >
        {/* Header - Sticky Top */}
        <div className="sticky top-0 h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md z-40 flex items-center justify-between px-4 sm:px-6 md:px-8 border-b border-gray-200 dark:border-gray-800 mb-6 transition-all duration-300">
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors">
            <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">ShopGPT 4.0</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
            <button className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        </div>
        {/* Chat History Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-6 sm:py-8">
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-lg sm:text-xl font-bold text-black dark:text-white mb-2"
          >
            CHAT
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-sm text-gray-600 dark:text-gray-400 mb-4 sm:mb-6"
          >
            Your conversation with AI
          </motion.p>

          {/* Chat Messages */}
          <div className="space-y-8 mb-12">
            {chatHistory.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* User message */}
                {message.role === 'user' && (
                  <div className="max-w-[80%] rounded-2xl p-4 shadow-md bg-black dark:bg-white text-white dark:text-black">
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    {message.timestamp && (
                      <p className="text-xs mt-2 text-gray-300 dark:text-gray-600">
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                )}

                {/* AI response with products */}
                {message.role === 'ai' && (
                  <div className="w-full space-y-4">
                    {/* AI Message Bubble or Clarification Widget */}
                    {message.clarification && message.clarification.widgets?.length > 0 ? (
                      <ClarificationWidget
                        message={message.clarification.message}
                        widgets={message.clarification.widgets}
                        parsedSoFar={message.clarification.parsedSoFar}
                        onSubmit={(responses) => {
                          // Build a search query that includes the original item + all responses
                          // Format: "t-shirt gender: mens, style: casual, size: M, budget: 50"
                          const parsedData = message.clarification?.parsedSoFar || {};
                          const originalItem = parsedData.item || parsedData.category || '';
                          const parts = Object.entries(responses)
                            .filter(([_, v]) => v !== undefined && v !== null && v !== '')
                            .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
                          const clarificationQuery = `${originalItem} ${parts.join(', ')}`.trim();
                          onSearch(clarificationQuery, { hideUserMessage: true });
                        }}
                        onSkip={() => {
                          // Skip clarification and proceed with the detected item
                          const parsedData = message.clarification?.parsedSoFar || {};
                          const originalItem = parsedData.item || parsedData.category || 'product';
                          onSearch(`show me ${originalItem} options`, { hideUserMessage: true });
                        }}
                      />
                    ) : (
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 shadow-md ${message.error
                          ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700'
                          : 'bg-white dark:bg-gray-800 text-black dark:text-white'
                          }`}
                      >
                        {message.error ? (
                          <div>
                            <h3 className="text-lg font-semibold mb-2 text-red-700 dark:text-red-400">
                              ⚠️ Connection Error
                            </h3>
                            <p className="text-red-700 dark:text-red-400 font-medium mb-2">{message.content}</p>
                            {message.details && (
                              <details className="mt-4">
                                <summary className="text-sm text-red-600 dark:text-red-400 cursor-pointer hover:text-red-800 dark:hover:text-red-300">
                                  Technical Details
                                </summary>
                                <pre className="text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded mt-2 overflow-auto">
                                  {message.details}
                                </pre>
                              </details>
                            )}
                          </div>
                        ) : !message.content && isStreaming && index === chatHistory.length - 1 ? (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">Analyzing...</span>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                            {isStreaming && index === chatHistory.length - 1 && (
                              <span className="inline-block w-1.5 h-3 bg-black dark:bg-white ml-1 animate-pulse"></span>
                            )}
                          </>
                        )}
                        {message.timestamp && !isStreaming && (
                          <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Product Cards Section */}
                    {message.products && message.products.length > 0 && (() => {
                      const visibleCount = expandedProducts[index] || 4;
                      const visibleProducts = message.products.slice(0, visibleCount);
                      const hasMore = message.products.length > visibleCount;

                      return (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="w-full"
                        >
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                            <span>🛍️</span>
                            Found {message.products.length} products
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {visibleProducts.map((product: any, pIndex: number) => {
                              const { isSaved, savedId } = isProductSaved(product);
                              return (
                                <div
                                  key={`${product.id || 'product'}-${pIndex}`}
                                  className="col-span-1"
                                >
                                  <ProductCard
                                    product={product}
                                    index={pIndex}
                                    size="small"
                                    onSave={handleSaveProduct}
                                    onUnsave={handleUnsaveProduct}
                                    isSaved={isSaved}
                                    savedProductId={savedId}
                                  />
                                </div>
                              );
                            })}
                          </div>
                          {hasMore ? (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setExpandedProducts(prev => ({
                                ...prev,
                                [index]: (prev[index] || 4) + 3
                              }))}
                              className="mt-6 w-full py-3 px-4 border-2 border-gray-100 dark:border-gray-800 rounded-xl text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 bg-white dark:bg-gray-900/50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                              Show 3 More Products
                            </motion.button>
                          ) : message.products.length > 4 && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => setExpandedProducts(prev => ({
                                ...prev,
                                [index]: 4
                              }))}
                              className="mt-6 w-full py-3 px-4 border-2 border-gray-100 dark:border-gray-800 rounded-xl text-gray-600 dark:text-gray-400 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 bg-white dark:bg-gray-900/50"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              Show Less
                            </motion.button>
                          )}
                        </motion.div>
                      );
                    })()}

                    {/* Product Skeleton Loaders when streaming and no products yet */}
                    {isStreaming && index === chatHistory.length - 1 && (!message.products || message.products.length === 0) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full"
                      >
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Searching for products...
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {[...Array(4)].map((_, i) => (
                            <div key={i} className="col-span-1">
                              <ProductCardSkeleton />
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            <div ref={chatEndRef} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
