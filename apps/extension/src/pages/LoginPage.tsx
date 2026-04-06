import React from 'react';
import { Terminal, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/auth-context';

export default function LoginPage({ onSwitch }: { onSwitch: () => void }) {
    const { signIn } = useAuth();

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20 shadow-2xl">
                <div className="text-center mb-10">
                    <div className="bg-white/20 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/30">
                        <Terminal className="h-10 w-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
                    <p className="text-white/70 text-sm">Sign in to your Executive Assistant</p>
                </div>

                <div className="space-y-4">
                    <button
                        onClick={() => signIn('google')}
                        className="w-full bg-white text-gray-900 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-all active:scale-95 shadow-xl shadow-black/10 group"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                            <path
                                fill="currentColor"
                                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            />
                            <path
                                fill="currentColor"
                                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            />
                            <path
                                fill="currentColor"
                                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            />
                        </svg>
                        Continue with Google
                    </button>

                    <button
                        onClick={() => signIn('github')}
                        className="w-full bg-gray-900 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-gray-800 transition-all active:scale-95 shadow-xl shadow-black/20 group border border-white/10"
                    >
                        <LogIn className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        Continue with GitHub
                    </button>
                </div>

                <div className="mt-10 text-center">
                    <p className="text-white/50 text-xs">
                        By continuing, you agree to Extenda's Terms of Service and Privacy Policy.
                    </p>
                </div>
            </div>

            <div className="mt-8 flex items-center gap-6 text-white/40 text-xs uppercase tracking-widest font-bold">
                <span>Secure</span>
                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                <span>Encrypted</span>
                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                <span>Private</span>
            </div>
        </div>
    );
}
