import { SignUpButton, Show } from "@clerk/chrome-extension";

export default function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h1>
                    <p className="text-gray-600">Get started with Extenda</p>
                </div>

                <div className="space-y-4">
                    <Show when="signed-out">
                        <SignUpButton mode="modal">
                            <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 flex items-center justify-center gap-3 shadow-sm hover:shadow-md">
                                Start Your Journey
                            </button>
                        </SignUpButton>
                    </Show>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-gray-600">
                        Already have an account?{' '}
                        <button
                            onClick={onSwitch}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                            Sign in
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
