import { useState } from 'react';
import { ChevronRight, CheckCircle, Rocket, Target, Zap, Settings } from 'lucide-react';

interface OnboardingWizardProps {
    onComplete: () => void;
}

const BUSINESS_TYPES = ['Freelancer', 'Small Business', 'Startup', 'Enterprise', 'Agency', 'Other'];

const GOALS = [
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'tasks', label: 'Tasks', icon: '✅' },
    { id: 'crm', label: 'CRM', icon: '👥' },
    { id: 'social', label: 'Social', icon: '📱' },
    { id: 'docs', label: 'Documents', icon: '📄' }
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [businessType, setBusinessType] = useState('');
    const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);

    const handleGoalToggle = (goalId: string) => {
        setSelectedGoals(prev =>
            prev.includes(goalId) ? prev.filter(g => g !== goalId) : [...prev, goalId]
        );
    };

    const handleNext = async () => {
        if (step < 5) {
            setStep(step + 1);
        } else {
            try {
                const token = localStorage.getItem('accessToken');
                const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                await fetch(`${API_URL}/api/preferences`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        aiSettings: { businessType, goals: selectedGoals },
                        enabledTools: selectedGoals.includes('email') ? ['GmailAdapter_list_emails'] : []
                    })
                });
            } catch (error) {
                console.error('Error saving preferences:', error);
            }
            localStorage.setItem('onboarding_complete', 'true');
            onComplete();
        }
    };

    const canProceed = () => {
        if (step === 2 && !businessType) return false;
        if (step === 3 && selectedGoals.length === 0) return false;
        if (step === 4 && !connected) return false;
        return true;
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-xs mx-3 overflow-hidden">
                {/* Progress Bar */}
                <div className="h-1 bg-gray-100">
                    <div
                        className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                        style={{ width: `${(step / 5) * 100}%` }}
                    />
                </div>

                <div className="p-5">
                    {/* Step 1: Welcome */}
                    {step === 1 && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 mb-3">
                                <Rocket className="h-6 w-6 text-indigo-500" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Welcome to Extenda!</h2>
                            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                Your AI assistant that automates workflows across all your tools.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: <Zap className="h-4 w-4 text-indigo-500 mx-auto mb-1" />, title: 'Smart AI', desc: 'Auto workflows' },
                                    { icon: <Settings className="h-4 w-4 text-indigo-500 mx-auto mb-1" />, title: '200+ Actions', desc: '14 integrations' },
                                    { icon: <Target className="h-4 w-4 text-indigo-500 mx-auto mb-1" />, title: 'Goal-Driven', desc: 'Adapts to you' },
                                ].map((item) => (
                                    <div key={item.title} className="p-2.5 bg-indigo-50/60 rounded-lg text-center">
                                        {item.icon}
                                        <p className="text-xs font-semibold text-gray-800">{item.title}</p>
                                        <p className="text-[10px] text-gray-500 mt-0.5">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Business Type */}
                    {step === 2 && (
                        <div>
                            <h2 className="text-base font-bold text-gray-900 mb-0.5">What describes you best?</h2>
                            <p className="text-xs text-gray-500 mb-3">Helps us personalize your experience.</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {BUSINESS_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setBusinessType(type)}
                                        className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all text-left ${businessType === type
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Goals */}
                    {step === 3 && (
                        <div>
                            <h2 className="text-base font-bold text-gray-900 mb-0.5">Primary goals?</h2>
                            <p className="text-xs text-gray-500 mb-3">Select all that apply.</p>
                            <div className="grid grid-cols-2 gap-1.5">
                                {GOALS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => handleGoalToggle(goal.id)}
                                        className={`py-2 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${selectedGoals.includes(goal.id)
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <span>{goal.icon}</span>
                                        <span>{goal.label}</span>
                                        {selectedGoals.includes(goal.id) && (
                                            <CheckCircle className="h-3 w-3 text-indigo-500 ml-auto flex-shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Connect */}
                    {step === 4 && (
                        <div>
                            <h2 className="text-base font-bold text-gray-900 mb-0.5">Connect an integration</h2>
                            <p className="text-xs text-gray-500 mb-3">We recommend starting with Google.</p>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">📧</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-gray-900 truncate">Google Workspace</p>
                                        <p className="text-[10px] text-gray-500">Gmail, Calendar, Drive</p>
                                    </div>
                                    {connected ? (
                                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                    ) : (
                                        <button
                                            onClick={() => setConnected(true)}
                                            className="px-3 py-1 bg-indigo-500 text-white rounded-lg text-xs font-medium hover:bg-indigo-600 flex-shrink-0"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                                {connected && (
                                    <div className="mt-2 p-2 bg-green-50 border border-green-100 rounded-lg">
                                        <p className="text-[10px] text-green-700 flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3" /> Connected to Google!
                                        </p>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-400 text-center mt-2">
                                More integrations available in Settings
                            </p>
                        </div>
                    )}

                    {/* Step 5: Done */}
                    {step === 5 && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-50 mb-3">
                                <CheckCircle className="h-6 w-6 text-green-500" />
                            </div>
                            <h2 className="text-base font-bold text-gray-900 mb-1">You're all set!</h2>
                            <p className="text-xs text-gray-500 mb-3">Try your first command:</p>
                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 text-left space-y-1.5">
                                {['"Summarize my last 5 emails"', '"Create a meeting for tomorrow at 2pm"', '"What\'s on this page?"'].map((cmd) => (
                                    <p key={cmd} className="text-xs text-gray-600 flex items-center gap-1.5">
                                        <span className="text-indigo-400">›</span> {cmd}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center mt-4">
                        <span className="text-[10px] text-gray-400 font-medium">Step {step} of 5</span>
                        <button
                            onClick={handleNext}
                            disabled={step !== 1 && !canProceed()}
                            className="flex items-center gap-1 px-4 py-1.5 bg-indigo-500 text-white rounded-lg text-xs font-semibold hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            {step === 5 ? 'Get Started' : 'Next'}
                            <ChevronRight className="h-3 w-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
