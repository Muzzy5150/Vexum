"use client";

import { useState, useId } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Github, Mail, Eye, EyeOff, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

function PhantomIcon() {
  return (
    <img src="/phantom-icon.png" className="w-[22px] h-[22px] object-contain" alt="Phantom" aria-hidden="true" />
  );
}

function MetaMaskIcon() {
  return (
    <img src="/metamask-icon.png" className="w-[22px] h-[22px] object-contain" alt="MetaMask" aria-hidden="true" />
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.736-8.859L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${380 - i * 5 * position} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${152 - i * 5 * position} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${684 - i * 5 * position} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(${139 + i * 2}, ${92 - i}, ${246 - i * 2}, ${0.12 + i * 0.01})`,
    width: 0.5 + i * 0.03,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none">
      <svg className="w-full h-full text-slate-950" viewBox="0 0 696 316" fill="none">
        <title>Background paths</title>
        {paths.map((path) => (
          <motion.path
            key={path.id}
            d={path.d}
            stroke={path.color}
            strokeWidth={path.width}
            strokeOpacity={0.9}
            initial={{ pathLength: 0.3, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: [0.2, 0.5, 0.2], pathOffset: [0, 1, 0] }}
            transition={{ duration: 20 + Math.random() * 10, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
          />
        ))}
      </svg>
    </div>
  );
}

const btnClass =
  "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-900 border border-purple-500/50 text-white text-sm font-medium transition-all hover:border-purple-400 hover:shadow-[0_0_12px_rgba(139,92,246,0.4)] focus:outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed";

type EmailStep = "email" | "password" | "success";

export function AuthPage() {
  const { signUp, connectPhantom, connectMetaMask } = useAuth();
  const [, navigate] = useLocation();

  const [emailStep, setEmailStep] = useState<EmailStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailId = useId();
  const passwordId = useId();

  const handleEmailContinue = () => {
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setEmailStep("password");
  };

  const handleCreateAccount = async () => {
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password);
      setEmailStep("success");
      setTimeout(() => navigate("/marketplace"), 1800);
    } finally {
      setLoading(false);
    }
  };

  const handlePhantom = async () => {
    setLoading(true);
    try {
      await connectPhantom();
      navigate("/marketplace");
    } finally {
      setLoading(false);
    }
  };

  const handleMetaMask = async () => {
    setLoading(true);
    try {
      await connectMetaMask();
      navigate("/marketplace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex bg-[#0a0a0f] overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 30% 50%, rgba(139,92,246,0.12) 0%, transparent 70%)" }}
      />

      <Link href="/" className="absolute top-5 left-5 z-20 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
        <ChevronLeft className="w-4 h-4" />
        Back to Home
      </Link>

      {/* Left decorative panel */}
      <div className="hidden md:flex w-1/2 relative flex-col items-center justify-center px-16 overflow-hidden">
        <FloatingPaths position={1} />
        <div className="relative z-10 flex flex-col items-center text-center gap-6">
          <img src="/vexum-wallet-logo.png" className="h-40 w-auto" alt="Vexum" />
          <p className="text-zinc-300 text-lg leading-relaxed max-w-xs">
            Autonomous agents. On-chain payments. Persistent memory. Welcome to the future of work.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-sm space-y-6">
          <div className="md:hidden text-center mb-8">
            <img src="/vexum-wallet-logo.png" className="h-16 w-auto mx-auto" alt="Vexum" />
          </div>

          {emailStep === "success" ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center space-y-4"
            >
              <div className="w-14 h-14 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center mx-auto">
                <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Account Created</h2>
                <p className="text-zinc-400 text-sm mt-1">Your Solana wallet has been generated.</p>
                <p className="text-zinc-600 text-xs mt-3">Redirecting to marketplace…</p>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-2xl font-semibold text-white">
                  {emailStep === "password" ? "Set your password" : "Welcome to Vexum"}
                </h1>
                <p className="text-zinc-400 text-sm">
                  {emailStep === "password"
                    ? `Creating account for ${email}`
                    : "Sign in or create your account"}
                </p>
              </div>

              {emailStep === "email" && (
                <>
                  <div className="space-y-3">
                    <button type="button" onClick={handlePhantom} disabled={loading} className={btnClass}>
                      <PhantomIcon />
                      Continue with Phantom
                    </button>
                    <button type="button" onClick={handleMetaMask} disabled={loading} className={btnClass}>
                      <MetaMaskIcon />
                      Continue with MetaMask
                    </button>
                    <button type="button" disabled className={btnClass}>
                      <XIcon />
                      <span className="text-zinc-500">Continue with X</span>
                      <span className="ml-auto text-[10px] text-zinc-600 font-mono">soon</span>
                    </button>
                    <button type="button" disabled className={btnClass}>
                      <Github className="w-4 h-4 text-zinc-500" />
                      <span className="text-zinc-500">Continue with GitHub</span>
                      <span className="ml-auto text-[10px] text-zinc-600 font-mono">soon</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-zinc-800" />
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">or</span>
                    <div className="flex-1 h-px bg-zinc-800" />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label htmlFor={emailId} className="block text-sm text-zinc-400 mb-1.5">Email address</label>
                      <input
                        id={emailId}
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleEmailContinue()}
                        placeholder="you@example.com"
                        className="w-full px-4 py-2.5 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/70 transition-colors"
                      />
                    </div>
                    <button type="button" onClick={handleEmailContinue} disabled={loading} className={`${btnClass} justify-center`}>
                      <Mail className="w-4 h-4" />
                      Continue with Email
                      <ArrowRight className="w-4 h-4 ml-auto" />
                    </button>
                  </div>
                </>
              )}

              {emailStep === "password" && (
                <div className="space-y-4">
                  <div>
                    <label htmlFor={passwordId} className="block text-sm text-zinc-400 mb-1.5">Password</label>
                    <div className="relative">
                      <input
                        id={passwordId}
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateAccount()}
                        placeholder="At least 6 characters"
                        autoFocus
                        className="w-full px-4 py-2.5 pr-10 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/70 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateAccount}
                    disabled={loading}
                    className="w-full relative inline-flex overflow-hidden rounded-lg p-[1.5px] disabled:opacity-50"
                  >
                    <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                    <span className="relative w-full flex items-center justify-center gap-2 rounded-lg bg-[#0a0a0f] px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                      {loading ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : null}
                      Create Account
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEmailStep("email")}
                    className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors py-1"
                  >
                    ← Back
                  </button>
                </div>
              )}
            </>
          )}

          <p className="text-center text-xs text-zinc-600">
            By continuing, you agree to Vexum's Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}
