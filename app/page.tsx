export default function Home() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            <div className="container mx-auto px-4 py-16">
                {/* Hero Section */}
                <header className="text-center mb-16">
                    <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 text-transparent bg-clip-text mb-4">
                        WinQA
                    </h1>
                    <p className="text-xl md:text-2xl text-gray-300 mb-8">
                        Your AI Testing Playground
                    </p>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        A platform for QA professionals to practice and learn AI testing
                    </p>
                </header>

                {/* Features Grid */}
                <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                    {/* Chat Lab */}
                    <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/20">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mb-4">
                            <span className="text-2xl">💬</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Chat Lab</h2>
                        <p className="text-gray-400">
                            Test and experiment with LLM prompts in an interactive environment
                        </p>
                    </div>

                    {/* Test Cases */}
                    <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                            <span className="text-2xl">🧪</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Test Cases</h2>
                        <p className="text-gray-400">
                            Library of test scenarios designed specifically for AI systems
                        </p>
                    </div>

                    {/* Bug Log */}
                    <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-red-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-red-500/20">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center mb-4">
                            <span className="text-2xl">🐛</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Bug Log</h2>
                        <p className="text-gray-400">
                            Document AI failures and issues for tracking and analysis
                        </p>
                    </div>

                    {/* Prompt Library */}
                    <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-green-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-500/20">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mb-4">
                            <span className="text-2xl">📚</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Prompt Library</h2>
                        <p className="text-gray-400">
                            Examples of problematic vs. fixed prompts for learning
                        </p>
                    </div>

                    {/* Insights */}
                    <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center mb-4">
                            <span className="text-2xl">💡</span>
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">Insights</h2>
                        <p className="text-gray-400">
                            Learnings and improvements from testing experiences
                        </p>
                    </div>

                    {/* Coming Soon */}
                    <div className="group p-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-dashed border-white/20 flex items-center justify-center">
                        <p className="text-gray-500 text-center">
                            More features coming soon...
                        </p>
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center mt-16 text-gray-500">
                    <p>Built for QA professionals exploring AI testing</p>
                </footer>
            </div>
        </div>
    );
}
