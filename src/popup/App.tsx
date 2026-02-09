import React, { useState, useEffect } from 'react';
import { Wallet, Settings, RefreshCw, Maximize2 } from 'lucide-react';
import AssetsTab from './components/AssetsTab';
import { SetPassword } from './components/SetPassword';
import { UnlockScreen } from './components/UnlockScreen';
import { isPasswordSet, validateSession } from '../utils/password_manager';
// TrendsTab removed - bottom tabs removed

interface WalletData {
    address: string;
    chain_type: string;
    remark: string;
    balance: number;
    status: string;
    last_updated: number;
    isCex?: boolean;
    cexName?: string;
}

interface AppState {
    wallets: WalletData[];
    totalBalance: number;
    isUpdating: boolean;
    lastUpdated: string;
    updateProgress: string;
    updateCountdown: string;
}

const App: React.FC = () => {
    // Password protection state
    const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
    const [isLocked, setIsLocked] = useState<boolean | null>(null);

    // Tab state removed - bottom tabs removed
    const [state, setState] = useState<AppState>({
        wallets: [],
        totalBalance: 0,
        isUpdating: false,
        lastUpdated: '--',
        updateProgress: '',
        updateCountdown: ''
    });

    const [showOnboarding, setShowOnboarding] = useState(false);

    // Check authentication status
    useEffect(() => {
        const checkAuth = async () => {
            try {
                // Check if password exists
                const passwordExists = await isPasswordSet();

                if (!passwordExists) {
                    // No password set yet - let user access normally
                    // They'll set it up when clicking Settings
                    setNeedsSetup(false);
                    setIsLocked(false);
                    return;
                }

                // Password exists, check session
                const sessionValid = await validateSession();
                setNeedsSetup(false);
                setIsLocked(!sessionValid);
            } catch (error) {
                console.error('Auth check failed:', error);
                setNeedsSetup(false);
                setIsLocked(false);
            }
        };

        checkAuth();
    }, []);

    // Load data from chrome.storage
    useEffect(() => {
        const loadData = async () => {
            try {
                const data = await chrome.storage.local.get(['wallets']);
                const wallets = (data.wallets || []) as WalletData[];
                const totalBalance = wallets.reduce((sum: number, w: WalletData) => sum + (w.balance || 0), 0);

                // Find latest update time
                let latestUpdate = 0;
                wallets.forEach((w: WalletData) => {
                    if (w.last_updated && w.last_updated > latestUpdate) {
                        latestUpdate = w.last_updated;
                    }
                });

                const lastUpdated = latestUpdate > 0
                    ? new Date(latestUpdate).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '--';

                setState(prev => ({
                    ...prev,
                    wallets,
                    totalBalance,
                    lastUpdated
                }));
            } catch (error) {
                console.error('Failed to load data:', error);
            }
        };

        loadData();

        // Listen for storage changes
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.wallets) {
                loadData();
            }
        };

        chrome.storage.onChanged.addListener(handleStorageChange);
        return () => chrome.storage.onChanged.removeListener(handleStorageChange);
    }, []);

    // Onboarding tooltip logic
    useEffect(() => {
        chrome.storage.local.get(['hasSeenOnboarding', 'wallets'], (data) => {
            const hasSeenOnboarding = data.hasSeenOnboarding || false;
            const wallets = (data.wallets || []) as WalletData[];

            // Show tooltip only if: (1) First time, (2) No wallets configured
            if (!hasSeenOnboarding && wallets.length === 0) {
                setShowOnboarding(true);
            }
        });
    }, []);

    // Handle refresh button
    const handleRefresh = async () => {
        setState(prev => ({ ...prev, isUpdating: true }));
        try {
            await chrome.runtime.sendMessage({ action: 'START_UPDATE' });
        } catch (error) {
            console.error('Failed to start update:', error);
        }
        // The isUpdating will be set to false when storage is updated
        setTimeout(() => {
            setState(prev => ({ ...prev, isUpdating: false }));
        }, 30000); // Timeout fallback
    };

    // Listen for update complete and progress
    useEffect(() => {
        const handleMessage = (message: { action: string; payload?: { msg?: string; current?: number; total?: number; remaining?: number; label?: string } }) => {
            if (message.action === 'UPDATE_COMPLETE') {
                setState(prev => ({ ...prev, isUpdating: false, updateProgress: '', updateCountdown: '' }));
            } else if (message.action === 'UPDATE_STATUS') {
                // Status update from background.js - always update progress
                const { current, total } = message.payload || {};
                const progressText = current && total ? `Updating (${current}/${total})` : '';
                setState(prev => ({ ...prev, updateProgress: progressText }));
            } else if (message.action === 'COUNTDOWN') {
                // Countdown for screenshot delay - separate display
                const { remaining } = message.payload || {};
                if (remaining && remaining > 0) {
                    setState(prev => ({ ...prev, updateCountdown: `⏱️ ${remaining}s` }));
                } else {
                    setState(prev => ({ ...prev, updateCountdown: '' }));
                }
            } else if (message.action === 'REFRESH_DATA') {
                // Storage listener will handle this automatically
            }
        };
        chrome.runtime.onMessage.addListener(handleMessage);
        return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }, []);

    // Show loading while checking auth
    if (needsSetup === null || isLocked === null) {
        return (
            <div className="flex items-center justify-center h-[600px] w-[400px] bg-gradient-to-b from-[#151b28] to-[#0f1419]">
                <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-sm">Loading...</p>
                </div>
            </div>
        );
    }

    // Show password setup screen (triggered from Settings button)
    if (needsSetup) {
        return <SetPassword onComplete={() => {
            setNeedsSetup(false);
            setIsLocked(false);
        }} />;
    }

    // Show unlock screen
    if (isLocked) {
        return <UnlockScreen onUnlock={() => setIsLocked(false)} />;
    }

    return (
        <div className="flex flex-col h-[600px] w-[400px] bg-gradient-to-b from-[#151b28] to-[#0f1419]">
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                <div className="flex items-center gap-2">
                    <img src="assets/icon48.png" alt="SmartFolio" className="w-8 h-8 rounded-lg" />
                    <span className="font-bold text-white text-lg">SmartFolio</span>
                </div>
                <div className="flex items-center gap-2">
                    {/* Progress and Countdown - shown separately during update */}
                    {state.isUpdating && (
                        <>
                            <span className="text-xs text-emerald-400 font-medium">
                                {state.updateProgress}
                            </span>
                            {state.updateCountdown && (
                                <span className="text-xs text-blue-400">
                                    {state.updateCountdown}
                                </span>
                            )}
                        </>
                    )}
                    {/* Maximize - open Dashboard */}
                    <button
                        onClick={() => chrome.tabs.create({ url: 'dashboard.html' })}
                        className="text-gray-400 hover:text-white transition p-1"
                        title="Open Dashboard"
                    >
                        <Maximize2 className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={state.isUpdating}
                        className="text-gray-400 hover:text-white transition p-1"
                        title="Refresh"
                    >
                        <RefreshCw
                            className={`w-5 h-5 ${state.isUpdating ? 'animate-spin text-emerald-400' : ''}`}
                        />
                    </button>
                    <button
                        onClick={async () => {
                            // Dismiss onboarding tooltip
                            if (showOnboarding) {
                                setShowOnboarding(false);
                                chrome.storage.local.set({ hasSeenOnboarding: true });
                            }

                            // Check if password is set
                            const passwordExists = await isPasswordSet();
                            if (!passwordExists) {
                                // Show password setup
                                setNeedsSetup(true);
                            } else {
                                // Open settings in dashboard
                                chrome.tabs.create({ url: 'dashboard.html#settings' });
                            }
                        }}
                        className="text-gray-400 hover:text-white transition p-1 relative"
                        title="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {/* Onboarding Tooltip */}
            {showOnboarding && (
                <div className="onboarding-tooltip">
                    <div className="tooltip-bubble">
                        Click{' '}
                        <span
                            onClick={async () => {
                                setShowOnboarding(false);
                                chrome.storage.local.set({ hasSeenOnboarding: true });

                                // Check if password is set (same logic as Settings button)
                                const passwordExists = await isPasswordSet();
                                if (!passwordExists) {
                                    // Show password setup
                                    setNeedsSetup(true);
                                } else {
                                    // Open settings in dashboard
                                    chrome.tabs.create({ url: 'dashboard.html#settings' });
                                }
                            }}
                            className="tooltip-link"
                        >
                            ⚙️
                        </span>{' '}
                        to configure your wallets & API keys! 🚀
                    </div>
                    <div className="tooltip-arrow"></div>
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 w-full overflow-hidden">
                <AssetsTab wallets={state.wallets} totalBalance={state.totalBalance} lastUpdated={state.lastUpdated} />
            </main>
        </div>
    );
};

export default App;
