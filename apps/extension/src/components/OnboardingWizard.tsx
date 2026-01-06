import { useState } from 'react';
import { ChevronRight, CheckCircle, Rocket, Target, Zap, Settings } from 'lucide-react';

interface OnboardingWizardProps {
    onComplete: () => void;
}

const BUSINESS_TYPES = [
    'Freelancer',
    'Small Business',
    'Startup',
    'Enterprise',
    'Agency',
    'Other'
];

const GOALS = [
    { id: 'email', label: 'Email Management', icon: '📧' },
    { id: 'calendar', label: 'Calendar & Scheduling', icon: '📅' },
    { id: 'tasks', label: 'Task Management', icon: '✅' },
    { id: 'crm', label: 'CRM & Contacts', icon: '👥' },
    { id: 'social', label: 'Social Media', icon: '📱' },
    { id: 'docs', label: 'Document Management', icon: '📄' }
];

export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
    const [step, setStep] = useState(1);
    const [businessType, setBusinessType] = useState('');
    const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
    const [connected, setConnected] = useState(false);

    const handleGoalToggle = (goalId: string) => {
        setSelectedGoals(prev =>
            prev.includes(goalId)
                ? prev.filter(g => g !== goalId)
                : [...prev, goalId]
        );
    };

    const handleNext = async () => {
        if (step < 5) {
            setStep(step + 1);
        } else {
            // Save onboarding state
            try {
                const token = localStorage.getItem('accessToken');
                const API_URL = 'https://extenda-api-604583941288.us-central1.run.app';

                const response = await fetch(`${API_URL}/api/preferences`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        aiSettings: {
                            businessType,
                            goals: selectedGoals
                        },
                        // Default enabled tools based on goals
                        enabledTools: selectedGoals.includes('email') ? ['GmailAdapter_list_emails'] : []
                    })
                });

                if (!response.ok) {
                    console.error('Failed to save preferences');
                }
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
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
                {/* Progress Bar */}
                <div className="h-2 bg-gray-200 rounded-t-lg overflow-hidden">
                    <div
                        className="h-full bg-blue-600 transition-all duration-300"
                        style={{ width: `${(step / 5) * 100}%` }}
                    />
                </div>

                <div className="p-8">
                    {/* Step 1: Welcome */}
                    {step === 1 && (
                        <div className="text-center">
                            <Rocket className="h-16 w-16 text-blue-600 mx-auto mb-4" />
                            <h2 className="text-3xl font-bold text-gray-900 mb-4">
                                Welcome to Extenda!
                            </h2>
                            <p className="text-lg text-gray-600 mb-6">
                                Your AI-powered executive assistant that automates workflows across all your tools
                            </p>
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="p-4 bg-blue-50 rounded-lg">
                                    <Zap className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                    <h3 className="font-semibold text-gray-900 mb-1">Smart Automation</h3>
                                    <p className="text-sm text-gray-600">AI-powered workflow execution</p>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-lg">
                                    <Settings className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                    <h3 className="font-semibold text-gray-900 mb-1">200+ Actions</h3>
                                    <p className="text-sm text-gray-600">Across 14 integrations</p>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-lg">
                                    <Target className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                                    <h3 className="font-semibold text-gray-900 mb-1">Goal-Oriented</h3>
                                    <p className="text-sm text-gray-600">Adapts to your needs</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Business Type */}
                    {step === 2 && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">What describes you best?</h2>
                            <p className="text-gray-600 mb-6">This helps us personalize your experience</p>
                            <div className="grid grid-cols-2 gap-3">
                                {BUSINESS_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setBusinessType(type)}
                                        className={`p-4 rounded-lg border-2 transition-all ${businessType === type
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="font-medium text-gray-900">{type}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 3: Goals */}
                    {step === 3 && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">What are your primary goals?</h2>
                            <p className="text-gray-600 mb-6">Select all that apply</p>
                            <div className="grid grid-cols-2 gap-3">
                                {GOALS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => handleGoalToggle(goal.id)}
                                        className={`p-4 rounded-lg border-2 transition-all flex items-center gap-3 ${selectedGoals.includes(goal.id)
                                            ? 'border-blue-600 bg-blue-50'
                                            : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <span className="text-2xl">{goal.icon}</span>
                                        <span className="font-medium text-gray-900 text-left">{goal.label}</span>
                                        {selectedGoals.includes(goal.id) && (
                                            <CheckCircle className="h-5 w-5 text-blue-600 ml-auto" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Connect Integration */}
                    {step === 4 && (
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect your first integration</h2>
                            <p className="text-gray-600 mb-6">We recommend starting with Gmail</p>
                            <div className="bg-gray-50 rounded-lg p-6 mb-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="text-4xl">📧</div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900">Google (Gmail, Calendar, Drive)</h3>
                                        <p className="text-sm text-gray-600">Connect to automate emails, meetings, and files</p>
                                    </div>
                                    {connected ? (
                                        <CheckCircle className="h-6 w-6 text-green-600" />
                                    ) : (
                                        <button
                                            onClick={() => setConnected(true)}
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                                {connected && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                        <p className="text-sm text-green-700 flex items-center gap-2">
                                            <CheckCircle className="h-4 w-4" />
                                            Successfully connected to Google!
                                        </p>
                                    </div>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 text-center">
                                You can connect more integrations later in Settings
                            </p>
                        </div>
                    )}

                    {/* Step 5: Demo */}
                    {step === 5 && (
                        <div className="text-center">
                            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
                            <p className="text-gray-600 mb-6">
                                Extenda is ready to help you automate your workflows
                            </p>
                            <div className="bg-blue-50 rounded-lg p-6 text-left mb-6">
                                <h3 className="font-semibold text-gray-900 mb-3">Try your first command:</h3>
                                <ul className="space-y-2 text-sm text-gray-700">
                                    <li className="flex items-start gap-2">
                                        <span>•</span>
                                        <span>"Summarize my last 5 emails"</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span>•</span>
                                        <span>"Create a meeting for tomorrow at 2pm"</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span>•</span>
                                        <span>"What's on this page?"</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center mt-8">
                        <div className="text-sm text-gray-500">
                            Step {step} of 5
                        </div>
                        <button
                            onClick={handleNext}
                            disabled={step !== 1 && !canProceed()}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span>{step === 5 ? 'Get Started' : 'Next'}</span>
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
