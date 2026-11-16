import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal,
  Image as ImageIcon,
  BookOpen,
  FolderGit2,
  Compass,
  Volume2,
  VolumeX,
  Plus,
  Send,
  Copy,
  Check,
  Trash2,
  Sparkles,
  FileEdit,
  Globe,
  ChevronRight,
  Search,
  Lock,
  ShieldCheck,
  CreditCard,
  LogOut,
  X,
  Sliders,
  KeyRound,
  Languages,
} from 'lucide-react';
import { soundEngine } from './utils/soundEngine';

type NavSection =
  | 'terminal'
  | 'images'
  | 'library'
  | 'customize'
  | 'projects'
  | 'explore';

type ModelId = 'gemini-1.5-flash' | 'gemini-1.5-pro';

interface UserProfile {
  name: string;
  email: string;
  avatarInitials: string;
  authenticatedAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
  modelLabel: string;
  isImagePrompt?: boolean;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
  model: ModelId;
  messages: ChatMessage[];
}

interface SavedLibraryItem {
  id: string;
  title: string;
  category: 'Image Prompt' | 'Architecture' | 'Security' | 'Code';
  content: string;
  createdAt: string;
}

const STORAGE_KEYS = {
  USER: 'vidu_ai_auth_user_v2',
  SESSIONS: 'vidu_ai_chat_sessions_v2',
  ACTIVE_SESSION_ID: 'vidu_ai_active_session_id_v2',
  PRO_SUBSCRIBED: 'vidu_ai_google_pro_v2',
  LIBRARY: 'vidu_ai_library_v2',
};

const DEFAULT_SESSIONS: ChatSession[] = [
  {
    id: 'session-welcome',
    title: 'Welcome to Vidu AI Terminal',
    updatedAt: 'Today',
    model: 'gemini-1.5-flash',
    messages: [],
  },
];

const INITIAL_LIBRARY: SavedLibraryItem[] = [
  {
    id: 'lib-1',
    title: 'Biometric Command Deck — Midjourney v6',
    category: 'Image Prompt',
    createdAt: '2026-11-15',
    content:
      '/imagine prompt: Architectural wide shot of a subterranean biometric command deck designed by Vidusha Nawood, matte obsidian consoles with crisp phosphor-emerald holographic schematics, volumetric tungsten and neon-green rim lighting, shot on Leica SL2-S 24mm f/1.4, hyper-detailed industrial realism --ar 16:9 --v 6.0 --style raw --stylize 250',
  },
  {
    id: 'lib-2',
    title: 'Distributed Rate Limiter (Sliding Window)',
    category: 'Code',
    createdAt: '2026-11-14',
    content:
      'Atomic sliding-window request quota enforcement with sub-millisecond evaluation and zero race conditions.',
  },
];

const EXPLORE_TEMPLATES = [
  {
    title: 'Cinematic Hardware Concept Art',
    category: 'Image Creation · Midjourney v6',
    prompt:
      'Create an image: Macro studio photograph of a custom matte-black neural processing unit with glowing emerald fiber-optic traces, shallow depth of field, 85mm macro lens',
  },
  {
    title: 'Sinhala & English Security Architecture',
    category: 'Bilingual Intelligence · සිංහල / EN',
    prompt:
      'Explain how Zero-Trust Network Architecture works and provide a production Node.js JWT verification middleware. Include a clear summary in Sinhala (සිංහල) and English.',
  },
  {
    title: 'High-Frequency WebSocket Engine',
    category: 'System Design · TypeScript',
    prompt:
      'Write a complete TypeScript WebSocket multiplexing client with automatic exponential backoff and heartbeat state tracking.',
  },
  {
    title: 'Editorial Sci-Fi Poster Prompt',
    category: 'Image Creation · DALL-E 3',
    prompt:
      'Create an image: Minimalist Swiss-grid brutalist poster for a cybersecurity symposium in Colombo, deep black paper texture with phosphor green ink',
  },
];

export default function App() {
  // 1. Mandatory Google Authentication State
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      return saved ? (JSON.parse(saved) as UserProfile) : null;
    } catch {
      return null;
    }
  });
  const [authNameInput, setAuthNameInput] = useState<string>('Vidusha Nawood');
  const [authEmailInput, setAuthEmailInput] = useState<string>('vidushanawood@gmail.com');
  const [authStepVerifying, setAuthStepVerifying] = useState<boolean>(false);

  // 2. Persistent Chat Sessions & History State
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatSession[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Fallback
    }
    return DEFAULT_SESSIONS;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION_ID);
      if (savedId) return savedId;
    } catch {
      // Fallback
    }
    return DEFAULT_SESSIONS[0].id;
  });

  // 3. Google Pro ($1/month) Subscription State
  const [isProSubscribed, setIsProSubscribed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEYS.PRO_SUBSCRIBED) === 'true';
    } catch {
      return false;
    }
  });
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState<boolean>(false);
  const [cardHolderName, setCardHolderName] = useState<string>('Vidusha Nawood');

  // 4. Hidden 5-Click Admin Panel State (Password: vidusha5621)
  const titleClickTimestamps = useRef<number[]>([]);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [adminAuthError, setAdminAuthError] = useState<string>('');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [adminSystemOverride, setAdminSystemOverride] = useState<string>('');
  const [serverStats, setServerStats] = useState<{
    totalRequests: number;
    flashRequests: number;
    proRequests: number;
    imagePromptsGenerated: number;
    serverStartedAt: string;
  } | null>(null);

  // 5. Navigation & Terminal State
  const [activeSection, setActiveSection] = useState<NavSection>('terminal');
  const [selectedModel, setSelectedModel] = useState<ModelId>('gemini-1.5-flash');
  const [languagePreference, setLanguagePreference] = useState<'bilingual' | 'english' | 'sinhala'>(
    'bilingual'
  );
  const [ambientPlaying, setAmbientPlaying] = useState<boolean>(false);
  const [sfxEnabled, setSfxEnabled] = useState<boolean>(true);
  const [scanlinesEnabled, setScanlinesEnabled] = useState<boolean>(true);

  const [promptInput, setPromptInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [libraryItems, setLibraryItems] = useState<SavedLibraryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LIBRARY);
      return saved ? (JSON.parse(saved) as SavedLibraryItem[]) : INITIAL_LIBRARY;
    } catch {
      return INITIAL_LIBRARY;
    }
  });
  const [librarySearch, setLibrarySearch] = useState<string>('');

  // Image Studio State
  const [imgSubject, setImgSubject] = useState<string>(
    'Subterranean quantum server vault with emerald fiber-optic conduits'
  );
  const [imgAspectRatio, setImgAspectRatio] = useState<string>('16:9');
  const [imgLighting, setImgLighting] = useState<string>(
    'Volumetric phosphor rim lighting, high-contrast chiaroscuro'
  );
  const [imgLens, setImgLens] = useState<string>('Leica 35mm f/1.4 Summilux, photorealistic');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Persist Sessions, Active Session, Pro Status, and Library to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch {
      // Ignore storage quota errors
    }
  }, [sessions]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION_ID, activeSessionId);
    } catch {
      // Ignore
    }
  }, [activeSessionId]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.PRO_SUBSCRIBED, String(isProSubscribed));
    } catch {
      // Ignore
    }
  }, [isProSubscribed]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.LIBRARY, JSON.stringify(libraryItems));
    } catch {
      // Ignore
    }
  }, [libraryItems]);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || DEFAULT_SESSIONS[0];
  const messages = activeSession.messages;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Fetch server stats when Admin Panel is unlocked
  useEffect(() => {
    if (isAdminUnlocked) {
      fetch('/api/admin/stats')
        .then((r) => r.json())
        .then((data) => setServerStats(data))
        .catch(() => {});
    }
  }, [isAdminUnlocked, messages.length]);

  // Secret 5-Click Handler on "Vidu AI" Title
  const handleBrandTitleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    const now = Date.now();
    const recent = titleClickTimestamps.current.filter((t) => now - t < 2200);
    recent.push(now);
    titleClickTimestamps.current = recent;

    if (recent.length >= 5) {
      titleClickTimestamps.current = [];
      setAdminPasswordInput('');
      setAdminAuthError('');
      if (isAdminUnlocked) {
        setShowAdminAuthModal(true);
      } else {
        setShowAdminAuthModal(true);
      }
    } else {
      setActiveSection('terminal');
    }
  };

  const handleAdminPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    if (adminPasswordInput === 'vidusha5621') {
      soundEngine.playReceive();
      setIsAdminUnlocked(true);
      setAdminAuthError('');
    } else {
      setAdminAuthError('Access Denied: Invalid administrator passkey.');
    }
  };

  // Google Sign-In Verification Handler
  const handleGoogleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmailInput.trim() || !authNameInput.trim()) return;
    soundEngine.playSend();
    setAuthStepVerifying(true);

    setTimeout(() => {
      const cleanName = authNameInput.trim();
      const initials = cleanName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const newProfile: UserProfile = {
        name: cleanName,
        email: authEmailInput.trim(),
        avatarInitials: initials || 'VN',
        authenticatedAt: new Date().toLocaleString(),
      };

      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newProfile));
      setUser(newProfile);
      setAuthStepVerifying(false);
      soundEngine.playReceive();
    }, 650);
  };

  const handleSignOut = () => {
    soundEngine.playClick();
    localStorage.removeItem(STORAGE_KEYS.USER);
    setUser(null);
  };

  // Google Pay $1/month Subscription Handler
  const handleCompleteGooglePay = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playSend();
    setIsProcessingPayment(true);
    setTimeout(() => {
      setIsProcessingPayment(false);
      setIsProSubscribed(true);
      setSelectedModel('gemini-1.5-pro');
      setShowPayModal(false);
      soundEngine.playReceive();
    }, 900);
  };

  const handleToggleAmbient = () => {
    soundEngine.playClick();
    const nextState = soundEngine.toggleAmbientTrack();
    setAmbientPlaying(nextState);
  };

  const handleSelectSection = (section: NavSection) => {
    soundEngine.playClick();
    setActiveSection(section);
  };

  const handleModelChange = (model: ModelId) => {
    soundEngine.playClick();
    if (model === 'gemini-1.5-pro' && !isProSubscribed) {
      setShowPayModal(true);
      return;
    }
    setSelectedModel(model);
  };

  const handleCreateNewSession = () => {
    soundEngine.playClick();
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: 'New Terminal Session',
      updatedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: selectedModel,
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveSection('terminal');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    soundEngine.playClick();
    const remaining = sessions.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      const fresh: ChatSession = {
        id: `session-${Date.now()}`,
        title: 'New Terminal Session',
        updatedAt: 'Now',
        model: selectedModel,
        messages: [],
      };
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  const handleCopyText = (id: string, text: string) => {
    soundEngine.playClick();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSaveToLibrary = (msg: ChatMessage) => {
    soundEngine.playClick();
    const newItem: SavedLibraryItem = {
      id: `lib-${Date.now()}`,
      title: msg.text.slice(0, 56).replace(/[#*`]/g, '').trim() + '...',
      category: msg.isImagePrompt ? 'Image Prompt' : 'Architecture',
      content: msg.text,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setLibraryItems((prev) => [newItem, ...prev]);
    setSavedNotice(msg.id);
    setTimeout(() => setSavedNotice(null), 1800);
  };

  const executePrompt = async (rawPrompt: string, forceImageMode = false) => {
    const trimmed = rawPrompt.trim();
    if (!trimmed || isLoading) return;

    soundEngine.playSend();
    setActiveSection('terminal');
    setPromptInput('');

    const isImageRequest =
      forceImageMode ||
      /create an image|generate an image|midjourney|dall-e|image prompt|draw|render a/i.test(
        trimmed
      );

    const nowTime = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: nowTime,
      modelLabel: selectedModel === 'gemini-1.5-pro' ? 'Gemini 1.5 Pro' : 'Gemini 1.5 Flash',
      isImagePrompt: isImageRequest,
    };

    const updatedTitle =
      activeSession.messages.length === 0
        ? trimmed.slice(0, 38) + (trimmed.length > 38 ? '...' : '')
        : activeSession.title;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: updatedTitle,
              updatedAt: nowTime,
              messages: [...s.messages, userMsg],
            }
          : s
      )
    );
    setIsLoading(true);

    const languageDirective =
      languagePreference === 'sinhala'
        ? '\nRespond primarily in Sinhala (සිංහල) while keeping code blocks and technical identifiers accurate.'
        : languagePreference === 'english'
          ? '\nRespond in crisp, technical English.'
          : '\nYou are fluent in both Sinhala (සිංහල) and English; match the user language or provide bilingual clarity when helpful.';

    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          modelMode: selectedModel === 'gemini-1.5-pro' ? 'pro' : 'flash',
          adminSystemOverride: adminSystemOverride
            ? `${adminSystemOverride}\n${languageDirective}`
            : languageDirective,
          isImageRequest,
          history: activeSession.messages.slice(-8).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate response.');
      }

      soundEngine.playReceive();

      const replyTime = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });

      const aiMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: data.text,
        timestamp: replyTime,
        modelLabel: selectedModel === 'gemini-1.5-pro' ? 'Gemini 1.5 Pro' : 'Gemini 1.5 Flash',
        isImagePrompt: isImageRequest,
      };

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                updatedAt: replyTime,
                messages: [...s.messages, aiMsg],
              }
            : s
        )
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unable to reach Vidu AI synthesis endpoint.';
      const errMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: 'model',
        text: `System Alert: ${errorMessage}`,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
        modelLabel: selectedModel === 'gemini-1.5-pro' ? 'Gemini 1.5 Pro' : 'Gemini 1.5 Flash',
      };
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                messages: [...s.messages, errMsg],
              }
            : s
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executePrompt(promptInput);
  };

  const handleQuickSuggestion = (type: 'image' | 'write' | 'search') => {
    soundEngine.playClick();
    if (type === 'image') {
      const text =
        'Create an image: Futuristic hacker command center designed by Vidusha Nawood, glowing emerald phosphor CRT monitors, dark brushed aluminum surfaces, cinematic lighting';
      executePrompt(text, true);
    } else if (type === 'write') {
      const text =
        'Write or edit: Implement a high-performance TypeScript token-bucket rate limiter with full code and a brief Sinhala & English architectural overview.';
      executePrompt(text, false);
    } else {
      const text =
        'Search the web: Compare modern post-quantum cryptographic key exchange standards (ML-KEM / Kyber) with classical ECDHE in TLS 1.3.';
      executePrompt(text, false);
    }
  };

  const handleSynthesizeImageStudio = (e: React.FormEvent) => {
    e.preventDefault();
    const studioPrompt = `Create an image: ${imgSubject}. Lighting: ${imgLighting}. Camera & Lens: ${imgLens}. Target Aspect Ratio: --ar ${imgAspectRatio}. Generate both an optimized Midjourney v6 prompt and a detailed DALL-E 3 prompt.`;
    executePrompt(studioPrompt, true);
  };

  const filteredLibrary = libraryItems.filter(
    (item) =>
      item.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      item.content.toLowerCase().includes(librarySearch.toLowerCase()) ||
      item.category.toLowerCase().includes(librarySearch.toLowerCase())
  );

  const totalMessagesCount = sessions.reduce((acc, s) => acc + s.messages.length, 0);

  // ============================================================================
  // MANDATORY GOOGLE AUTHENTICATION GATEWAY SCREEN
  // ============================================================================
  if (!user) {
    return (
      <div className="min-h-screen w-screen bg-[#050805] text-[#d1fae5] flex flex-col justify-between p-6 relative overflow-hidden">
        {scanlinesEnabled && (
          <div className="fixed inset-0 crt-scanlines pointer-events-none z-40" />
        )}

        <header className="flex items-center justify-between max-w-6xl w-full mx-auto py-2 z-10">
          <span
            onClick={handleBrandTitleClick}
            className="text-lg font-bold tracking-wider text-[#6ee7b7] cursor-pointer select-none"
          >
            Vidu AI
          </span>
          <span className="text-xs text-[#4b7c63]">Created by Vidusha Nawood</span>
        </header>

        <main className="flex-1 flex items-center justify-center z-10 my-auto">
          <div className="w-full max-w-md bg-[#070d08] border border-[#1d4d30] rounded p-8 space-y-6">
            <div className="space-y-2 text-center">
              <div className="w-12 h-12 rounded bg-[#0c180f] border border-[#1d4d30] flex items-center justify-center mx-auto text-[#6ee7b7]">
                <ShieldCheck className="w-6 h-6 text-[#10b981]" />
              </div>
              <h1 className="text-2xl font-bold text-[#6ee7b7] tracking-tight">
                Vidu AI Identity Gateway
              </h1>
              <p className="text-xs text-[#a7f3d0]/75 leading-relaxed">
                Authenticate with your Google Account to access the Vidu AI terminal workspace and
                restore your encrypted session history.
              </p>
            </div>

            <form onSubmit={handleGoogleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#6ee7b7] block">Google Account Name</label>
                <input
                  type="text"
                  required
                  value={authNameInput}
                  onChange={(e) => setAuthNameInput(e.target.value)}
                  placeholder="Vidusha Nawood"
                  className="w-full bg-[#050805] text-[#d1fae5] text-sm px-3.5 py-2.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#6ee7b7] block">Google Email Address</label>
                <input
                  type="email"
                  required
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  placeholder="name@gmail.com"
                  className="w-full bg-[#050805] text-[#d1fae5] text-sm px-3.5 py-2.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <button
                type="submit"
                disabled={authStepVerifying}
                className="w-full py-3 px-4 bg-[#10b981] hover:bg-[#6ee7b7] text-[#050805] font-bold text-sm rounded transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z" />
                </svg>
                <span>
                  {authStepVerifying
                    ? 'Verifying Google Credentials...'
                    : 'Continue with Google Verification'}
                </span>
              </button>
            </form>

            <div className="pt-3 border-t border-[#143321] flex items-center justify-between text-xs text-[#4b7c63]">
              <span>Sinhala &amp; English Bilingual Core</span>
              <span>·</span>
              <span>Persistent Local Sessions</span>
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-[#4b7c63] py-2 z-10">
          Vidu AI System Architecture by Vidusha Nawood
        </footer>
      </div>
    );
  }

  // ============================================================================
  // AUTHENTICATED TERMINAL WORKSPACE
  // ============================================================================
  return (
    <div className="min-h-screen h-screen w-screen bg-[#050805] text-[#d1fae5] flex flex-col overflow-hidden relative">
      {scanlinesEnabled && (
        <div className="fixed inset-0 crt-scanlines pointer-events-none z-40" />
      )}

      {/* Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-[#070d08] border-b border-[#143321] shrink-0 z-30">
        {/* Zone 1: Secret 5-Click Trigger Brand Title */}
        <a
          href="#terminal"
          onClick={handleBrandTitleClick}
          className="text-lg font-bold tracking-wider text-[#6ee7b7] whitespace-nowrap shrink-0 select-none cursor-pointer"
          title="Vidu AI by Vidusha Nawood"
        >
          Vidu AI
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <button
            type="button"
            onClick={() => handleSelectSection('terminal')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'terminal'
                ? 'text-[#6ee7b7] underline underline-offset-4'
                : 'text-[#a7f3d0]/70 hover:text-[#6ee7b7]'
            }`}
          >
            Terminal
          </button>
          <button
            type="button"
            onClick={() => handleSelectSection('images')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'images'
                ? 'text-[#6ee7b7] underline underline-offset-4'
                : 'text-[#a7f3d0]/70 hover:text-[#6ee7b7]'
            }`}
          >
            Images
          </button>
          <button
            type="button"
            onClick={() => handleSelectSection('library')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'library'
                ? 'text-[#6ee7b7] underline underline-offset-4'
                : 'text-[#a7f3d0]/70 hover:text-[#6ee7b7]'
            }`}
          >
            Library
          </button>
          <button
            type="button"
            onClick={() => handleSelectSection('projects')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'projects'
                ? 'text-[#6ee7b7] underline underline-offset-4'
                : 'text-[#a7f3d0]/70 hover:text-[#6ee7b7]'
            }`}
          >
            Projects
          </button>
          <button
            type="button"
            onClick={() => handleSelectSection('explore')}
            className={`transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'explore'
                ? 'text-[#6ee7b7] underline underline-offset-4'
                : 'text-[#a7f3d0]/70 hover:text-[#6ee7b7]'
            }`}
          >
            Explore
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleToggleAmbient}
            className={`px-4 py-2 text-xs font-bold rounded transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              ambientPlaying
                ? 'bg-[#132a1c] text-[#6ee7b7] border border-[#10b981]'
                : 'bg-[#10b981] text-[#050805] hover:bg-[#6ee7b7]'
            }`}
          >
            {ambientPlaying ? (
              <>
                <Volume2 className="w-3.5 h-3.5" />
                <span>Mute Audio</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5" />
                <span>Initialize Audio</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar Menu */}
        <aside className="w-64 bg-[#070d08] border-r border-[#143321] flex flex-col justify-between shrink-0">
          <div className="p-4 space-y-5 overflow-y-auto flex-1">
            <button
              type="button"
              onClick={handleCreateNewSession}
              className="w-full py-2 px-4 bg-[#0c180f] hover:bg-[#122417] text-[#6ee7b7] border border-[#1d4d30] rounded text-xs font-bold flex items-center justify-between transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span>New Chat Session</span>
              </span>
              <span className="text-[#4b7c63]">+</span>
            </button>

            {/* Primary Navigation */}
            <div className="space-y-1">
              <div className="text-xs text-[#4b7c63] px-2.5 pb-1">Navigation</div>
              {(
                [
                  { id: 'terminal', label: 'Terminal Chat', icon: Terminal },
                  { id: 'images', label: 'Images', icon: ImageIcon },
                  { id: 'library', label: 'Library', icon: BookOpen },
                  { id: 'customize', label: 'Preferences', icon: Sliders },
                  { id: 'projects', label: 'Projects', icon: FolderGit2 },
                  { id: 'explore', label: 'Explore', icon: Compass },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectSection(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-[#0f2215] text-[#6ee7b7] border border-[#1d4d30]'
                        : 'text-[#a7f3d0]/80 hover:bg-[#0b160e] hover:text-[#6ee7b7]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Persistent Chat History Sessions */}
            <div className="pt-4 border-t border-[#143321] space-y-1.5">
              <div className="flex items-center justify-between px-2.5 pb-1">
                <span className="text-xs text-[#4b7c63]">Saved Chat History</span>
                <span className="text-xs text-[#4b7c63] tabular-nums">{sessions.length}</span>
              </div>
              <div className="space-y-1">
                {sessions.map((sess) => {
                  const isCurrent = sess.id === activeSession.id;
                  return (
                    <div
                      key={sess.id}
                      onClick={() => {
                        soundEngine.playClick();
                        setActiveSessionId(sess.id);
                        setActiveSection('terminal');
                      }}
                      className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded text-xs transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#0f2215] text-[#6ee7b7] border border-[#1d4d30]'
                          : 'text-[#a7f3d0]/75 hover:bg-[#0b160e] hover:text-[#6ee7b7]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{sess.title}</div>
                        <div className="text-[11px] text-[#4b7c63] tabular-nums">
                          {sess.messages.length} msgs · {sess.updatedAt}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        className="opacity-0 group-hover:opacity-100 text-[#4b7c63] hover:text-[#6ee7b7] p-1 transition-opacity cursor-pointer"
                        title="Delete chat session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Google Pro Upgrade Banner + User Profile Footer */}
          <div className="p-4 border-t border-[#143321] bg-[#050805] space-y-3">
            {!isProSubscribed ? (
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  setShowPayModal(true);
                }}
                className="w-full py-2 px-3 bg-[#0c180f] hover:bg-[#132618] border border-[#10b981]/60 rounded text-left transition-colors flex items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#6ee7b7] truncate">
                    Upgrade to Google Pro
                  </div>
                  <div className="text-[11px] text-[#a7f3d0]/70 truncate">
                    $1/month via Google Pay
                  </div>
                </div>
                <CreditCard className="w-4 h-4 text-[#10b981] shrink-0" />
              </button>
            ) : (
              <div className="px-3 py-1.5 bg-[#0c180f] border border-[#1d4d30] rounded flex items-center justify-between text-xs text-[#6ee7b7]">
                <span>Google Pro Active</span>
                <span className="text-[#10b981] tabular-nums">$1/mo</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded bg-[#0f2215] border border-[#1d4d30] flex items-center justify-center text-xs font-bold text-[#6ee7b7] shrink-0">
                  {user.avatarInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#6ee7b7] truncate">{user.name}</div>
                  <div className="text-[11px] text-[#4b7c63] truncate">{user.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="p-1.5 text-[#4b7c63] hover:text-[#6ee7b7] rounded hover:bg-[#0c180f] transition-colors shrink-0 cursor-pointer"
                title="Sign out of Google Account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Viewport */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#050805]">
          {/* Workspace Model, Bilingual Mode & Google Pro Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-3 bg-[#080f0a] border-b border-[#143321] shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <label htmlFor="model-select" className="text-xs text-[#4b7c63] whitespace-nowrap">
                AI Model:
              </label>
              <select
                id="model-select"
                value={selectedModel}
                onChange={(e) => handleModelChange(e.target.value as ModelId)}
                className="bg-[#0c180f] text-[#6ee7b7] text-xs px-3 py-1.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981] cursor-pointer"
              >
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Standard)</option>
                <option value="gemini-1.5-pro">
                  Gemini 1.5 Pro {isProSubscribed ? '(Google Pro Unlocked)' : '(Requires Google Pro $1/mo)'}
                </option>
              </select>

              <div className="flex items-center gap-1.5 text-xs text-[#4b7c63] pl-2">
                <Languages className="w-3.5 h-3.5 text-[#10b981]" />
                <span>Language:</span>
                <select
                  value={languagePreference}
                  onChange={(e) => {
                    soundEngine.playClick();
                    setLanguagePreference(
                      e.target.value as 'bilingual' | 'english' | 'sinhala'
                    );
                  }}
                  className="bg-[#0c180f] text-[#a7f3d0] text-xs px-2.5 py-1 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981] cursor-pointer"
                >
                  <option value="bilingual">Sinhala &amp; English (සිංහල / EN)</option>
                  <option value="sinhala">Sinhala Primary (සිංහල)</option>
                  <option value="english">English Only</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#a7f3d0]/80">
              <span>Creator: Vidusha Nawood</span>
              <span aria-hidden="true" className="text-[#143321]">
                ·
              </span>
              {!isProSubscribed ? (
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setShowPayModal(true);
                  }}
                  className="text-[#6ee7b7] hover:underline font-bold cursor-pointer whitespace-nowrap"
                >
                  Unlock Google Pro ($1/mo)
                </button>
              ) : (
                <span className="text-[#10b981] font-bold">Google Pro Member</span>
              )}
            </div>
          </div>

          {/* Terminal Chat View */}
          {activeSection === 'terminal' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="max-w-3xl mx-auto py-8 space-y-8">
                    <div className="space-y-3">
                      <div className="text-xs text-[#4b7c63]">
                        Vidu AI Terminal · Created by Vidusha Nawood · Sinhala (සිංහල) &amp; English
                        Bilingual Core
                      </div>
                      <h1
                        className="text-2xl md:text-4xl font-bold text-[#6ee7b7] tracking-tight"
                        style={{ textWrap: 'balance' }}
                      >
                        Welcome back, {user.name}
                      </h1>
                      <p className="text-sm text-[#a7f3d0]/80 max-w-2xl leading-relaxed">
                        Ask anything in Sinhala (සිංහල) or English. Generate full production code
                        blocks, cybersecurity audits, or optimized Midjourney v6 and DALL-E 3 visual
                        prompts. Your chat history is automatically saved across sessions.
                      </p>
                    </div>

                    {/* Main Screen Suggestions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        type="button"
                        onClick={() => handleQuickSuggestion('image')}
                        className="p-5 text-left bg-[#08100a] border border-[#143321] hover:border-[#10b981] rounded transition-colors flex flex-col justify-between gap-4 cursor-pointer group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[#6ee7b7]">
                            <span className="text-sm font-bold">Create an image</span>
                            <Sparkles className="w-4 h-4 text-[#10b981] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                          <p className="text-xs text-[#a7f3d0]/75 leading-relaxed">
                            Synthesize Midjourney v6 and DALL-E 3 prompts with camera optics and
                            lighting parameters.
                          </p>
                        </div>
                        <div className="text-xs text-[#4b7c63] flex items-center gap-1">
                          <span>Launch prompt synthesizer</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickSuggestion('write')}
                        className="p-5 text-left bg-[#08100a] border border-[#143321] hover:border-[#10b981] rounded transition-colors flex flex-col justify-between gap-4 cursor-pointer group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[#6ee7b7]">
                            <span className="text-sm font-bold">Write or edit</span>
                            <FileEdit className="w-4 h-4 text-[#10b981] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                          <p className="text-xs text-[#a7f3d0]/75 leading-relaxed">
                            Generate complete production code blocks and architecture guides in
                            English or Sinhala (සිංහල).
                          </p>
                        </div>
                        <div className="text-xs text-[#4b7c63] flex items-center gap-1">
                          <span>Run code synthesis</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickSuggestion('search')}
                        className="p-5 text-left bg-[#08100a] border border-[#143321] hover:border-[#10b981] rounded transition-colors flex flex-col justify-between gap-4 cursor-pointer group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[#6ee7b7]">
                            <span className="text-sm font-bold">Search the web</span>
                            <Globe className="w-4 h-4 text-[#10b981] group-hover:translate-x-0.5 transition-transform" />
                          </div>
                          <p className="text-xs text-[#a7f3d0]/75 leading-relaxed">
                            Analyze network protocols, zero-trust security advisories, and system
                            benchmarks.
                          </p>
                        </div>
                        <div className="text-xs text-[#4b7c63] flex items-center gap-1">
                          <span>Execute technical brief</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-3xl mx-auto space-y-4">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`p-5 rounded border ${
                          msg.role === 'user'
                            ? 'bg-[#09140c] border-[#1d4d30]'
                            : 'bg-[#070d08] border-[#143321]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2 text-xs text-[#4b7c63]">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#6ee7b7]">
                              {msg.role === 'user' ? user.name : 'Vidu AI'}
                            </span>
                            <span>·</span>
                            <span>{msg.modelLabel}</span>
                            {msg.isImagePrompt && (
                              <>
                                <span>·</span>
                                <span className="text-[#10b981]">Midjourney &amp; DALL-E Mode</span>
                              </>
                            )}
                          </div>
                          <div className="flex items-center gap-3 tabular-nums">
                            <span>{msg.timestamp}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyText(msg.id, msg.text)}
                              className="text-[#a7f3d0]/70 hover:text-[#6ee7b7] flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === msg.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-[#10b981]" />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                            {msg.role === 'model' && (
                              <button
                                type="button"
                                onClick={() => handleSaveToLibrary(msg)}
                                className="text-[#a7f3d0]/70 hover:text-[#6ee7b7] cursor-pointer"
                              >
                                {savedNotice === msg.id ? 'Saved' : 'Save'}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-[#d1fae5] whitespace-pre-wrap leading-relaxed">
                          {msg.text}
                        </div>
                      </div>
                    ))}

                    {isLoading && (
                      <div className="p-5 rounded border border-[#143321] bg-[#070d08] space-y-2">
                        <div className="text-xs text-[#6ee7b7]">
                          Vidu AI ({selectedModel}) is synthesizing response...
                        </div>
                        <div className="h-2 w-48 bg-[#143321] rounded overflow-hidden">
                          <div className="h-full w-1/2 bg-[#10b981] animate-pulse" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Bottom Terminal Input Composer */}
              <div className="p-4 bg-[#070d08] border-t border-[#143321] shrink-0">
                <form
                  onSubmit={handleFormSubmit}
                  className="max-w-3xl mx-auto flex items-center gap-3"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="Ask Vidu AI in English or Sinhala (සිංහල), request code, or type 'Create an image: ...'"
                    className="flex-1 bg-[#050805] text-[#d1fae5] placeholder-[#4b7c63] text-sm px-4 py-3 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !promptInput.trim()}
                    className="px-5 py-3 bg-[#10b981] hover:bg-[#6ee7b7] disabled:opacity-40 text-[#050805] font-bold text-sm rounded transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Images Studio View */}
          {activeSection === 'images' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-[#6ee7b7]">
                    Image Prompt Synthesis Studio
                  </h2>
                  <p className="text-sm text-[#a7f3d0]/75">
                    Configure subject, lighting, camera optics, and aspect ratio to generate
                    optimized Midjourney v6 and DALL-E 3 prompts.
                  </p>
                </div>

                <form
                  onSubmit={handleSynthesizeImageStudio}
                  className="p-6 bg-[#070d08] border border-[#143321] rounded space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#6ee7b7] block">Visual Subject &amp; Scene</label>
                    <input
                      type="text"
                      value={imgSubject}
                      onChange={(e) => setImgSubject(e.target.value)}
                      className="w-full bg-[#050805] text-[#d1fae5] text-sm px-4 py-2.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs text-[#6ee7b7] block">Aspect Ratio</label>
                      <select
                        value={imgAspectRatio}
                        onChange={(e) => setImgAspectRatio(e.target.value)}
                        className="w-full bg-[#050805] text-[#d1fae5] text-sm px-3 py-2.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                      >
                        <option value="16:9">16:9 (Widescreen Cinema)</option>
                        <option value="1:1">1:1 (Square Showcase)</option>
                        <option value="3:4">3:4 (Editorial Portrait)</option>
                        <option value="21:9">21:9 (Ultrawide Anamorphic)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-[#6ee7b7] block">Atmosphere &amp; Lighting</label>
                      <input
                        type="text"
                        value={imgLighting}
                        onChange={(e) => setImgLighting(e.target.value)}
                        className="w-full bg-[#050805] text-[#d1fae5] text-sm px-3 py-2.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-[#6ee7b7] block">Camera &amp; Optics</label>
                      <input
                        type="text"
                        value={imgLens}
                        onChange={(e) => setImgLens(e.target.value)}
                        className="w-full bg-[#050805] text-[#d1fae5] text-sm px-3 py-2.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-4">
                    <span className="text-xs text-[#4b7c63]">
                      Outputs structured Midjourney v6 &amp; DALL-E 3 prompts in chat
                    </span>
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-[#10b981] hover:bg-[#6ee7b7] text-[#050805] font-bold text-xs rounded transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Generate Image Prompts
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Library View */}
          {activeSection === 'library' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#6ee7b7]">Saved Library</h2>
                    <p className="text-sm text-[#a7f3d0]/75">
                      Bookmarked responses, prompts, and technical notes.
                    </p>
                  </div>
                  <div className="relative w-64">
                    <Search className="w-4 h-4 text-[#4b7c63] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={librarySearch}
                      onChange={(e) => setLibrarySearch(e.target.value)}
                      placeholder="Filter library..."
                      className="w-full bg-[#070d08] text-xs text-[#d1fae5] pl-9 pr-3 py-2 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredLibrary.map((item) => (
                    <div
                      key={item.id}
                      className="p-5 bg-[#070d08] border border-[#143321] rounded space-y-2"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <h3 className="text-base font-bold text-[#6ee7b7]">{item.title}</h3>
                        <div className="flex items-center gap-3 text-xs text-[#4b7c63] shrink-0">
                          <span>{item.category}</span>
                          <span>·</span>
                          <span className="tabular-nums">{item.createdAt}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(item.id, item.content)}
                            className="text-[#a7f3d0] hover:text-[#6ee7b7] flex items-center gap-1 cursor-pointer"
                          >
                            {copiedId === item.id ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-[#d1fae5]/85 whitespace-pre-wrap leading-relaxed">
                        {item.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Preferences View (Clean User Preferences — No Exposed System Instructions or Raw Code) */}
          {activeSection === 'customize' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#6ee7b7]">
                    Terminal Audio &amp; Display Preferences
                  </h2>
                  <p className="text-sm text-[#a7f3d0]/75">
                    Customize acoustic feedback, language defaults, and CRT display settings.
                  </p>
                </div>

                <div className="p-6 bg-[#070d08] border border-[#143321] rounded space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-[#050805] rounded border border-[#143321]">
                      <div>
                        <div className="text-sm text-[#6ee7b7]">Keystroke &amp; Send Sound Effects</div>
                        <div className="text-xs text-[#4b7c63]">Synthesized Web Audio feedback</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !sfxEnabled;
                          setSfxEnabled(next);
                          soundEngine.setSfxEnabled(next);
                          if (next) soundEngine.playClick();
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer ${
                          sfxEnabled
                            ? 'bg-[#10b981] text-[#050805]'
                            : 'bg-[#0c180f] text-[#a7f3d0] border border-[#1d4d30]'
                        }`}
                      >
                        {sfxEnabled ? 'Enabled' : 'Muted'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-[#050805] rounded border border-[#143321]">
                      <div>
                        <div className="text-sm text-[#6ee7b7]">CRT Phosphor Scanlines</div>
                        <div className="text-xs text-[#4b7c63]">Subtle terminal raster overlay</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          setScanlinesEnabled(!scanlinesEnabled);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded cursor-pointer ${
                          scanlinesEnabled
                            ? 'bg-[#10b981] text-[#050805]'
                            : 'bg-[#0c180f] text-[#a7f3d0] border border-[#1d4d30]'
                        }`}
                      >
                        {scanlinesEnabled ? 'Active' : 'Off'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Projects View */}
          {activeSection === 'projects' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#6ee7b7]">Active Workspaces</h2>
                  <p className="text-sm text-[#a7f3d0]/75">
                    Pre-configured engineering workflows created by Vidusha Nawood.
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    {
                      name: 'Vidu Neural Core v2',
                      desc: 'Bilingual Sinhala/English full-stack code generation and system architecture.',
                      prompt:
                        'Design a fault-tolerant microservice gateway in TypeScript and summarize the architecture in both English and Sinhala (සිංහල).',
                    },
                    {
                      name: 'Phosphor Visual Synthesis Suite',
                      desc: 'Automated Midjourney v6 and DALL-E 3 cinematic prompt generator.',
                      prompt:
                        'Create an image: High-contrast industrial sci-fi hardware prototype with emerald telemetry displays',
                    },
                  ].map((proj, idx) => (
                    <div
                      key={idx}
                      className="p-5 bg-[#070d08] border border-[#143321] rounded flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-[#6ee7b7]">{proj.name}</h3>
                        <p className="text-xs text-[#a7f3d0]/80">{proj.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => executePrompt(proj.prompt)}
                        className="px-4 py-2 bg-[#0c180f] hover:bg-[#10b981] hover:text-[#050805] text-[#6ee7b7] border border-[#1d4d30] text-xs font-bold rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Launch Workspace
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Explore View */}
          {activeSection === 'explore' && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-[#6ee7b7]">Explore Prompt Workflows</h2>
                  <p className="text-sm text-[#a7f3d0]/75">
                    One-click Midjourney v6, DALL-E 3, and bilingual Sinhala/English engineering
                    prompts.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {EXPLORE_TEMPLATES.map((tpl, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => executePrompt(tpl.prompt)}
                      className="p-5 text-left bg-[#070d08] border border-[#143321] hover:border-[#10b981] rounded transition-colors space-y-2 cursor-pointer"
                    >
                      <div className="text-xs text-[#4b7c63]">{tpl.category}</div>
                      <div className="text-base font-bold text-[#6ee7b7]">{tpl.title}</div>
                      <p className="text-xs text-[#a7f3d0]/75 line-clamp-3">{tpl.prompt}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==========================================================================
          GOOGLE PAY SUBSCRIPTION GATEWAY MODAL ($1/MONTH FOR GOOGLE PRO)
      ========================================================================== */}
      {showPayModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-[#070d08] border border-[#10b981] rounded p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-[#143321] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#6ee7b7]">Google Pro Subscription</h3>
                <p className="text-xs text-[#4b7c63]">Instant Upgrade via Google Pay</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayModal(false)}
                className="text-[#4b7c63] hover:text-[#6ee7b7] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-[#050805] border border-[#143321] rounded space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-[#6ee7b7]">Google Pro Tier</span>
                <span className="text-2xl font-bold text-[#10b981] tabular-nums">$1.00 / month</span>
              </div>
              <ul className="text-xs text-[#a7f3d0]/80 space-y-1.5 pt-2">
                <li>· Full access to Gemini 1.5 Pro deep reasoning model</li>
                <li>· Unlimited bilingual Sinhala &amp; English code synthesis</li>
                <li>· Priority Midjourney v6 &amp; DALL-E 3 prompt generation</li>
              </ul>
            </div>

            <form onSubmit={handleCompleteGooglePay} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#6ee7b7] block">Google Pay Account Holder</label>
                <input
                  type="text"
                  required
                  value={cardHolderName}
                  onChange={(e) => setCardHolderName(e.target.value)}
                  className="w-full bg-[#050805] text-[#d1fae5] text-sm px-3 py-2 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full py-3 px-4 bg-[#10b981] hover:bg-[#6ee7b7] text-[#050805] font-bold text-sm rounded transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {isProcessingPayment
                    ? 'Authorizing Google Pay ($1.00)...'
                    : 'Pay $1.00/mo with Google Pay'}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          HIDDEN 5-CLICK ADMIN PANEL MODAL (PASSWORD: vidusha5621)
      ========================================================================== */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-2xl bg-[#070d08] border border-[#10b981] rounded p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#143321] pb-3">
              <div className="flex items-center gap-2 text-[#6ee7b7]">
                <KeyRound className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-lg font-bold">Vidu AI Root Administrator Console</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminAuthModal(false)}
                className="text-[#4b7c63] hover:text-[#6ee7b7] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!isAdminUnlocked ? (
              <form onSubmit={handleAdminPasswordSubmit} className="space-y-4">
                <p className="text-xs text-[#a7f3d0]/80">
                  Restricted root access for Vidusha Nawood. Enter administrator passkey to unlock
                  system telemetry and core overrides.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs text-[#6ee7b7] block">Administrator Password</label>
                  <input
                    type="password"
                    autoFocus
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="Enter root passkey..."
                    className="w-full bg-[#050805] text-[#d1fae5] text-sm px-3.5 py-2.5 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                  />
                </div>
                {adminAuthError && <p className="text-xs text-red-400">{adminAuthError}</p>}
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAdminAuthModal(false)}
                    className="px-4 py-2 text-xs border border-[#143321] rounded text-[#a7f3d0] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#10b981] text-[#050805] font-bold text-xs rounded cursor-pointer"
                  >
                    Authenticate Root
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                {/* System Telemetry Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-[#050805] border border-[#143321] rounded">
                    <div className="text-[11px] text-[#4b7c63]">Total API Queries</div>
                    <div className="text-xl font-bold text-[#6ee7b7] tabular-nums">
                      {serverStats?.totalRequests ?? 0}
                    </div>
                  </div>
                  <div className="p-3.5 bg-[#050805] border border-[#143321] rounded">
                    <div className="text-[11px] text-[#4b7c63]">Saved Chat Sessions</div>
                    <div className="text-xl font-bold text-[#6ee7b7] tabular-nums">
                      {sessions.length}
                    </div>
                  </div>
                  <div className="p-3.5 bg-[#050805] border border-[#143321] rounded">
                    <div className="text-[11px] text-[#4b7c63]">Stored Messages</div>
                    <div className="text-xl font-bold text-[#6ee7b7] tabular-nums">
                      {totalMessagesCount}
                    </div>
                  </div>
                  <div className="p-3.5 bg-[#050805] border border-[#143321] rounded">
                    <div className="text-[11px] text-[#4b7c63]">Google Pro Status</div>
                    <div className="text-sm font-bold text-[#10b981] pt-1">
                      {isProSubscribed ? 'PRO ACTIVE' : 'STANDARD'}
                    </div>
                  </div>
                </div>

                {/* Admin System Controls */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6ee7b7] block">
                    Root Persona &amp; System Instruction Override (Admin Only)
                  </label>
                  <textarea
                    rows={3}
                    value={adminSystemOverride}
                    onChange={(e) => setAdminSystemOverride(e.target.value)}
                    placeholder="Optional custom system directive override for Vidu AI..."
                    className="w-full bg-[#050805] text-[#d1fae5] text-xs p-3 rounded border border-[#1d4d30] focus:outline-none focus:border-[#10b981]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#143321]">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setIsProSubscribed(!isProSubscribed);
                      }}
                      className="px-3.5 py-2 bg-[#0c180f] hover:bg-[#132618] text-[#6ee7b7] border border-[#1d4d30] text-xs font-bold rounded cursor-pointer"
                    >
                      {isProSubscribed ? 'Revoke Google Pro' : 'Force Unlock Google Pro'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        setSessions(DEFAULT_SESSIONS);
                        setActiveSessionId(DEFAULT_SESSIONS[0].id);
                        localStorage.removeItem(STORAGE_KEYS.SESSIONS);
                      }}
                      className="px-3.5 py-2 bg-[#0c180f] hover:bg-[#132618] text-red-400 border border-[#1d4d30] text-xs font-bold rounded cursor-pointer"
                    >
                      Purge All Chat History
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminUnlocked(false);
                      setShowAdminAuthModal(false);
                    }}
                    className="px-4 py-2 bg-[#10b981] text-[#050805] font-bold text-xs rounded cursor-pointer"
                  >
                    Lock &amp; Close Admin
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
