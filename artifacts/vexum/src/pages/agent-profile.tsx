import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { Shield, Clock, Brain, ExternalLink, ArrowLeft, Wallet } from "lucide-react";
import { agents } from "@/lib/data";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Footer } from "@/components/ui/footer";

export default function AgentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const agent = agents.find(a => a.id === id);

  if (!agent) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center bg-[#0a0a0f] text-white">
        <h1 className="text-2xl">Agent not found</h1>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="min-h-screen pt-16 bg-[#0a0a0f] text-white pb-20">
      <div className="max-w-5xl mx-auto px-6 pt-10">
        
        <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Marketplace
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
          <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
            <AgentAvatar agentId={agent.id} size={120} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <h1 className="text-4xl font-bold">{agent.name}</h1>
              <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs uppercase font-mono tracking-wider border border-purple-500/20">
                {agent.specialty}
              </span>
            </div>
            <div className="flex items-center gap-6 mb-6">
              <div className="flex items-center gap-2 text-zinc-300">
                <Shield className="w-5 h-5 text-purple-400" />
                <span className="font-mono text-lg">{agent.reputation}</span>
                <span className="text-xs text-zinc-500 uppercase tracking-widest">Reputation</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <span className={`w-2.5 h-2.5 rounded-full ${agent.status === 'idle' ? 'bg-green-400' : agent.status === 'working' ? 'bg-yellow-400' : 'bg-red-400'}`} />
                <span className="text-sm capitalize">{agent.status}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-black/40 border border-zinc-800 rounded-lg w-fit">
              <span className="text-xs text-zinc-500 font-mono tracking-widest uppercase">Wallet</span>
              <span className="font-mono text-sm text-zinc-300">{agent.walletAddress}</span>
              <a href={`https://explorer.solana.com/address/${agent.walletAddress}?cluster=devnet`} target="_blank" rel="noreferrer" className="text-zinc-500 hover:text-white transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: "Jobs Completed", value: agent.jobsCompleted },
            { label: "SOL Earned", value: `${agent.solEarned} SOL`, color: "text-yellow-400" },
            { label: "Avg Task Time", value: agent.avgTaskTime },
            { label: "Success Rate", value: `${agent.successRate}%`, color: "text-green-400" }
          ].map((stat, i) => (
            <div key={i} className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 backdrop-blur-sm">
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-2xl font-mono ${stat.color || "text-white"}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Memory Feed */}
          <div>
            <h2 className="font-mono text-sm tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Brain className="w-4 h-4" /> RECENT MEMORIES
            </h2>
            <div className="space-y-4">
              {agent.memories.map(mem => (
                <div key={mem.id} className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4">
                  <p className="text-sm text-zinc-300 mb-3 leading-relaxed">{mem.text}</p>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono">
                    <Clock className="w-3 h-3" /> {mem.timestamp}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction History */}
          <div>
            <h2 className="font-mono text-sm tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Wallet className="w-4 h-4" /> TRANSACTION HISTORY
            </h2>
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-black/40 font-mono text-xs text-zinc-500 uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-normal">Hash</th>
                    <th className="px-4 py-3 text-right font-normal">Amount</th>
                    <th className="px-4 py-3 text-center font-normal">Type</th>
                    <th className="px-4 py-3 text-left font-normal">To/From</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {agent.transactions.map((tx, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-purple-400">
                        <a href={`https://solana.fm/tx/${tx.hash}?cluster=devnet`} target="_blank" rel="noreferrer" className="hover:underline">
                          {tx.hash.slice(0, 8)}...
                        </a>
                      </td>
                      <td className={`px-4 py-3 font-mono text-right ${tx.direction === 'in' ? 'text-green-400' : 'text-zinc-300'}`}>
                        {tx.direction === 'in' ? '+' : '-'}{tx.amount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${tx.direction === 'in' ? 'bg-green-500/10 text-green-400' : 'bg-zinc-500/10 text-zinc-400'}`}>
                          {tx.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{tx.counterparty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
      <Footer />
    </motion.div>
  );
}
