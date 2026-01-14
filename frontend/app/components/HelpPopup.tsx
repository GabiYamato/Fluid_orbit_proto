'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef } from 'react';

interface HelpPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: string;
}

export default function HelpPopup({ isOpen, onClose }: HelpPopupProps) {
  const [showChatbot, setShowChatbot] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showChatbot) {
          setShowChatbot(false);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, showChatbot, onClose]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    // Get current time
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });

    // Add user message
    const userMessage: Message = {
      id: Date.now(),
      text: inputMessage,
      isUser: true,
      timestamp: timeString,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');

    // Add bot response after a short delay
    setTimeout(() => {
      const botNow = new Date();
      const botTimeString = botNow.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      const botMessage: Message = {
        id: Date.now() + 1,
        text: 'Your query has been stored. We will get in touch shortly. In the meantime, you can contact us at accounts@enuid.com',
        isUser: false,
        timestamp: botTimeString,
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 500);
  };

  const handleContactSupport = () => {
    setShowChatbot(true);
  };

  const handleBackToFAQ = () => {
    setShowChatbot(false);
    setMessages([]);
    setInputMessage('');
  };

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
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{
                duration: 0.3,
                ease: [0.16, 1, 0.3, 1],
                scale: { type: 'spring', damping: 25, stiffness: 300 },
              }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 sm:mx-auto pointer-events-auto max-h-[85vh] flex flex-col"
            >
              {!showChatbot ? (
                <>
                  {/* FAQ View */}
                  {/* Header */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-gray-100"
                  >
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight text-right">
                      Help & Support
                    </h2>
                  </motion.div>

                  {/* FAQ Content */}
                  <div className="px-6 sm:px-8 py-4 sm:py-6 overflow-y-auto flex-1">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.3 }}
                    >
                      <h3 className="text-lg font-semibold text-gray-900 mb-6">
                        Frequently Asked Questions
                      </h3>

                      {/* FAQ Items */}
                      <div className="space-y-6">
                        {/* FAQ 1 */}
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2, duration: 0.3 }}
                          className="border-b border-gray-100 pb-6"
                        >
                          <h4 className="text-base font-semibold text-gray-900 mb-2">
                            How do I search for products?
                          </h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            Simply type your prompt for the product in the conversation box and press Enter or click the search button.
                          </p>
                        </motion.div>

                        {/* FAQ 2 */}
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.25, duration: 0.3 }}
                          className="border-b border-gray-100 pb-6"
                        >
                          <h4 className="text-base font-semibold text-gray-900 mb-2">
                            Can I change the theme?
                          </h4>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            Yes! Go to Settings and toggle between Light and Dark mode.
                          </p>
                        </motion.div>

                        {/* FAQ 3 */}
                        <motion.div
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3, duration: 0.3 }}
                          className="pb-6"
                        >
                          <h4 className="text-base font-semibold text-gray-900 mb-2">
                            Need more help?
                          </h4>
                          <p className="text-sm text-gray-600 leading-relaxed mb-4">
                            Contact our support team at: support@enuid.com
                          </p>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleContactSupport}
                            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm"
                          >
                            Contact Support
                          </motion.button>
                        </motion.div>
                      </div>
                    </motion.div>
                  </div>

                  {/* Footer */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35, duration: 0.3 }}
                    className="px-6 sm:px-8 pb-6 sm:pb-8 pt-4 border-t border-gray-100"
                  >
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={onClose}
                      className="w-full px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                    >
                      Close
                    </motion.button>
                  </motion.div>
                </>
              ) : (
                <>
                  {/* Chatbot View */}
                  {/* Header */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.3 }}
                    className="px-6 sm:px-8 pt-6 sm:pt-8 pb-4 border-b border-gray-100 flex items-center justify-between"
                  >
                    <button
                      onClick={handleBackToFAQ}
                      className="text-gray-600 hover:text-gray-900 transition-colors"
                    >
                      <svg
                        className="w-5 h-5 sm:w-6 sm:h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">
                      Contact Support
                    </h2>
                    <div className="w-5 sm:w-6" />
                  </motion.div>

                  {/* Chat Messages */}
                  <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-4 sm:py-6 space-y-4">
                    {messages.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-center text-gray-500 text-sm mt-8"
                      >
                        Send us a message and we'll get back to you shortly!
                      </motion.div>
                    ) : (
                      messages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="flex flex-col gap-1">
                            <div
                              className={`max-w-[75%] px-4 py-3 rounded-lg ${
                                message.isUser
                                  ? 'bg-gray-900 text-white'
                                  : 'bg-white text-gray-900 border border-gray-200'
                              }`}
                            >
                              <p className="text-sm leading-relaxed">{message.text}</p>
                            </div>
                            <span
                              className={`text-xs text-gray-400 px-1 ${
                                message.isUser ? 'text-right' : 'text-left'
                              }`}
                            >
                              {message.timestamp}
                            </span>
                          </div>
                        </motion.div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.3 }}
                    className="px-6 sm:px-8 pb-6 sm:pb-8 pt-4 border-t border-gray-100"
                  >
                    <div className="flex gap-2 sm:gap-3">
                      <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-gray-900 placeholder-gray-400 transition-all"
                      />
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSendMessage}
                        className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm flex items-center gap-2"
                      >
                        <span>Send</span>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                          />
                        </svg>
                      </motion.button>
                    </div>
                  </motion.div>
                </>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
