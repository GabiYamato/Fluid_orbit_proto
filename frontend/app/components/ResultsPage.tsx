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
  onSavedProductsClick?: () => void;
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
  onSavedProductsClick,
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
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [isCopied, setIsCopied] = useState(false); // State for copy feedback
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
        className="fixed bottom-12 md:bottom-8 left-1/2 -translate-x-1/2 z-30 w-full max-w-[40rem] px-4 md:px-0"
      >
        <motion.div
          whileHover={{ scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="bg-white dark:bg-gray-800 rounded-[26px] shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden backdrop-blur-lg bg-opacity-95 dark:bg-opacity-95 focus-within:ring-2 focus-within:ring-black/5 dark:focus-within:ring-white/10 transition-all duration-200"
        >
          <div className="relative flex items-center pl-4 pr-2 py-2">
            <textarea
              placeholder="Search for products..."
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
        <div className="sticky top-0 h-14 bg-white/10 dark:bg-gray-900/10 backdrop-blur-xl z-50 flex items-center justify-between px-4 sm:px-6 md:px-8 border-b border-white/10 dark:border-gray-800/10 mb-6 transition-all duration-300">
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors">
            <img
              src="/fluid-orbit-infinity-logo.png"
              alt="Fluid Orbit"
              className="w-9 h-9 object-contain"
            /><span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">Fluid-orbit</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="flex items-center gap-2">
            {/* Share Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setShowSharePopup(!showSharePopup)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>

              {/* Share Popup Content */}
              {showSharePopup && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-[-3rem] top-full mt-4 w-64 bg-white/30 dark:bg-black/60 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-3xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] p-4 z-50 text-black dark:text-white"
                >
                    {/* Copy Link */}
                    <button 
                        onClick={() => {
                            navigator.clipboard.writeText(window.location.href);
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-white/10 dark:hover:bg-white/5 transition-colors group mb-3 border border-transparent hover:border-white/10"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl transition-all duration-300 ${isCopied ? 'bg-green-500/20 text-green-600' : 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 text-blue-600 dark:text-blue-400'}`}>
                                {isCopied ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                                )}
                            </div>
                            <span className="font-semibold text-sm">{isCopied ? 'Copied!' : 'Copy entire conversation link'}</span>
                        </div>
                    </button>

                    {/* Email Share */}
                    <div className="mb-4 p-3 bg-white/10 dark:bg-white/5 rounded-2xl border border-white/10">
                         <div className="flex items-center gap-2 mb-2">
                             <span className="text-[10px] font-bold opacity-70 uppercase tracking-wider">Share via Email</span>
                         </div>
                         <div className="flex gap-2 bg-black/5 dark:bg-black/20 p-1.5 rounded-xl border border-white/5 focus-within:border-blue-500/50 transition-colors">
                             <input type="email" placeholder="Enter email..." className="min-w-0 flex-1 bg-transparent px-2 text-sm focus:outline-none text-gray-800 dark:text-gray-200 placeholder-gray-500" />
                             <button className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-transform active:scale-95 shadow-lg shadow-blue-500/30 shrink-0">
                                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                             </button>
                         </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex items-center gap-2 mb-2">
                        {/* WhatsApp */}
                        <button className="p-3 bg-[#25D366]/20 text-[#25D366] hover:bg-[#25D366]/30 rounded-2xl transition-all hover:scale-105 active:scale-95 shrink-0">
                             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                        </button>
                        
                        {/* Select Conversation */}
                         <button className="flex-1 flex items-center justify-between p-3 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors text-gray-700 dark:text-gray-200 border border-white/5">
                            <span className="text-xs font-semibold">Select conversation</span>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </button>
                    </div>
                </motion.div>
              )}
            </div>
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
