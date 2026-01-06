import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

// Import images
import googleIcon from '../assets/icons/google.png';
import githubIcon from '../assets/icons/github.png';
import linkedinIcon from '../assets/icons/linkedin.png';

export default function LoginPage({ onSwitch }: { onSwitch: () => void }) {
    const { loginWithOAuth } = useAuth();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState<string | null>(null);

    const handleOAuthLogin = async (provider: 'google' | 'github' | 'linkedin') => {
        setError('');
        setLoading(provider);

        try {
            await loginWithOAuth(provider);
        } catch (err: any) {
            setError(err.message || `Failed to sign in with ${provider}`);
        } finally {
            setLoading(null);
        }
    };

    const OAuthButton = ({
        provider,
        icon,
        label,
        bgColor,
        hoverColor,
        textColor = 'text-white'
    }: {
        provider: 'google' | 'github' | 'linkedin';
        icon: string;
        label: string;
        bgColor: string;
        hoverColor: string;
        textColor?: string;
    }) => (
        <button
            onClick={() => handleOAuthLogin(provider)}
            disabled={loading !== null}
            className={`w-full ${bgColor} ${textColor} py-3 px-4 rounded-lg font-medium ${hoverColor} transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-sm hover:shadow-md border border-transparent`}
        >
            {loading === provider ? (
                <LoadingSpinner size="sm" />
            ) : (
                <>
                    <img src={icon} alt={`${provider} logo`} className="w-5 h-5 object-contain" />
                    <span>{label}</span>
                </>
            )}
        </button>
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
                    <p className="text-gray-600">Sign in to continue to Extenda</p>
                </div>

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                <div className="space-y-3">
                    <OAuthButton
                        provider="google"
                        icon={googleIcon}
                        label="Continue with Google"
                        bgColor="bg-white border-gray-300 !border" // Force border override if needed or just rely on class order
                        hoverColor="hover:bg-gray-50 hover:border-gray-400"
                        textColor="text-gray-700"
                    />

                    <OAuthButton
                        provider="github"
                        icon={githubIcon}
                        label="Continue with GitHub"
                        bgColor="bg-gray-900"
                        hoverColor="hover:bg-gray-800"
                    />

                    <OAuthButton
                        provider="linkedin"
                        icon={linkedinIcon}
                        label="Continue with LinkedIn"
                        bgColor="bg-blue-600"
                        hoverColor="hover:bg-blue-700"
                    />
                </div>

                <div className="mt-8 text-center">
                    <p className="text-gray-600">
                        Don't have an account?{' '}
                        <button
                            onClick={onSwitch}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Sign up
                        </button>
                    </p>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-xs text-gray-500">
                        By continuing, you agree to our Terms of Service and Privacy Policy
                    </p>
                </div>
            </div>
        </div>
    );
}
