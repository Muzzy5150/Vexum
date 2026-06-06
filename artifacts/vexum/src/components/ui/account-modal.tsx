import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, ExternalLink, Eye, EyeOff, AlertTriangle, LogOut } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button onClick={copy} className="p-1.5 rounded hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-white">
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export function AccountModal() {
  const { user, signOut, showAccountModal, setShowAccountModal } = useAuth();
  const [exportStep, setExportStep] = useState<"idle" | "warn" | "revealed">("idle");

  if (!user) return null;

  const handleExport = () => {
    if (exportStep === "idle") { setExportStep("warn"); return; }
    if (exportStep === "warn") { setExportStep("revealed"); return; }
  };

  const handleSignOut = () => {
    signOut();
    toast("Signed out");
  };

  return (
    <AnimatePresence>
      {showAccountModal && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setShowAccountModal(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-md bg-[#0e0e16] border border-zinc-800 rounded-2xl shadow-[0_0_80px_rgba(139,92,246,0.15)] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
                <span className="font-mono text-sm tracking-widest text-purple-400 uppercase">Account</span>
                <button onClick={() => setShowAccountModal(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Wallet section */}
                <div>
                  <h3 className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">Your Solana Wallet</h3>

                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
                    {/* Public key */}
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Public Key</p>
                      <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800/60">
                        <span className="font-mono text-xs text-zinc-300 flex-1 break-all leading-relaxed">
                          {user.publicKey}
                        </span>
                        <CopyButton text={user.publicKey} />
                      </div>
                    </div>

                    {/* Export private key */}
                    <div>
                      {exportStep === "idle" && (
                        <button
                          onClick={handleExport}
                          className="flex items-center gap-2 text-xs text-zinc-400 hover:text-purple-400 transition-colors"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                          Export Private Key
                        </button>
                      )}

                      {exportStep === "warn" && (
                        <div className="bg-yellow-500/8 border border-yellow-500/25 rounded-lg p-3 space-y-2">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-yellow-200/80 leading-relaxed">
                              Never share your private key. Anyone with this key has <strong>full access</strong> to your wallet.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleExport}
                              className="text-xs px-3 py-1.5 bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 rounded-lg hover:bg-yellow-500/25 transition-colors"
                            >
                              I understand, reveal key
                            </button>
                            <button
                              onClick={() => setExportStep("idle")}
                              className="text-xs px-3 py-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}

                      {exportStep === "revealed" && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Private Key (base64)
                          </p>
                          <div className="flex items-start gap-2 bg-zinc-950 rounded-lg px-3 py-2 border border-yellow-500/20">
                            <span className="font-mono text-[10px] text-yellow-300/80 flex-1 break-all leading-relaxed">
                              {user.privateKey}
                            </span>
                            <CopyButton text={user.privateKey} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Explorer link */}
                    <a
                      href={`https://explorer.solana.com/address/${user.publicKey}?cluster=devnet`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View on Solana Explorer (devnet)
                    </a>
                  </div>
                </div>

                {/* ETH address if MetaMask */}
                {user.ethAddress && (
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Linked ETH Address</p>
                    <div className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800/60">
                      <span className="font-mono text-xs text-zinc-300 flex-1 break-all">{user.ethAddress}</span>
                      <CopyButton text={user.ethAddress} />
                    </div>
                  </div>
                )}

                {/* Account section */}
                <div>
                  <h3 className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">Account</h3>
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
                    {user.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-500">Email</span>
                        <span className="text-sm text-zinc-300 font-mono">{user.email}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">Auth method</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 font-mono capitalize">
                        {user.authMethod}
                      </span>
                    </div>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-sm transition-colors border border-zinc-700/50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
