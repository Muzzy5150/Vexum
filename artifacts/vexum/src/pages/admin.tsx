import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Briefcase, Bug, RefreshCw, Shield, Lock, Eye, EyeOff, LogOut } from "lucide-react";

const ADMIN_PASSWORD = import.meta.env.VITE_VEXUM_ADMIN_PASSWORD ?? "";
const SESSION_KEY = "vexum_admin_authed";

interface AccountRecord {
  email?: string;
  publicKey: string;
  authMethod: string;
  createdAt: string;
}

interface JobRecord {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  agentName: string;
  submittedAt: string;
}

interface BugReport {
  id: string;
  name: string;
  email?: string;
  message: string;
  submittedAt: string;
}

function timeAgo(iso: string) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch {
    return "—";
  }
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "1");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [bugReports, setBugReports] = useState<BugReport[]>([]);
  const [activeTab, setActiveTab] = useState<"accounts" | "jobs" | "bugs">("accounts");
  const [refreshKey, setRefreshKey] = useState(0);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (ADMIN_PASSWORD && password === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
      setPassword("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setAuthed(false);
    setPassword("");
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center">
        <div className="pointer-events-none fixed inset-0 z-0"
          style={{ background: "radial-gradient(ellipse 60% 40% at 50% 30%, rgba(120,60,220,0.15) 0%, transparent 70%)" }} />
        <AnimatePresence>
          <motion.div
            key="gate"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="relative z-10 w-full max-w-sm mx-4"
          >
            <div className="bg-zinc-950/90 border border-zinc-800/70 rounded-2xl p-8 backdrop-blur-xl shadow-2xl">
              <div className="flex flex-col items-center mb-8">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center mb-4">
                  <Lock className="w-5 h-5 text-purple-400" />
                </div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                  Admin Access
                </h1>
                <p className="text-zinc-500 text-xs mt-1 font-mono">vexum internal panel</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <input
                    ref={inputRef}
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setPwError(false); }}
                    placeholder="Password"
                    autoFocus
                    className={`w-full bg-zinc-900/80 border ${pwError ? "border-red-500/60" : "border-zinc-700/60"} rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-purple-500/60 transition-colors pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <AnimatePresence>
                  {pwError && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-red-400 text-xs font-mono text-center"
                    >
                      Incorrect password
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  className="w-full relative inline-flex overflow-hidden rounded-xl p-[1.5px] focus:outline-none"
                >
                  <span className="absolute inset-[-1000%] animate-spin [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#7C3AED_0%,#EC4899_50%,#7C3AED_100%)]" style={{ animationDuration: "3s" }} />
                  <span className="relative w-full flex items-center justify-center gap-2 rounded-[10px] bg-zinc-950 px-4 py-3 text-sm font-medium text-white hover:bg-zinc-900 transition-colors">
                    <Shield className="w-4 h-4 text-purple-400" />
                    Enter
                  </span>
                </button>
              </form>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  useEffect(() => {
    const accountsList: AccountRecord[] = [];

    const single = localStorage.getItem("vexum_account");
    if (single) {
      try {
        const parsed = JSON.parse(single);
        accountsList.push({
          email: parsed.email,
          publicKey: parsed.publicKey,
          authMethod: "email",
          createdAt: parsed.createdAt || new Date().toISOString(),
        });
      } catch {}
    }

    const multi = localStorage.getItem("vexum_accounts");
    if (multi) {
      try {
        const parsed: AccountRecord[] = JSON.parse(multi);
        for (const acc of parsed) {
          if (!accountsList.find(a => a.publicKey === acc.publicKey)) {
            accountsList.push(acc);
          }
        }
      } catch {}
    }

    const wallet = localStorage.getItem("vexum_wallet");
    if (wallet) {
      try {
        const parsed = JSON.parse(wallet);
        if (parsed.publicKey && !accountsList.find(a => a.publicKey === parsed.publicKey)) {
          accountsList.push({
            email: parsed.email,
            publicKey: parsed.publicKey,
            authMethod: parsed.authMethod || "unknown",
            createdAt: new Date().toISOString(),
          });
        }
      } catch {}
    }

    setAccounts(accountsList);

    try {
      const jobsRaw = localStorage.getItem("vexum_jobs");
      setJobs(jobsRaw ? JSON.parse(jobsRaw) : []);
    } catch {
      setJobs([]);
    }

    try {
      const bugsRaw = localStorage.getItem("vexum_bug_reports");
      setBugReports(bugsRaw ? JSON.parse(bugsRaw) : []);
    } catch {
      setBugReports([]);
    }
  }, [refreshKey]);

  const tabs = [
    { id: "accounts" as const, label: "Accounts", icon: Users, count: accounts.length },
    { id: "jobs" as const, label: "Jobs", icon: Briefcase, count: jobs.length },
    { id: "bugs" as const, label: "Bug Reports", icon: Bug, count: bugReports.length },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white pt-16">
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-[300px] z-0"
        style={{ background: "radial-gradient(ellipse 50% 30% at 50% -10%, rgba(120,60,220,0.12) 0%, transparent 70%)" }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
                Vexum Admin
              </h1>
              <p className="text-zinc-500 text-xs font-mono">Internal panel — keep this URL private</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-sm text-zinc-400 hover:text-white hover:border-zinc-600 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700/60 text-sm text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Lock
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {tabs.map(tab => (
            <div key={tab.id} className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 flex items-center gap-3">
              <tab.icon className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <div>
                <p className="text-2xl font-bold font-mono">{tab.count}</p>
                <p className="text-xs text-zinc-500">{tab.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mb-6 bg-zinc-900/40 border border-zinc-800/40 rounded-xl p-1 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-mono">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "accounts" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {accounts.length === 0 ? (
              <Empty label="No accounts yet" icon={Users} />
            ) : (
              <div className="space-y-4">
                {accounts.map((acc, i) => {
                  const userJobs = jobs.filter(j => j.submittedBy === acc.publicKey);
                  return (
                    <div key={i} className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 flex flex-wrap items-center gap-4 border-b border-zinc-800/40 bg-black/20">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white truncate">
                              {acc.email || <span className="text-zinc-500 italic">No email</span>}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-[10px] font-mono uppercase flex-shrink-0">
                              {acc.authMethod}
                            </span>
                          </div>
                          <p className="font-mono text-xs text-purple-400 mt-0.5">
                            {acc.publicKey.slice(0, 10)}…{acc.publicKey.slice(-8)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-mono text-zinc-500 flex-shrink-0">
                          <span>Joined {timeAgo(acc.createdAt)}</span>
                          <span className="px-2 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            {userJobs.length} job{userJobs.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      {userJobs.length === 0 ? (
                        <div className="px-5 py-4 text-xs text-zinc-600 font-mono italic">No jobs submitted yet</div>
                      ) : (
                        <div className="divide-y divide-zinc-800/30">
                          {userJobs.map((job, ji) => (
                            <div key={ji} className="px-5 py-3 flex items-center gap-4 hover:bg-zinc-800/20 transition-colors">
                              <span className="font-mono text-[10px] text-purple-400 flex-shrink-0">{job.id}</span>
                              <p className="text-sm text-zinc-300 flex-1 truncate">{job.description}</p>
                              <span className="text-xs text-zinc-500 flex-shrink-0">{job.agentName}</span>
                              <span className="font-mono text-[10px] text-zinc-600 flex-shrink-0">{timeAgo(job.submittedAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "jobs" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {jobs.length === 0 ? (
              <Empty label="No jobs submitted yet" icon={Briefcase} />
            ) : (
              <div className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-black/40 font-mono text-xs text-zinc-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 text-left font-normal">Job ID</th>
                      <th className="px-5 py-3 text-left font-normal">Description</th>
                      <th className="px-5 py-3 text-left font-normal">Agent</th>
                      <th className="px-5 py-3 text-left font-normal">Submitted By</th>
                      <th className="px-5 py-3 text-left font-normal">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {[...jobs].reverse().map((job, i) => (
                      <tr key={i} className="hover:bg-zinc-800/20 transition-colors">
                        <td className="px-5 py-3 font-mono text-purple-400 text-xs">{job.id}</td>
                        <td className="px-5 py-3 text-zinc-300 max-w-[240px] truncate">{job.description}</td>
                        <td className="px-5 py-3 text-zinc-400">{job.agentName}</td>
                        <td className="px-5 py-3 font-mono text-xs text-zinc-500">
                          {job.submittedBy ? `${job.submittedBy.slice(0, 6)}…${job.submittedBy.slice(-4)}` : "—"}
                        </td>
                        <td className="px-5 py-3 text-zinc-500 font-mono text-xs">{timeAgo(job.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "bugs" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {bugReports.length === 0 ? (
              <Empty label="No bug reports yet" icon={Bug} />
            ) : (
              <div className="space-y-3">
                {[...bugReports].reverse().map((report, i) => (
                  <div key={i} className="bg-zinc-950/80 border border-zinc-800/60 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-purple-400">{report.id}</span>
                        <span className="font-medium text-white text-sm">{report.name}</span>
                        {report.email && (
                          <span className="text-zinc-500 text-xs">· {report.email}</span>
                        )}
                      </div>
                      <span className="text-zinc-500 font-mono text-xs flex-shrink-0">{timeAgo(report.submittedAt)}</span>
                    </div>
                    <p className="text-zinc-300 text-sm leading-relaxed">{report.message}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Empty({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon className="w-8 h-8 text-zinc-700 mb-3" />
      <p className="text-zinc-500 text-sm">{label}</p>
    </div>
  );
}
