import { Link } from "wouter";
import { useAuth } from "@/context/auth-context";

export function Nav() {
  const { user, setShowAccountModal } = useAuth();

  return (
    <nav className="fixed top-0 z-50 w-full bg-black/60 backdrop-blur-md border-b border-zinc-800/50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <img src="/vexum-logo.png" alt="Vexum" className="h-10 w-auto" />
        </Link>
        <div className="flex items-center gap-5">
          <Link href="/marketplace" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Marketplace
          </Link>

          {user ? (
            <button
              onClick={() => setShowAccountModal(true)}
              className="relative inline-flex overflow-hidden rounded-full p-[1.5px]"
            >
              <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
              <span className="relative flex items-center justify-center gap-2 rounded-full bg-[#0a0a0f] px-5 py-1.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" />
                Account
              </span>
            </button>
          ) : (
            <Link href="/auth" className="relative inline-flex overflow-hidden rounded-full p-[1.5px]">
              <span className="absolute inset-[-1000%] animate-[spin_2s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
              <span className="relative flex items-center justify-center rounded-full bg-[#0a0a0f] px-6 py-1.5 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                Start
              </span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
