import { useAuth } from '../contexts/auth-context';
import { ArrowLeft, LogOut, User, Mail, ShieldCheck, MailCheck } from 'lucide-react';

interface ProfilePageProps {
    onBack: () => void;
}

export default function ProfilePage({ onBack }: ProfilePageProps) {
    const { user, signOut } = useAuth();

    return (
        <div className="flex flex-col h-full bg-background animate-in slide-in-from-right duration-300">
            {/* Minimal Header (Used within SettingsPage context or here) */}
            
            <div className="p-6 space-y-8">
                {/* Profile Header Card */}
                <div className="relative overflow-hidden p-6 rounded-3xl bg-card border border-border shadow-xl">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <User className="w-32 h-32" />
                    </div>
                    
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-4 border-background shadow-lg">
                            {user?.imageUrl ? (
                                <img src={user.imageUrl} alt="Profile" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <User className="w-10 h-10 text-primary" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground">
                                {user?.name || (user?.firstName ? `${user.firstName} ${user.lastName || ''}` : 'Extenda User')}
                            </h2>
                            <div className="flex items-center justify-center gap-1.5 mt-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Active Session</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Account Details */}
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Account Information</h3>
                    
                    <div className="space-y-2">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
                            <div className="p-2 rounded-lg bg-background shadow-sm">
                                <Mail className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Email Address</p>
                                <p className="text-sm font-medium text-foreground truncate">{user?.primaryEmailAddress?.emailAddress || user?.email}</p>
                            </div>
                            <MailCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                        </div>

                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/50">
                            <div className="p-2 rounded-lg bg-background shadow-sm">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Access Level</p>
                                <p className="text-sm font-medium text-foreground">Standard Plus</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="pt-6">
                    <button
                        onClick={() => signOut()}
                        className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl border-2 border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 active:scale-95 transition-all group"
                    >
                        <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-bold text-sm tracking-wide">Sign Out of Extenda</span>
                    </button>
                    <p className="text-[10px] text-center text-muted-foreground mt-4 leading-relaxed">
                        Security Notice: Signing out will clear your local session but keep your synced preferences in the encrypted database.
                    </p>
                </div>
            </div>
        </div>
    );
}
