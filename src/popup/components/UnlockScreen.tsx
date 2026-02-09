import React, { useState } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { createSession } from '../../utils/password_manager';

interface UnlockScreenProps {
    onUnlock: () => void;
}

export function UnlockScreen({ onUnlock }: UnlockScreenProps) {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [attempts, setAttempts] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Create session with password
            await createSession(password);

            // Success - unlock
            onUnlock();
        } catch (err: any) {
            setAttempts(prev => prev + 1);
            setError('Incorrect password');
            setPassword(''); // Clear password on error
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit(e as any);
        }
    };

    return (
        <div className="flex flex-col h-[600px] w-[400px] bg-gradient-to-b from-[#151b28] to-[#0f1419] p-6 justify-center">
            {/* Header */}
            <div className="text-center mb-8">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Lock className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">
                    🔒 Locked
                </h1>
                <p className="text-gray-400">
                    Enter your password to continue
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                {/* Password Input */}
                <div className="mb-6">
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full px-4 py-3 pr-10 bg-[#1a2332] border-2 border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-center transition"
                            placeholder="Enter password"
                            autoFocus
                            disabled={loading}
                            style={{ colorScheme: 'dark' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-3 bg-red-900/30 border border-red-700 rounded-lg animate-shake">
                        <p className="text-sm text-red-400 text-center font-medium">
                            {error}
                            {attempts > 2 && (
                                <span className="block mt-1 text-xs">
                                    ({attempts} failed attempts)
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {/* Unlock Button */}
                <button
                    type="submit"
                    disabled={loading || !password}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-base rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Unlocking...
                        </span>
                    ) : (
                        'Unlock'
                    )}
                </button>
            </form>

            {/* Session Info */}
            <div className="mt-8 pt-6 border-t border-gray-700">
                <p className="text-xs text-gray-500 text-center">
                    Session expires after 30 minutes of inactivity
                </p>
            </div>
        </div>
    );
}
