import { useState } from 'react';
import { ChevronRight, CheckCircle, Rocket, Target, Zap, Settings, CheckCircle2 } from 'lucide-react';
import iconLight from '../assets/icon-light.png';
import iconDark from '../assets/icon-dark.png';

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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-xs mx-3 overflow-hidden border border-border animate-in zoom-in-95 duration-200">
                {/* Progress Bar */}
                <div className="h-1 bg-muted">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${(step / 5) * 100}%` }}
                    />
                </div>

                <div className="p-6">
                    {/* Step 1: Welcome */}
                    {step === 1 && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center mb-6">
                                {/* Corrected Logo Logic */}
                                <img src={iconDark} alt="Extenda" className="h-16 w-16 dark:hidden drop-shadow-sm" />
                                <img src={iconLight} alt="Extenda" className="h-16 w-16 hidden dark:block drop-shadow-sm" />
                            </div>
                             <h2 className="text-xl font-bold text-foreground mb-1 tracking-tight">Welcome to Extenda!</h2>
                            <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                                Your AI assistant that automates workflows across all your tools.
                            </p>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: <Zap className="h-4 w-4 text-primary mx-auto mb-1" />, title: 'Smart AI', desc: 'Auto work' },
                                    { icon: <Settings className="h-4 w-4 text-primary mx-auto mb-1" />, title: '14 Apps', desc: '200+ tools' },
                                    { icon: <Target className="h-4 w-4 text-primary mx-auto mb-1" />, title: 'Personal', desc: 'Custom goals' },
                                ].map((item) => (
                                    <div key={item.title} className="p-2.5 bg-muted/40 rounded-xl text-center border border-border/50 transition-all hover:bg-muted/60">
                                        {item.icon}
                                        <p className="text-[10px] font-bold text-foreground truncate">{item.title}</p>
                                        <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 2: Business Type */}
                    {step === 2 && (
                        <div>
                            <h2 className="text-lg font-bold text-foreground mb-1">Who are you?</h2>
                            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Choose the profile that fits best.</p>
                            <div className="grid grid-cols-2 gap-2">
                                {BUSINESS_TYPES.map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setBusinessType(type)}
                                        className={`py-3 px-3 rounded-xl border-2 text-xs font-bold transition-all text-center ${businessType === type
                                            ? 'border-primary bg-primary/10 text-primary shadow-md shadow-primary/10'
                                            : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
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
                            <h2 className="text-lg font-bold text-foreground mb-1">Your Focus?</h2>
                            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Select your primary tasks.</p>
                            <div className="grid grid-cols-2 gap-2">
                                {GOALS.map((goal) => (
                                    <button
                                        key={goal.id}
                                        onClick={() => handleGoalToggle(goal.id)}
                                        className={`py-3 px-3 rounded-xl border-2 text-xs font-bold flex items-center gap-2 transition-all ${selectedGoals.includes(goal.id)
                                            ? 'border-primary bg-primary/10 text-primary shadow-md shadow-primary/10'
                                            : 'border-border text-muted-foreground hover:border-primary/30 hover:bg-muted/50'
                                        }`}
                                    >
                                        <span className="text-base">{goal.icon}</span>
                                        <span className="truncate">{goal.label}</span>
                                        {selectedGoals.includes(goal.id) && (
                                            <CheckCircle2 className="h-3 w-3 text-primary ml-auto shrink-0" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Connect */}
                    {step === 4 && (
                        <div>
                            <h2 className="text-lg font-bold text-foreground mb-1">Connect Tools</h2>
                            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Start with an integration.</p>
                            <div className="bg-muted/30 rounded-xl p-4 border border-border">
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl shrink-0">📧</span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-foreground truncate">Google Workspace</p>
                                        <p className="text-[10px] text-muted-foreground truncate">Gmail, Calendar, Drive</p>
                                    </div>
                                    {connected ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                                    ) : (
                                        <button
                                            onClick={() => setConnected(true)}
                                            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-lg shadow-primary/20"
                                        >
                                            Connect
                                        </button>
                                    )}
                                </div>
                                {connected && (
                                    <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                                        <p className="text-[10px] text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                                            <CheckCircle2 className="h-3 w-3" /> Successfully Connected!
                                        </p>
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground text-center mt-4">
                                More available in Settings
                            </p>
                        </div>
                    )}

                    {/* Step 5: Done */}
                    {step === 5 && (
                        <div className="text-center">
                            <div className="inline-flex items-center justify-center mb-6">
                                <img src={iconDark} alt="Extenda" className="h-12 w-12 dark:hidden drop-shadow-sm" />
                                <img src={iconLight} alt="Extenda" className="h-12 w-12 hidden dark:block drop-shadow-sm" />
                            </div>
                            <h2 className="text-lg font-bold text-foreground mb-1">Ready to go!</h2>
                            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">Try your first command:</p>
                            <div className="bg-muted/40 rounded-xl p-4 border border-border text-left space-y-2.5">
                                {[
                                    '"Summarize my last 5 emails"',
                                    '"Check my calendar for tomorrow"',
                                    '"What is on this page?"'
                                ].map((cmd) => (
                                    <p key={cmd} className="text-[10px] font-medium text-foreground/80 flex items-start gap-2 leading-tight">
                                        <Zap className="h-3 w-3 text-primary shrink-0 mt-0.5" /> {cmd}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between items-center mt-6">
                        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Step {step} / 5</span>
                        <button
                            onClick={handleNext}
                            disabled={step !== 1 && !canProceed()}
                            className="flex items-center gap-1.5 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-black shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-40 disabled:scale-100 transition-all active:scale-95 uppercase tracking-tighter"
                        >
                            {step === 5 ? 'Get Started' : 'Next'}
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
