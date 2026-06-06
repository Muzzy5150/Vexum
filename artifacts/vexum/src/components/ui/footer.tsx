import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { BugReportModal } from "@/components/ui/bug-report-modal";

const XIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export function Footer() {
  const [showBugReport, setShowBugReport] = useState(false);

  return (
    <>
      <footer className="bg-[#0a0a0f] border-t border-zinc-800/50 text-white relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] rounded-full blur-[80px] opacity-20"
            style={{ background: "radial-gradient(ellipse, rgba(139,92,246,0.6) 0%, rgba(236,72,153,0.3) 50%, transparent 80%)" }}
          />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">
          <div className="flex flex-col items-center gap-10">

            <div className="flex flex-col items-center gap-2">
              <img
                src="/vexum-icon.png"
                alt="Vexum"
                className="h-28 w-auto"
              />
              <p className="text-zinc-500 text-sm text-center max-w-xs leading-relaxed">
                The autonomous agent economy. Powered by Solana.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3">
              {/* Row 1 — social */}
              <div className="flex justify-center gap-3">
                <motion.a
                  href="https://x.com/VexumAgents"
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative inline-flex overflow-hidden rounded-full p-[1.5px]"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <span className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0a0f] px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                    <XIcon />
                    Follow on X
                  </span>
                </motion.a>

                <motion.a
                  href=""
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative inline-flex overflow-hidden rounded-full p-[1.5px]"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <span className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0a0f] px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                    <GitHubIcon />
                    GitHub
                  </span>
                </motion.a>
              </div>

              {/* Row 2 — support */}
              <div className="flex justify-center gap-3">
                <motion.button
                  onClick={() => setShowBugReport(true)}
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative inline-flex overflow-hidden rounded-full p-[1.5px]"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <span className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0a0f] px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                    Bug Report
                  </span>
                </motion.button>

                <motion.div
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative inline-flex overflow-hidden rounded-full p-[1.5px]"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <Link
                    href="/docs"
                    className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0a0f] px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors"
                  >
                    Docs
                  </Link>
                </motion.div>

                <motion.div
                  whileHover={{ y: -2, scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="relative inline-flex overflow-hidden rounded-full p-[1.5px]"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <Link
                    href="/privacy"
                    className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0a0f] px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors"
                  >
                    Privacy
                  </Link>
                </motion.div>
              </div>
            </div>

            <div className="border-t border-zinc-800/50 w-full pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-600 font-mono">
              <span>© {new Date().getFullYear()} Vexum. All rights reserved.</span>
              <span>Built on Solana Devnet</span>
            </div>
          </div>
        </div>
      </footer>

      <BugReportModal open={showBugReport} onClose={() => setShowBugReport(false)} />
    </>
  );
}
