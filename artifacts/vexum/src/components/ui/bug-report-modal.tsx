import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bug } from "lucide-react";
import { toast } from "sonner";

interface BugReportModalProps {
  open: boolean;
  onClose: () => void;
}

export function BugReportModal({ open, onClose }: BugReportModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);

    setTimeout(() => {
      const reports: any[] = JSON.parse(localStorage.getItem("vexum_bug_reports") || "[]");
      reports.push({
        id: `BR-${Date.now()}`,
        name: name.trim() || "Anonymous",
        email: email.trim() || null,
        message: message.trim(),
        submittedAt: new Date().toISOString(),
      });
      localStorage.setItem("vexum_bug_reports", JSON.stringify(reports));

      setName("");
      setEmail("");
      setMessage("");
      setSubmitting(false);
      onClose();
      toast.success("Bug report submitted", {
        description: "Thanks for helping improve Vexum.",
      });
    }, 600);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="w-full max-w-md bg-zinc-950 border border-zinc-800/80 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="relative p-6 border-b border-zinc-800/50">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(ellipse 80% 60% at 50% -20%, rgba(139,92,246,0.12) 0%, transparent 70%)" }} />
              <div className="relative flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <Bug className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white">Submit Bug Report</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">Help us make Vexum better</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="absolute top-5 right-5 text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1.5">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1.5">
                  Describe the issue <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  placeholder="What happened? What did you expect?"
                  rows={4}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="flex-1 relative inline-flex overflow-hidden rounded-lg p-[1.5px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                  <span className="relative w-full flex items-center justify-center rounded-[6px] bg-[#0a0a0f] py-2 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                    {submitting ? "Submitting…" : "Submit Report"}
                  </span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
