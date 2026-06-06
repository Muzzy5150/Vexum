import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Circle,
  CircleAlert,
  CircleDotDashed,
  CircleX,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Job {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in-progress" | "complete" | "verifying";
  finalOutput?: string;
  steps?: { timestamp: string; message: string }[];
  solCost: number;
  [key: string]: any;
}

interface Subtask {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "failed" | "need-help";
  tools: string[];
}

interface PlanTask {
  id: string;
  title: string;
  status: "pending" | "in-progress" | "completed" | "failed" | "need-help";
  subtasks: Subtask[];
}

interface AgentPlanProps {
  taskDesc: string;
  agentName: string;
  onClose: () => void;
  job?: Job;
}

function generatePlan(taskDesc: string, agentName: string): PlanTask[] {
  const slug = (taskDesc || "task").slice(0, 30);
  return [
    {
      id: "1",
      title: "Analyse & decompose task",
      status: "pending",
      subtasks: [
        { id: "1.1", title: "Parse intent from prompt", status: "pending", tools: ["nlp-parser"] },
        { id: "1.2", title: `Identify required capabilities for "${slug}…"`, status: "pending", tools: ["capability-mapper"] },
        { id: "1.3", title: "Estimate SOL budget", status: "pending", tools: ["cost-estimator"] },
      ],
    },
    {
      id: "2",
      title: `${agentName} selects subagents`,
      status: "pending",
      subtasks: [
        { id: "2.1", title: "Query agent registry", status: "pending", tools: ["agent-registry"] },
        { id: "2.2", title: "Score agents by reputation & cost", status: "pending", tools: ["ranking-engine"] },
        { id: "2.3", title: "Draft hire contracts on-chain", status: "pending", tools: ["solana-rpc", "smart-contract"] },
      ],
    },
    {
      id: "3",
      title: "Execute pipeline",
      status: "pending",
      subtasks: [
        { id: "3.1", title: "Dispatch subtasks to hired agents", status: "pending", tools: ["task-router"] },
        { id: "3.2", title: "Monitor agent outputs in real-time", status: "pending", tools: ["output-monitor", "browser"] },
        { id: "3.3", title: "Handle inter-agent payments", status: "pending", tools: ["solana-rpc"] },
      ],
    },
    {
      id: "4",
      title: "Verify & deliver",
      status: "pending",
      subtasks: [
        { id: "4.1", title: "Cross-validate outputs", status: "pending", tools: ["verifier-agent"] },
        { id: "4.2", title: "Compile final deliverable", status: "pending", tools: ["file-system", "markdown-processor"] },
        { id: "4.3", title: "Settle remaining balances", status: "pending", tools: ["solana-rpc"] },
      ],
    },
  ];
}

const STEP_SCHEDULE = [
  { taskIdx: 0, subIdx: 0, delay: 800 },
  { taskIdx: 0, subIdx: 1, delay: 2400 },
  { taskIdx: 0, subIdx: 2, delay: 4000 },
  { taskIdx: 0, done: true,  delay: 5200 },
  { taskIdx: 1, subIdx: 0, delay: 6000 },
  { taskIdx: 1, subIdx: 1, delay: 7600 },
  { taskIdx: 1, subIdx: 2, delay: 9200 },
  { taskIdx: 1, done: true,  delay: 10400 },
  { taskIdx: 2, subIdx: 0, delay: 11200 },
  { taskIdx: 2, subIdx: 1, delay: 13200 },
  { taskIdx: 2, subIdx: 2, delay: 14800 },
  { taskIdx: 2, done: true,  delay: 16000 },
  { taskIdx: 3, subIdx: 0, delay: 16800 },
  { taskIdx: 3, subIdx: 1, delay: 18400 },
  { taskIdx: 3, subIdx: 2, delay: 20000 },
  { taskIdx: 3, done: true,  delay: 21200 },
] as const;

const StatusIcon = ({ status, size = "h-4 w-4" }: { status: string; size?: string }) => {
  if (status === "completed") return <CheckCircle2 className={`${size} text-green-400`} />;
  if (status === "in-progress") return <CircleDotDashed className={`${size} text-purple-400 animate-spin`} style={{ animationDuration: "2s" }} />;
  if (status === "need-help") return <CircleAlert className={`${size} text-yellow-400`} />;
  if (status === "failed") return <CircleX className={`${size} text-red-400`} />;
  return <Circle className={`${size} text-zinc-600`} />;
};

const statusBadge: Record<string, string> = {
  pending:     "bg-zinc-800 text-zinc-400 border border-zinc-700",
  "in-progress": "bg-purple-500/15 text-purple-300 border border-purple-500/30",
  completed:   "bg-green-500/15 text-green-300 border border-green-500/30",
  failed:      "bg-red-500/15 text-red-300 border border-red-500/30",
  "need-help": "bg-yellow-500/15 text-yellow-300 border border-yellow-500/30",
};

interface AgentPlanProps {
  taskDesc: string;
  agentName: string;
  onClose: () => void;
  job?: Job;
}

export default function AgentPlan({ taskDesc, agentName, onClose, job }: AgentPlanProps) {
  const [tasks, setTasks] = useState<PlanTask[]>(() => generatePlan(taskDesc, agentName));
  const [expanded, setExpanded] = useState<string[]>(["1"]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    STEP_SCHEDULE.forEach((step) => {
      timers.push(
        setTimeout(() => {
          setTasks(prev => {
            const next = prev.map((t, ti) => {
              if (ti !== step.taskIdx) return t;
              if ("done" in step && step.done) {
                return { ...t, status: "completed" as const };
              }
              const subIdx = "subIdx" in step ? step.subIdx : -1;
              return {
                ...t,
                status: "in-progress" as const,
                subtasks: t.subtasks.map((s, si) => {
                  if (si < subIdx) return { ...s, status: "completed" as const };
                  if (si === subIdx) return { ...s, status: "in-progress" as const };
                  return s;
                }),
              };
            });
            return next;
          });
          if (!("done" in step) && "subIdx" in step) {
            const taskId = String(step.taskIdx + 1);
            setExpanded(prev => prev.includes(taskId) ? prev : [...prev, taskId]);
          }
        }, step.delay)
      );
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  const toggle = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Check if job is already complete (since it's set to complete on submission)
  const jobComplete = job && job.status === "complete";
  const allDone = jobComplete || tasks.every(t => t.status === "completed");

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.65, 0.3, 0.9] }}
      className="overflow-hidden flex flex-col flex-1"
    >
      <div className="mx-0 mb-0 mt-0 bg-zinc-900/80 border border-zinc-800/80 border-l-[3px] border-l-purple-500 rounded-xl backdrop-blur-sm flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            {allDone ? (
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            ) : (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500" />
              </span>
            )}
            <span className="font-mono text-xs tracking-widest text-purple-400 uppercase">
              {allDone ? "Agent Plan Complete" : "Agent Running Plan"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Task list */}
          <div className="p-3 space-y-1">
            {tasks.map((task) => {
              const isOpen = expanded.includes(task.id);
              return (
                <div key={task.id}>
                  {/* Task row */}
                  <button
                    onClick={() => toggle(task.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors text-left group"
                  >
                    <StatusIcon status={task.status} />
                    <span className={`flex-1 text-sm font-medium ${task.status === "completed" ? "text-zinc-500 line-through" : "text-zinc-200"}`}>
                      {task.title}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${statusBadge[task.status]}`}>
                      {task.status}
                    </span>
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-zinc-500 flex-shrink-0" />
                    }
                  </button>

                  {/* Subtasks */}
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 0.9] }}
                        className="overflow-hidden"
                      >
                        <div className="relative ml-3 pl-5 border-l border-dashed border-zinc-700/50 mt-0.5 mb-1 space-y-0.5">
                          {task.subtasks.map((sub) => (
                            <motion.div
                              key={sub.id}
                              initial={{ opacity: 0, x: -6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.18 }}
                              className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/30 transition-colors"
                            >
                              <StatusIcon status={sub.status} size="h-3.5 w-3.5" />
                              <div className="flex-1 min-w-0">
                                <span className={`text-xs ${sub.status === "completed" ? "text-zinc-600 line-through" : "text-zinc-400"}`}>
                                  {sub.title}
                                </span>
                                {sub.tools.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {sub.tools.map(tool => (
                                      <span
                                        key={tool}
                                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50"
                                      >
                                        {tool}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Final Output Section */}
          {job && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.5 }}
              className="border-t border-zinc-800/60 mt-2"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {allDone ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        <span className="text-green-400">Final Output</span>
                      </>
                    ) : (
                      <>
                        <span className="relative flex h-3.5 w-3.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-60" />
                          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-purple-500" />
                        </span>
                        <span className="text-purple-400">Processing Output...</span>
                      </>
                    )}
                  </h3>
                  {job.finalOutput && (
                    <button
                      onClick={() => {
                        const element = document.createElement("a");
                        const file = new Blob([job.finalOutput ?? ""], {type: 'text/plain'});
                        element.href = URL.createObjectURL(file);
                        element.download = `vexum-output-${job.id}.txt`;
                        document.body.appendChild(element);
                        element.click();
                        document.body.removeChild(element);
                      }}
                      className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                    >
                      ↓ Download
                    </button>
                  )}
                  {job.previewUrl && (
                    <a
                      href={job.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors border border-emerald-500/30"
                    >
                      Preview Composition
                    </a>
                  )}
                </div>
                <div className="bg-zinc-950/50 border border-zinc-800/60 rounded-lg p-4 max-h-[300px] overflow-y-auto font-mono text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
                  {job.finalOutput && job.finalOutput.trim() ? (
                    job.finalOutput
                  ) : (
                    <div className="text-zinc-500 animate-pulse">Executing task and generating output...</div>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500 px-1">
                  <span>Cost: <span className="text-yellow-400 font-mono">{job.solCost} SOL</span></span>
                  <span>Status: <span className={`font-mono ml-1 ${job.status === 'complete' ? 'text-green-400' : 'text-purple-400'}`}>{job.status}</span></span>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
