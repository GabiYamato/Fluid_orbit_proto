'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import GradientBackground from './components/GradientBackground';
import SignUpForm from './components/SignUpForm';
import SignInForm from './components/SignInForm';
import LoadingScreen from './components/LoadingScreen';
import SkeletonLoader from './components/SkeletonLoader';
import HomePage from './components/HomePage';
import ResultsPage from './components/ResultsPage';
import SettingsPage from './components/SettingsPage';
import PersonalizationPage from './components/PersonalizationPage';
import HelpPage from './components/HelpPage';
import HistoryPage from './components/HistoryPage';

type AppState = 'auth' | 'loading' | 'skeleton' | 'home' | 'results' | 'settings' | 'personalization' | 'help' | 'history';

// Backend API URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [isSignUp, setIsSignUp] = useState(true);
  const [appState, setAppState] = useState<AppState>('auth');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('user@example.com');
  const [error, setError] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
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
  }>>([]);
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [chatSessions, setChatSessions] = useState<Array<{
    id: string;
    timestamp: string;
    messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
    preview: string;
  }>>([]);


  // Load chat sessions and auth token from localStorage on mount
  useEffect(() => {
    const loadData = async () => {
      // Check for saved auth
      const token = localStorage.getItem('access_token');
      const savedEmail = localStorage.getItem('user_email');
      const savedName = localStorage.getItem('user_custom_name');

      if (token) {
        setAccessToken(token);
        setEmail(savedEmail || 'user@example.com');
        setUsername(savedName || '');
        setDisplayName(savedName || '');
        setAppState('home');

        // Load sessions from backend for authenticated users
        try {
          const response = await fetch(`${API_URL}/history/sessions`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            setChatSessions(data.sessions || []);
            return;
          }
        } catch (error) {
          console.log('Backend sessions not available, using local');
        }
      }

      // Fallback to localStorage
      const savedSessions = localStorage.getItem('chat_sessions');
      if (savedSessions) {
        try {
          setChatSessions(JSON.parse(savedSessions));
        } catch (error) {
          console.error('Failed to load chat sessions:', error);
        }
      }
    };

    loadData();
  }, []);

  // Save current chat session
  const saveCurrentChatSession = async () => {
    if (chatHistory.length === 0) return;

    const firstUserMessage = chatHistory.find(msg => msg.role === 'user');
    if (!firstUserMessage) return;

    const newSession = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      messages: chatHistory.filter(msg => !msg.error),
      preview: firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : ''),
    };

    const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
    setChatSessions(updatedSessions);

    // Save to localStorage always
    localStorage.setItem('chat_sessions', JSON.stringify(updatedSessions));

    // Also save to backend if authenticated
    if (accessToken) {
      try {
        await fetch(`${API_URL}/history/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ session: newSession }),
        });
      } catch (error) {
        console.log('Failed to save session to backend');
      }
    }
  };

  // Restore a chat session
  const restoreChatSession = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setChatHistory(session.messages as any);
      setAppState('results');
    }
  };

  // Delete a chat session
  const deleteChatSession = async (sessionId: string) => {
    const updatedSessions = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(updatedSessions);
    localStorage.setItem('chat_sessions', JSON.stringify(updatedSessions));

    // Also delete from backend if authenticated
    if (accessToken) {
      try {
        await fetch(`${API_URL}/history/sessions/${sessionId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
      } catch (error) {
        console.log('Failed to delete session from backend');
      }
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      setError('');

      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Sign up failed');
      }

      const data = await response.json();

      // Store token
      setAccessToken(data.access_token);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user_email', email);

      setUsername('');
      setDisplayName('');
      setEmail(email);

      // Start the flow: loading -> skeleton -> home
      setAppState('loading');

      setTimeout(() => {
        setAppState('skeleton');
        setTimeout(() => {
          setAppState('home');
        }, 3000);
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Sign up failed');
      console.error('Sign up error:', err);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    try {
      setError('');

      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Sign in failed');
      }

      const data = await response.json();

      // Store token
      setAccessToken(data.access_token);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user_email', email);

      const customName = localStorage.getItem('user_custom_name') || '';
      setUsername(customName);
      setDisplayName(customName);
      setEmail(email);

      // Start the flow: loading -> skeleton -> home
      setAppState('loading');

      setTimeout(() => {
        setAppState('skeleton');
        setTimeout(() => {
          setAppState('home');
        }, 3000);
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      console.error('Sign in error:', err);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setError('');
      // Redirect to backend Google OAuth
      window.location.href = `${API_URL}/auth/google`;
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed');
      console.error('Google auth error:', err);
    }
  };

  const handleLogout = async () => {
    try {
      // Call backend logout
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });
    } catch (err) {
      console.error('Logout error:', err);
    }

    // Reset theme to light mode on logout
    localStorage.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');

    // Clear user data from localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_custom_name');

    setAccessToken(null);
    setAppState('auth');
    setUsername('');
    setEmail('user@example.com');
    setChatHistory([]);
  };

  const handleSearch = async (query: string) => {
    try {
      setCurrentQuery(query);
      setIsStreaming(true);

      // Add user message to history immediately
      const userMessage = { role: 'user' as const, content: query, timestamp: new Date().toISOString() };
      setChatHistory(prev => [...prev, userMessage]);

      // Show results page immediately
      setAppState('results');

      // Prepare history for backend
      const historyForBackend = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call our new backend streaming endpoint
      const response = await fetch(`${API_URL}/query/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: query,
          history: historyForBackend,
          max_results: 10,
          offset: 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let aiResponseContent = '';
      let products: any[] = [];

      // Add placeholder AI message
      setChatHistory(prev => [
        ...prev,
        { role: 'ai', content: '', timestamp: new Date().toISOString(), products: [] }
      ]);

      let currentEventType = '';

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.substring(7).trim();
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.substring(6).trim();

            if (data === '[DONE]') {
              currentEventType = '';
              continue;
            }

            try {
              // Handle based on event type
              if (currentEventType === 'products') {
                products = JSON.parse(data);
                // Update last AI message with products
                setChatHistory(prev => {
                  const updated = [...prev];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'ai') {
                    updated[updated.length - 1].products = products;
                  }
                  return updated;
                });
              } else if (currentEventType === 'token') {
                const parsed = JSON.parse(data);
                if (parsed.text) {
                  aiResponseContent += parsed.text;
                  // Update last AI message content
                  setChatHistory(prev => {
                    const updated = [...prev];
                    if (updated.length > 0 && updated[updated.length - 1].role === 'ai') {
                      updated[updated.length - 1].content = aiResponseContent;
                    }
                    return updated;
                  });
                }
              } else if (currentEventType === 'clarification') {
                // Handle clarification requests with widgets
                const clarification = JSON.parse(data);
                setChatHistory(prev => {
                  const updated = [...prev];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'ai') {
                    updated[updated.length - 1] = {
                      ...updated[updated.length - 1],
                      content: clarification.message || 'I need more information...',
                      clarification: {
                        message: clarification.message,
                        widgets: clarification.widgets || [],
                        parsedSoFar: clarification.parsed_so_far || {},
                      },
                    };
                  }
                  return updated;
                });
              } else if (currentEventType === 'status') {
                // Status updates (optional: could show in UI)
                console.log('Status:', data);
              } else if (currentEventType === 'scraped_count') {
                console.log('Scraped count:', data);
              }
            } catch (e) {
              // Not JSON, might be status message
              console.log('SSE parse error:', e, 'data:', data);
            }

            currentEventType = ''; // Reset after processing
          }
        }
      }

      setIsStreaming(false);

    } catch (error: any) {
      console.error('Search error:', error);
      setIsStreaming(false);

      let errorMessage = 'Failed to connect to backend API. ';
      if (error.message.includes('Failed to fetch')) {
        errorMessage = `Cannot reach backend server at ${API_URL}. Make sure it's running.`;
      } else {
        errorMessage += error.message;
      }

      setChatHistory(prev => [
        ...prev,
        {
          role: 'ai',
          content: errorMessage,
          error: true,
          details: error.message
        }
      ]);
    }
  };

  const handleHomeClick = () => {
    setAppState('home');
  };

  const handleSettingsClick = () => {
    setAppState('settings');
  };

  const handlePersonalizationClick = () => {
    setAppState('personalization');
  };

  const handleNameUpdate = (name: string) => {
    setDisplayName(name);
    setUsername(name);
    localStorage.setItem('user_custom_name', name);
  };

  const handleEmailUpdate = (newEmail: string) => {
    setEmail(newEmail);
    localStorage.setItem('user_email', newEmail);
  };

  const handlePersonalizationSave = (data: { displayName: string; language: string }) => {
    setDisplayName(data.displayName);
    setUsername(data.displayName);
    setAppState('home');
  };

  const handleHelpClick = () => {
    setAppState('help');
  };

  const handleNewChat = () => {
    // Save current chat if there's content
    if (chatHistory.length > 0) {
      saveCurrentChatSession();
    }
    // Reset chat
    setChatHistory([]);
    setCurrentQuery('');
    setAppState('home');
  };

  const handleHistoryClick = () => {
    setAppState('history');
  };

  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };

  const handleLogoClick = () => {
    saveCurrentChatSession();
    setAppState('home');
    setChatHistory([]);
    setCurrentQuery('');
  };

  return (
    <AnimatePresence mode="wait">
      {appState === 'auth' && (
        <div key="auth" className="flex min-h-screen">
          {/* Left side - Gradient Background */}
          <div className="hidden lg:flex lg:w-1/2 relative">
            <GradientBackground />
          </div>

          {/* Right side - Auth Forms */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
            {error && (
              <div className="absolute top-4 right-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-400 px-4 py-3 rounded">
                {error}
              </div>
            )}
            <AnimatePresence mode="wait">
              {isSignUp ? (
                <SignUpForm
                  key="signup"
                  onToggle={() => setIsSignUp(false)}
                  onSubmit={handleSignUp}
                  onGoogleAuth={handleGoogleAuth}
                />
              ) : (
                <SignInForm
                  key="signin"
                  onToggle={() => setIsSignUp(true)}
                  onSubmit={handleSignIn}
                  onGoogleAuth={handleGoogleAuth}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {appState === 'loading' && <LoadingScreen key="loading" />}

      {appState === 'skeleton' && <SkeletonLoader key="skeleton" />}

      {appState === 'home' && (
        <HomePage
          key="home"
          onSearch={handleSearch}
          username={displayName}
          email={email}
          onLogout={handleLogout}
          onSettingsClick={handleSettingsClick}
          onNameUpdate={handleNameUpdate}
          onPersonalizationClick={handlePersonalizationClick}
          onHelpClick={handleHelpClick}
          onEmailUpdate={handleEmailUpdate}
          onNewChat={handleNewChat}
          onHistoryClick={handleHistoryClick}
          onLogoClick={handleLogoClick}
          chatSessions={chatSessions}
          onRestoreSession={(sessionId) => {
            restoreChatSession(sessionId);
            setAppState('results');
          }}
          onDeleteSession={deleteChatSession}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={toggleSidebar}
        />
      )}

      {appState === 'results' && (
        <ResultsPage
          key="results"
          onSearch={handleSearch}
          username={displayName}
          email={email}
          onLogout={handleLogout}
          onHomeClick={handleHomeClick}
          onSettingsClick={handleSettingsClick}
          onPersonalizationClick={handlePersonalizationClick}
          onHelpClick={handleHelpClick}
          onEmailUpdate={handleEmailUpdate}
          onNewChat={handleNewChat}
          onHistoryClick={handleHistoryClick}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={toggleSidebar}
          chatHistory={chatHistory}
          searchQuery={currentQuery}
          onLogoClick={handleLogoClick}
          chatSessions={chatSessions}
          onRestoreSession={restoreChatSession}
          onDeleteSession={deleteChatSession}
          isStreaming={isStreaming}
        />
      )}

      {appState === 'settings' && (
        <SettingsPage
          key="settings"
          username={displayName}
          email={email}
          onHomeClick={handleHomeClick}
          onLogout={handleLogout}
          onLogoClick={handleLogoClick}
          chatSessions={chatSessions}
          onRestoreSession={restoreChatSession}
          onDeleteSession={deleteChatSession}
        />
      )}

      {appState === 'personalization' && (
        <PersonalizationPage
          key="personalization"
          username={displayName}
          email={email}
          onHomeClick={handleHomeClick}
          onSettingsClick={handleSettingsClick}
          onSave={handlePersonalizationSave}
          onLogoClick={handleLogoClick}
          chatSessions={chatSessions}
          onRestoreSession={restoreChatSession}
          onDeleteSession={deleteChatSession}
        />
      )}

      {appState === 'help' && (
        <HelpPage
          key="help"
          onHomeClick={handleHomeClick}
          onSettingsClick={handleSettingsClick}
          onLogoClick={handleLogoClick}
          chatSessions={chatSessions}
          onRestoreSession={restoreChatSession}
          onDeleteSession={deleteChatSession}
        />
      )}

      {appState === 'history' && (
        <HistoryPage
          key="history"
          username={displayName}
          email={email}
          chatSessions={chatSessions}
          onHomeClick={handleHomeClick}
          onSettingsClick={handleSettingsClick}
          onNewChat={handleNewChat}
          onRestoreSession={(sessionId) => {
            restoreChatSession(sessionId);
            setAppState('results');
          }}
          onDeleteSession={deleteChatSession}
          onLogout={handleLogout}
          onLogoClick={handleLogoClick}
          sidebarExpanded={sidebarExpanded}
          onToggleSidebar={toggleSidebar}
        />
      )}
    </AnimatePresence>
  );
}
