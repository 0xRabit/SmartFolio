import React, { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';
import { setupPassword, validatePasswordStrength, createSession } from '../../utils/password_manager';
import { encryptSettings, encryptCexAccounts } from '../../utils/encryption';

interface SetPasswordProps {
    onComplete: () => void;
}

export function SetPassword({ onComplete }: SetPasswordProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const strength = password ? validatePasswordStrength(password) : { valid: false, message: '' };
    const passwordsMatch = password && confirmPassword && password === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validate password strength
        if (!strength.valid) {
            setError(strength.message);
            return;
        }

        // Check passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            // Set up password
            await setupPassword(password);

            // Encrypt existing settings if any
            const data = await chrome.storage.local.get(['settings', 'cexAccounts']);

            if (data.settings && !(data.settings as any).isEncrypted) {
                const encrypted = encryptSettings(data.settings, password);
                await chrome.storage.local.set({ settings: encrypted });
            }

            if (data.cexAccounts && Array.isArray(data.cexAccounts)) {
                const encrypted = encryptCexAccounts(data.cexAccounts, password);
                await chrome.storage.local.set({ cexAccounts: encrypted });
            }

            // Create initial session
            await createSession(password);

            // Complete setup
            onComplete();
        } catch (err: any) {
            setError(err.message || 'Failed to set password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] w-[400px] bg-gradient-to-b from-[#151b28] to-[#0f1419] p-6">
            {/* Header */}
            <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Lock className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white mb-2">
                    🔐 Set Password
                </h1>
                <p className="text-gray-400 text-sm">
                    Protect your API keys with a password
                </p>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                {/* Password Input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Password
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 bg-[#1a2332] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition [&::-webkit-textfield-decoration-container]:text-white"
                            placeholder="Enter password"
                            autoFocus
                            style={{ colorScheme: 'dark' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    {password && (
                        <div className={`flex items-center gap-1 mt-1.5 text-xs px-2 py-1 rounded ${strength.valid
                                ? 'text-green-400 bg-green-900/30 font-semibold'
                                : 'text-red-400 bg-red-900/30 font-semibold'
                            }`}>
                            {strength.valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{strength.message}</span>
                        </div>
                    )}
                </div>

                {/* Confirm Password Input */}
                <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-2.5 pr-10 bg-[#1a2332] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition [&::-webkit-textfield-decoration-container]:text-white"
                            placeholder="Confirm password"
                            style={{ colorScheme: 'dark' }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                        >
                            {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    </div>
                    {confirmPassword && (
                        <div className={`flex items-center gap-1 mt-1.5 text-xs px-2 py-1 rounded ${passwordsMatch
                                ? 'text-green-400 bg-green-900/30 font-semibold'
                                : 'text-red-400 bg-red-900/30 font-semibold'
                            }`}>
                            {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            <span>{passwordsMatch ? 'Passwords match' : 'Passwords do not match'}</span>
                        </div>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg">
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}

                {/* Warning */}
                <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                    <p className="text-xs text-yellow-400">
                        ⚠️ <strong>Important:</strong> No password recovery available.
                        If forgotten, all API keys must be re-entered.
                    </p>
                </div>

                {/* Spacer to push button to bottom */}
                <div className="flex-1"></div>

                {/* Submit Button */}
                <button
                    type="submit"
                    disabled={loading || !strength.valid || !passwordsMatch}
                    className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-base rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                    {loading ? 'Setting up...' : 'Continue'}
                </button>
            </form>
        </div>
    );
}
