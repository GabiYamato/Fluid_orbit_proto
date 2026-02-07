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
import ConversationSearchPopup from './components/ConversationSearchPopup';
import SavedProductsPage from './components/SavedProductsPage';

type AppState = 'auth' | 'loading' | 'skeleton' | 'home' | 'results' | 'settings' | 'personalization' | 'help' | 'history' | 'saved';

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
  const [showSearchPopup, setShowSearchPopup] = useState(false);
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

  // Ref to track latest chat history for async operations (prevent stale closures)
  const chatHistoryRef = useRef(chatHistory);

  useEffect(() => {
    chatHistoryRef.current = chatHistory;
  }, [chatHistory]);

  const [chatSessions, setChatSessions] = useState<Array<{
    id: string;
    timestamp: string;
    messages: Array<{ role: 'user' | 'ai'; content: string; timestamp?: string }>;
    preview: string;
  }>>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);


  // Load chat sessions and auth token from localStorage on mount
  useEffect(() => {
    const loadData = async () => {
      // Check for Google OAuth callback token in URL
      const urlParams = new URLSearchParams(window.location.search);
      const oauthToken = urlParams.get('access_token');

      if (oauthToken) {
        // Store the token from Google OAuth callback
        localStorage.setItem('access_token', oauthToken);
        setAccessToken(oauthToken);

        // Clean up the URL (remove the token from query params)
        window.history.replaceState({}, document.title, window.location.pathname);

        // Fetch user info with the new token
        try {
          const response = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${oauthToken}` },
          });
          if (response.ok) {
            const userData = await response.json();
            setEmail(userData.email || 'user@example.com');
            localStorage.setItem('user_email', userData.email || '');

            // Load display name from backend (server is source of truth)
            if (userData.display_name) {
              setUsername(userData.display_name);
              setDisplayName(userData.display_name);
              localStorage.setItem('user_custom_name', userData.display_name);
            }
          }
        } catch (error) {
          console.log('Could not fetch user info:', error);
        }

        // Navigate to home
        setAppState('home');
        return;
      }

      // Check for saved auth in localStorage
      const token = localStorage.getItem('access_token');
      const savedEmail = localStorage.getItem('user_email');
      const savedName = localStorage.getItem('user_custom_name');

      if (token) {
        setAccessToken(token);
        setEmail(savedEmail || 'user@example.com');
        // Initially use localStorage, then update from backend
        setUsername(savedName || '');
        setDisplayName(savedName || '');
        setAppState('home');

        // Fetch user info from backend (source of truth for display_name)
        try {
          const userResponse = await fetch(`${API_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.display_name) {
              setUsername(userData.display_name);
              setDisplayName(userData.display_name);
              localStorage.setItem('user_custom_name', userData.display_name);
            }
          }
        } catch (error) {
          console.log('Could not fetch user info from backend');
        }

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

      // Load saved sidebar state
      const savedSidebar = localStorage.getItem('sidebar_expanded');
      if (savedSidebar !== null) {
        setSidebarExpanded(savedSidebar === 'true');
      }
    };

    loadData();
  }, []);

  // Save current chat session (creates new or updates existing)
  const saveCurrentChatSession = async (forceNew: boolean = false) => {
    const currentHistory = chatHistoryRef.current;
    if (currentHistory.length === 0) return;

    const firstUserMessage = currentHistory.find(msg => msg.role === 'user');
    if (!firstUserMessage) return;

    // Use existing session ID or create new one
    const sessionId = forceNew || !currentSessionId ? Date.now().toString() : currentSessionId;

    const sessionData = {
      id: sessionId,
      timestamp: new Date().toISOString(),
      messages: currentHistory.filter(msg => !msg.error),
      preview: firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : ''),
    };

    // Update currentSessionId if new
    if (!currentSessionId || forceNew) {
      setCurrentSessionId(sessionId);
    }

    // Update local state AND localStorage together
    setChatSessions(prev => {
      const existingIndex = prev.findIndex(s => s.id === sessionId);
      let updatedSessions;

      if (existingIndex >= 0) {
        // Update existing session
        updatedSessions = [...prev];
        updatedSessions[existingIndex] = sessionData;
      } else {
        // Add new session at the beginning
        updatedSessions = [sessionData, ...prev].slice(0, 10);
      }

      // Save to localStorage with the updated sessions (inside callback to use correct state)
      localStorage.setItem('chat_sessions', JSON.stringify(updatedSessions));

      return updatedSessions;
    });

    // Also save to backend if authenticated
    if (accessToken) {
      try {
        await fetch(`${API_URL}/history/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ session: sessionData }),
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
      setCurrentSessionId(sessionId);
      setAppState('results');
    }
  };

  // Delete a chat session
  const deleteChatSession = async (sessionId: string) => {
    const updatedSessions = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(updatedSessions);
    localStorage.setItem('chat_sessions', JSON.stringify(updatedSessions));

    // If we're deleting the current session, clear the chat
    if (sessionId === currentSessionId) {
      setChatHistory([]);
      setCurrentQuery('');
      setCurrentSessionId(null);
    }

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

      // Reset sessions state before loading user's data
      setChatSessions([]);
      setChatHistory([]);
      setCurrentSessionId(null);

      // Clear any existing chat sessions from state
      setChatSessions([]);
      setChatHistory([]);
      setCurrentSessionId(null);
      // Also ensure localStorage is clean for the new user
      localStorage.removeItem('chat_sessions');

      // Start the flow: home directly
      setAppState('home');
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
      const token = data.access_token;
      setAccessToken(token);
      localStorage.setItem('access_token', token);
      localStorage.setItem('user_email', email);

      const customName = localStorage.getItem('user_custom_name') || '';
      setUsername(customName);
      setDisplayName(customName);
      setEmail(email);

      // Reset sessions state before loading user's data
      setChatHistory([]);
      setCurrentSessionId(null);

      // Fetch user info and chat sessions from backend BEFORE navigating to home
      let loadedSessions: any[] = [];

      // Fetch user info first
      try {
        const userResponse = await fetch(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.display_name) {
            setUsername(userData.display_name);
            setDisplayName(userData.display_name);
            localStorage.setItem('user_custom_name', userData.display_name);
          }
        }
      } catch (userError) {
        console.error('Failed to fetch user info:', userError);
      }

      // Then fetch sessions
      try {
        const sessionsResponse = await fetch(`${API_URL}/history/sessions`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          loadedSessions = sessionsData.sessions || [];
        } else {
          console.error('Failed to fetch sessions:', sessionsResponse.status);
        }
      } catch (sessionError) {
        console.error('Failed to fetch sessions (network):', sessionError);
      }

      // Update sessions state and navigate to home in a single batch
      setChatSessions(loadedSessions);
      setAppState('home');
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      console.error('Sign in error:', err);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setError('');
      // Redirect to backend Google OAuth login endpoint
      window.location.href = `${API_URL}/auth/google/login`;
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

    // CRITICAL: Clear chat sessions from local storage to prevent leakage to next user
    localStorage.removeItem('chat_sessions');

    setAccessToken(null);
    setAppState('auth');
    setUsername('');
    setEmail('user@example.com');
    setChatHistory([]);
    setChatSessions([]); // Clear current session list
    setCurrentSessionId(null);
  };

  const handleSearch = async (query: string, options?: { hideUserMessage?: boolean }) => {
    try {
      setCurrentQuery(query);
      setIsStreaming(true);

      // Add user message to history (unless hidden for clarification responses)
      const userMessage = { role: 'user' as const, content: query, timestamp: new Date().toISOString() };

      if (!options?.hideUserMessage) {
        setChatHistory(prev => [...prev, userMessage]);

        // Immediately create/update session in sidebar so conversation shows up right away
        const sessionId = currentSessionId || Date.now().toString();
        if (!currentSessionId) {
          setCurrentSessionId(sessionId);
        }

        const sessionData = {
          id: sessionId,
          timestamp: new Date().toISOString(),
          messages: [userMessage],
          preview: query.slice(0, 50) + (query.length > 50 ? '...' : ''),
        };

        setChatSessions(prev => {
          const existingIndex = prev.findIndex(s => s.id === sessionId);
          let updatedSessions;

          if (existingIndex >= 0) {
            updatedSessions = [...prev];
            updatedSessions[existingIndex] = sessionData;
          } else {
            updatedSessions = [sessionData, ...prev].slice(0, 10);
          }

          localStorage.setItem('chat_sessions', JSON.stringify(updatedSessions));
          return updatedSessions;
        });
      }

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

      // Auto-save the session to backend after each successful query
      // Use setTimeout to ensure state has updated with final message content
      // Auto-save the session to backend after each successful query
      // Use setTimeout to ensure state has updated with final message content (via ref)
      setTimeout(() => {
        saveCurrentChatSession();
      }, 500);

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

  const handleNameUpdate = async (name: string) => {
    setDisplayName(name);
    setUsername(name);
    localStorage.setItem('user_custom_name', name);

    // Persist to backend if authenticated
    if (accessToken) {
      try {
        await fetch(`${API_URL}/auth/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ display_name: name }),
        });
      } catch (error) {
        console.error('Failed to save name to backend:', error);
      }
    }
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
    // Reset chat and session ID for new conversation
    setChatHistory([]);
    setCurrentQuery('');
    setCurrentSessionId(null);
    setAppState('home');
  };

  const handleHistoryClick = () => {
    setShowSearchPopup(true);
  };

  const toggleSidebar = () => {
    const newState = !sidebarExpanded;
    setSidebarExpanded(newState);
    localStorage.setItem('sidebar_expanded', String(newState));
  };

  const handleLogoClick = () => {
    saveCurrentChatSession();
    setAppState('home');
    setChatHistory([]); // This will update the ref, but save happened before
    setCurrentQuery('');
    setCurrentSessionId(null);
  };

  const handleSavedClick = () => {
    setAppState('saved');
  };

  return (
    <>
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
            onSavedProductsClick={handleSavedClick}
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
            onSavedProductsClick={handleSavedClick}
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

        {appState === 'saved' && (
          <SavedProductsPage
            key="saved"
            onBack={handleHomeClick}
          />
        )}
      </AnimatePresence>

      <ConversationSearchPopup
        isOpen={showSearchPopup}
        onClose={() => setShowSearchPopup(false)}
        sessions={chatSessions}
        onRestoreSession={(sessionId) => {
          restoreChatSession(sessionId);
          setAppState('results');
        }}
        onDeleteSession={deleteChatSession}
      />
    </>
  );
}
