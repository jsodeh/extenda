import React, { useState } from 'react';
import { Globe, Database, ChevronDown, Check, AlertCircle } from 'lucide-react';
import { envService, Environment, EnvironmentState } from '../lib/environment-service';

export default function EnvironmentSwitcher() {
    const [state, setState] = useState<EnvironmentState>(envService.getState());
    const [isOpen, setIsOpen] = useState(false);

    React.useEffect(() => {
        return envService.subscribe(s => setState(s));
    }, []);

    const handleSwitch = (target: Environment) => {
        if (target === state.current) {
            setIsOpen(false);
            return;
        }
        setIsOpen(false);
        envService.switchTo(target);
    };

    const isLocal = state.current === 'local';

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-xl border transition-all active:scale-95 ${
                    isLocal 
                        ? 'bg-primary/5 border-primary/20 hover:bg-primary/10' 
                        : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
                }`}
            >
                {isLocal ? (
                    <Database className="w-3.5 h-3.5 text-primary" />
                ) : (
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                )}
                
                <span className={`text-[11px] font-bold uppercase tracking-wider ${isLocal ? 'text-primary' : 'text-emerald-500'}`}>
                    {state.current}
                </span>

                {/* Reachability Pulse */}
                <div className="relative flex h-1.5 w-1.5 ml-0.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        (isLocal ? state.localReachable : state.cloudReachable) ? 'bg-emerald-400' : 'bg-destructive'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        (isLocal ? state.localReachable : state.cloudReachable) ? 'bg-emerald-500' : 'bg-destructive'
                    }`}></span>
                </div>

                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full right-0 mt-2 w-52 bg-card border border-border rounded-2xl shadow-2xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                        <div className="px-3 py-1.5 mb-1">
                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Select Environment</h4>
                        </div>
                        
                        <button
                            onClick={() => handleSwitch('local')}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${isLocal ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    <Database className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-bold text-foreground">Local API</div>
                                    <div className={`text-[9px] font-medium ${state.localReachable ? 'text-emerald-500' : 'text-destructive'}`}>
                                        {state.localReachable ? 'Online' : 'Offline'}
                                    </div>
                                </div>
                            </div>
                            {isLocal && <Check className="w-4 h-4 text-primary" />}
                        </button>

                        <button
                            onClick={() => handleSwitch('cloud')}
                            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted transition-colors group"
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-lg ${!isLocal ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                                    <Globe className="w-4 h-4" />
                                </div>
                                <div className="text-left">
                                    <div className="text-xs font-bold text-foreground">Cloud API</div>
                                    <div className={`text-[9px] font-medium ${state.cloudReachable ? 'text-emerald-500' : 'text-destructive'}`}>
                                        {state.cloudReachable ? 'Online' : 'Offline'}
                                    </div>
                                </div>
                            </div>
                            {!isLocal && <Check className="w-4 h-4 text-emerald-500" />}
                        </button>

                        {/* Switch Hint */}
                        {!isLocal && state.localReachable && (
                            <div className="mx-2 mt-2 p-2 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-2">
                                <AlertCircle className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                                <p className="text-[9px] text-primary/80 font-medium leading-tight">
                                    Local API detected! Switch for faster response & dev setup.
                                </p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
