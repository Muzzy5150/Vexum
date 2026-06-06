import { useParams, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Terminal } from "lucide-react";
import { jobs, agents, type Job } from "@/lib/data";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Footer } from "@/components/ui/footer";

type StoredJob = Partial<Job> & {
  id: string;
  description: string;
  agentName?: string;
  submittedAt?: string;
  submittedBy?: string;
};

function loadStoredJobs(): Job[] {
  try {
    const raw = localStorage.getItem("vexum_jobs");
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((job): job is StoredJob => (
        typeof job?.id === "string" && typeof job?.description === "string"
      ))
      .map((job) => {
        const agent = agents.find(a => a.name === job.agentName)
          ?? agents.find(a => a.id === job.orchestratorId)
          ?? agents[0];

        return {
          id: job.id,
          title: job.title ?? "Custom User Task",
          description: job.description,
          orchestratorId: job.orchestratorId ?? agent.id,
          agentPipeline: job.agentPipeline ?? [{ agentId: agent.id, role: "orchestrator" as const }],
          status: job.status ?? "complete",
          solCost: job.solCost ?? 0.1,
          settled: job.settled ?? false,
          steps: job.steps ?? [
            {
              timestamp: job.submittedAt
                ? new Date(job.submittedAt).toLocaleTimeString()
                : new Date().toLocaleTimeString(),
              message: "Job submitted by user",
              agentId: agent.id,
            },
            {
              timestamp: job.submittedAt
                ? new Date(job.submittedAt).toLocaleTimeString()
                : new Date().toLocaleTimeString(),
              message: "Task completed successfully",
              agentId: agent.id,
            },
          ],
          finalOutput: job.finalOutput,
          previewUrl: job.previewUrl,
        };
      });
  } catch {
    return [];
  }
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const job = loadStoredJobs().find(j => j.id === id) ?? jobs.find(j => j.id === id);

  if (!job) {
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center bg-[#0a0a0f] text-white">
        <div className="text-center">
          <h1 className="text-2xl mb-4">Job not found</h1>
          <Link href="/marketplace" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Marketplace
          </Link>
        </div>
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
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-purple-400 text-lg">#{job.id}</span>
              <h1 className="text-3xl font-bold">{job.title}</h1>
            </div>
            <p className="text-zinc-400 max-w-2xl leading-relaxed">{job.description}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className={`px-3 py-1 rounded text-xs uppercase font-mono tracking-wider ${
              job.status === 'complete' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
              job.status === 'verifying' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' : 
              'bg-purple-500/10 text-purple-400 border border-purple-500/20'
            }`}>
              {job.status}
            </span>
            <div className="text-right">
              <div className="font-mono text-2xl text-yellow-400">{job.solCost} SOL</div>
              <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest mt-1">
                {job.settled ? "Settled on-chain" : "Pending settlement"}
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Visualization */}
        <div className="mb-12">
          <h2 className="font-mono text-sm tracking-widest text-zinc-400 mb-6">AGENT PIPELINE</h2>
          <div className="flex flex-col md:flex-row items-center gap-4 bg-zinc-900/30 border border-zinc-800/50 rounded-2xl p-8 overflow-x-auto">
            {job.agentPipeline.map((node, i) => {
              const agent = agents.find(a => a.id === node.agentId);
              if (!agent) return null;
              
              return (
                <div key={i} className="flex items-center shrink-0">
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 w-64 flex flex-col items-center text-center">
                    <div className="mb-3">
                      <AgentAvatar agentId={agent.id} size={64} />
                    </div>
                    <h3 className="font-semibold mb-1">{agent.name}</h3>
                    <div className="text-xs text-zinc-400 font-mono uppercase tracking-wider mb-3">{node.role}</div>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] uppercase font-mono tracking-wider border border-purple-500/20">
                      {agent.specialty}
                    </span>
                  </div>
                  {i < job.agentPipeline.length - 1 && (
                    <div className="px-4 text-purple-500/50 hidden md:block">
                      <ArrowRight className="w-6 h-6" />
                    </div>
                  )}
                  {i < job.agentPipeline.length - 1 && (
                    <div className="py-4 text-purple-500/50 md:hidden">
                      <ArrowRight className="w-6 h-6 rotate-90" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Execution Log */}
          <div>
            <h2 className="font-mono text-sm tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> EXECUTION LOG
            </h2>
            <div className="bg-[#050505] border border-zinc-800 rounded-xl p-5 font-mono text-sm h-[400px] overflow-y-auto">
              {job.steps.map((step, i) => (
                <div key={i} className="mb-3 flex gap-3">
                  <span className="text-zinc-600 shrink-0">[{step.timestamp}]</span>
                  <span className={`${step.message.includes('flagged') || step.message.includes('critical') ? 'text-red-400' : step.message.includes('complete') || step.message.includes('accepted') ? 'text-green-400' : 'text-zinc-300'}`}>
                    {step.message}
                  </span>
                </div>
              ))}
              {job.status !== 'complete' && (
                <div className="flex gap-3 animate-pulse">
                  <span className="text-zinc-600">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                  <span className="text-purple-400">Processing...</span>
                </div>
              )}
            </div>
          </div>

          {/* Output */}
          <div className="flex flex-col">
            <h2 className="font-mono text-sm tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> FINAL OUTPUT
            </h2>
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 flex-1 flex flex-col">
              {job.finalOutput ? (
                <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {job.finalOutput}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500 font-mono border-2 border-dashed border-zinc-800 rounded-lg">
                  Output pending...
                </div>
              )}
              {job.previewUrl && (
                <a
                  href={job.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-fit items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  Open HyperFrames Preview
                </a>
              )}
            </div>
          </div>
        </div>

      </div>
      <Footer />
    </motion.div>
  );
}
