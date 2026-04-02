import { SignUp } from "@clerk/chrome-extension";
import { Terminal } from 'lucide-react';

export default function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center p-4 pt-12">
            {/* System Interactivity Check */}
            <div className="w-full max-w-md mb-6">
                <button 
                    onClick={() => {
                        console.log("✅ [Sidepanel] System Check: React is interactive!");
                        alert("React is working! If the form below is static, Clerk is blocked.");
                    }}
                    className="w-full bg-white/50 backdrop-blur-sm text-gray-600 py-3 px-4 rounded-xl text-sm font-medium hover:bg-white/80 transition-all border border-white/50 flex items-center justify-center gap-2 shadow-sm"
                >
                    <Terminal className="h-4 w-4" />
                    Run System Interactivity Check
                </button>
            </div>

            {/* Official Clerk Sign Up Component */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                <SignUp 
                    appearance={{
                        elements: {
                            rootBox: "w-full",
                            card: "shadow-none border-none",
                            headerTitle: "text-2xl font-bold text-gray-900",
                            headerSubtitle: "text-gray-600",
                            socialButtonsBlockButton: "border-gray-200 hover:bg-gray-50 transition-colors",
                            formButtonPrimary: "bg-blue-600 hover:bg-blue-700 transition-all",
                            footerActionLink: "text-blue-600 hover:text-blue-700",
                        }
                    }}
                    routing="hash"
                    fallbackRedirectUrl={chrome.runtime.getURL('/')}
                />
            </div>

            <div className="mt-8 text-center">
                <p className="text-gray-600">
                    Already have an account?{' '}
                    <button
                        onClick={() => {
                            console.log("🔄 [Sidepanel] Switching to Sign In");
                            onSwitch();
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-4"
                    >
                        Sign in instead
                    </button>
                </p>
            </div>

            <div className="mt-6 text-[10px] text-gray-400 font-mono text-center max-w-xs">
                Clerk MV3 • Redirect Mode • ID: cdbfohlcjpcmejchgkgookcoeffniggc
            </div>
        </div>
    );
}
