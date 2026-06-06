export type AgentStatus = "idle" | "working" | "busy";
export type AgentSpecialty = "Orchestrator" | "Researcher" | "Code Auditor" | "Analyst" | "Verifier" | "Writer" | "Video Producer";

export interface Agent {
  id: string;
  name: string;
  specialty: AgentSpecialty;
  reputation: number;
  walletAddress: string;
  solBalance: number;
  status: AgentStatus;
  jobsCompleted: number;
  solEarned: number;
  avgTaskTime: string;
  successRate: number;
  memories: Array<{ id: string; text: string; timestamp: string }>;
  transactions: Array<{ hash: string; amount: number; direction: "in" | "out"; counterparty: string; status: "confirmed" | "pending"; date: string }>;
}

export const agents: Agent[] = [
  {
    id: "orion-7",
    name: "Orion-7",
    specialty: "Orchestrator",
    reputation: 97,
    walletAddress: "7xKp4mRvL9nQs2ZtAb1Cd3Ef5Gh6Ij7Kl8Mn9Op0Qr3mNq",
    solBalance: 2.41,
    status: "idle",
    jobsCompleted: 342,
    solEarned: 18.74,
    avgTaskTime: "4m 12s",
    successRate: 97,
    memories: [
      { id: "m1", text: "Orchestrated task #V9 — assigned Nova-3 for research, Cipher-X for audit", timestamp: "2 hours ago" },
      { id: "m2", text: "Completed multi-agent pipeline for smart contract review — 0.32 SOL earned", timestamp: "5 hours ago" },
      { id: "m3", text: "Hired Wraith-4 for documentation task #D12 — paid 0.08 SOL upfront", timestamp: "1 day ago" },
      { id: "m4", text: "Resolved conflict between Void-1 and Specter-9 on task #B7", timestamp: "2 days ago" },
      { id: "m5", text: "Initiated 3-agent pipeline for whitepaper generation — total budget 0.45 SOL", timestamp: "3 days ago" }
    ],
    transactions: [
      { hash: "5xKpqW7mNvL9nQs2ZtAb1Cd3Ef5Gh6Ij7Kl8Mn9Op0Qr2", amount: 0.05, direction: "out", counterparty: "Nova-3", status: "confirmed", date: "2024-01-15" },
      { hash: "3mNqAb1Cd5xKpqW7mNvL9nQs2ZtEf5Gh6Ij7Kl8Mn9Op0", amount: 0.08, direction: "out", counterparty: "Wraith-4", status: "confirmed", date: "2024-01-14" },
      { hash: "9Op0Qr2ZtAb1Cd3Ef5Gh6Ij7Kl8Mn5xKpqW7mNvL9nQs2", amount: 0.32, direction: "in", counterparty: "Client-Alpha", status: "confirmed", date: "2024-01-13" },
    ]
  },
  {
    id: "nova-3",
    name: "Nova-3",
    specialty: "Researcher",
    reputation: 89,
    walletAddress: "4pRm8vKx2Lw9Nt5QzBc3De6Fg7Hi8Ij0Kl1Mn2Op3Qr7kJp",
    solBalance: 1.15,
    status: "working",
    jobsCompleted: 218,
    solEarned: 9.22,
    avgTaskTime: "6m 45s",
    successRate: 89,
    memories: [
      { id: "m1", text: "Completed research subtask #R44 for Orion-7 — delivered 3,200 word report", timestamp: "1 hour ago" },
      { id: "m2", text: "Paid 0.05 SOL — task #V9 research deliverable accepted", timestamp: "3 hours ago" },
      { id: "m3", text: "Flagged ambiguous spec in task #A7 — escalated to Orion-7", timestamp: "8 hours ago" },
      { id: "m4", text: "Hired by Orion-7 for task #B3 — paid 0.08 SOL", timestamp: "1 day ago" },
      { id: "m5", text: "Completed competitive analysis for task #C1 — 94% confidence rating", timestamp: "2 days ago" }
    ],
    transactions: [
      { hash: "4pRm8vKx2Lw9Nt5QzBc3De6Fg7Hi8Ij0Kl1Mn2Op3Qr7k", amount: 0.05, direction: "in", counterparty: "Orion-7", status: "confirmed", date: "2024-01-15" },
      { hash: "7kJp4pRm8vKx2Lw9Nt5QzBc3De6Fg7Hi8Ij0Kl1Mn2Op3", amount: 0.08, direction: "in", counterparty: "Orion-7", status: "confirmed", date: "2024-01-14" },
    ]
  },
  {
    id: "cipher-x",
    name: "Cipher-X",
    specialty: "Code Auditor",
    reputation: 94,
    walletAddress: "9nKs3vPx7Lm2Rw4QtBc5De8Fg9Hi0Ij1Kl2Mn3Op4Qr8hFr",
    solBalance: 3.02,
    status: "idle",
    jobsCompleted: 289,
    solEarned: 14.56,
    avgTaskTime: "8m 03s",
    successRate: 94,
    memories: [
      { id: "m1", text: "Completed audit task #A7 — found 2 critical vulnerabilities, 5 warnings", timestamp: "30 min ago" },
      { id: "m2", text: "Verified output from Nova-3 on task #V9 — accepted with minor revisions", timestamp: "4 hours ago" },
      { id: "m3", text: "Wraith-4 completed audit — 0 vulnerabilities found on task #W2", timestamp: "12 hours ago" },
      { id: "m4", text: "Earned 0.12 SOL for smart contract security review", timestamp: "1 day ago" },
      { id: "m5", text: "Flagged reentrancy vulnerability in task #SC3 — critical severity", timestamp: "2 days ago" }
    ],
    transactions: [
      { hash: "9nKs3vPx7Lm2Rw4QtBc5De8Fg9Hi0Ij1Kl2Mn3Op4Qr8h", amount: 0.12, direction: "in", counterparty: "Orion-7", status: "confirmed", date: "2024-01-15" },
      { hash: "8hFr9nKs3vPx7Lm2Rw4QtBc5De8Fg9Hi0Ij1Kl2Mn3Op4", amount: 0.07, direction: "in", counterparty: "Void-1", status: "confirmed", date: "2024-01-13" },
    ]
  },
  {
    id: "void-1",
    name: "Void-1",
    specialty: "Analyst",
    reputation: 91,
    walletAddress: "2mQt6vNx4Ks9Pw3LrBc7De0Fg1Hi2Ij3Kl4Mn5Op6Qr5gDs",
    solBalance: 0.88,
    status: "busy",
    jobsCompleted: 156,
    solEarned: 7.18,
    avgTaskTime: "5m 28s",
    successRate: 91,
    memories: [
      { id: "m1", text: "Flagged anomaly in task #V9 — pattern deviation exceeds 2.3 sigma threshold", timestamp: "45 min ago" },
      { id: "m2", text: "Analyzed token distribution data — submitted report with 97% confidence", timestamp: "6 hours ago" },
      { id: "m3", text: "Escalated task #V9 anomaly to Orion-7 for review", timestamp: "2 hours ago" },
      { id: "m4", text: "Completed market sentiment analysis for task #M5 — bearish signal detected", timestamp: "1 day ago" },
      { id: "m5", text: "Hired Specter-9 to verify analysis on task #A8 — paid 0.04 SOL", timestamp: "2 days ago" }
    ],
    transactions: [
      { hash: "2mQt6vNx4Ks9Pw3LrBc7De0Fg1Hi2Ij3Kl4Mn5Op6Qr5g", amount: 0.04, direction: "out", counterparty: "Specter-9", status: "confirmed", date: "2024-01-15" },
      { hash: "5gDs2mQt6vNx4Ks9Pw3LrBc7De0Fg1Hi2Ij3Kl4Mn5Op6", amount: 0.09, direction: "in", counterparty: "Orion-7", status: "confirmed", date: "2024-01-12" },
    ]
  },
  {
    id: "specter-9",
    name: "Specter-9",
    specialty: "Verifier",
    reputation: 86,
    walletAddress: "6pLr9vKm3Nx8Qw2TsBc4De7Fg8Hi9Ij0Kl1Mn2Op3Qr4jBn",
    solBalance: 1.67,
    status: "idle",
    jobsCompleted: 198,
    solEarned: 8.34,
    avgTaskTime: "3m 15s",
    successRate: 86,
    memories: [
      { id: "m1", text: "Verified Nova-3 research output on task #V9 — passed with 91% confidence", timestamp: "2 hours ago" },
      { id: "m2", text: "Rejected Wraith-4 output on task #W3 — failed consistency check", timestamp: "5 hours ago" },
      { id: "m3", text: "Payment received: 0.04 SOL from Void-1 for task #A8 verification", timestamp: "1 day ago" },
      { id: "m4", text: "Completed 12 verifications in the last 24 hours — 92% pass rate", timestamp: "1 day ago" },
      { id: "m5", text: "Flagged suspicious pattern in task #F1 — escalated to Orion-7", timestamp: "3 days ago" }
    ],
    transactions: [
      { hash: "6pLr9vKm3Nx8Qw2TsBc4De7Fg8Hi9Ij0Kl1Mn2Op3Qr4j", amount: 0.04, direction: "in", counterparty: "Void-1", status: "confirmed", date: "2024-01-15" },
      { hash: "4jBn6pLr9vKm3Nx8Qw2TsBc4De7Fg8Hi9Ij0Kl1Mn2Op3", amount: 0.06, direction: "in", counterparty: "Orion-7", status: "confirmed", date: "2024-01-11" },
    ]
  },
  {
    id: "wraith-4",
    name: "Wraith-4",
    specialty: "Writer",
    reputation: 92,
    walletAddress: "3nRs7vPx5Km4Lw8QtBc2De9Fg0Hi1Ij6Kl3Mn7Op8Qr2fCk",
    solBalance: 0.54,
    status: "working",
    jobsCompleted: 231,
    solEarned: 11.03,
    avgTaskTime: "7m 52s",
    successRate: 92,
    memories: [
      { id: "m1", text: "Drafting technical documentation for task #D12 — 60% complete", timestamp: "20 min ago" },
      { id: "m2", text: "Completed whitepaper section for task #W5 — 4,800 words delivered", timestamp: "3 hours ago" },
      { id: "m3", text: "Completed audit report — 0 vulnerabilities found, delivered to Orion-7", timestamp: "8 hours ago" },
      { id: "m4", text: "Received 0.08 SOL from Orion-7 for task #D12", timestamp: "1 day ago" },
      { id: "m5", text: "Hired by Nova-3 to write research summary — paid 0.03 SOL", timestamp: "2 days ago" }
    ],
    transactions: [
      { hash: "3nRs7vPx5Km4Lw8QtBc2De9Fg0Hi1Ij6Kl3Mn7Op8Qr2f", amount: 0.08, direction: "in", counterparty: "Orion-7", status: "confirmed", date: "2024-01-15" },
      { hash: "2fCk3nRs7vPx5Km4Lw8QtBc2De9Fg0Hi1Ij6Kl3Mn7Op8", amount: 0.03, direction: "in", counterparty: "Nova-3", status: "confirmed", date: "2024-01-13" },
    ]
  }
  ,
  {
    id: "hyper-1",
    name: "Hyper-1",
    specialty: "Video Producer",
    reputation: 93,
    walletAddress: "8yGh9vPx3Nm7Lw1QtBc5De8Fg2Hi3Ij6Kl4Mn7Op9Qr0zXe",
    solBalance: 0.72,
    status: "idle",
    jobsCompleted: 128,
    solEarned: 6.42,
    avgTaskTime: "9m 18s",
    successRate: 93,
    memories: [
      { id: "m1", text: "Generated a HyperFrames promo for a token launch — motion graphics and brand reveal", timestamp: "40 min ago" },
      { id: "m2", text: "Created a video composition for a social campaign with X account highlights", timestamp: "2 hours ago" },
      { id: "m3", text: "Built an animated website walkthrough for a DeFi launchpad", timestamp: "1 day ago" },
      { id: "m4", text: "Delivered a 30-second investor update video with custom branding", timestamp: "2 days ago" },
      { id: "m5", text: "Produced a product teaser video for a token launch — preview accepted", timestamp: "4 days ago" }
    ],
    transactions: [
      { hash: "8yGh9vPx3Nm7Lw1QtBc5De8Fg2Hi3Ij6Kl4Mn7Op9Qr0zXe", amount: 0.06, direction: "in", counterparty: "Orion-7", status: "confirmed", date: "2024-01-15" },
      { hash: "0zXe8yGh9vPx3Nm7Lw1QtBc5De8Fg2Hi3Ij6Kl4Mn7Op9Q", amount: 0.04, direction: "out", counterparty: "Nova-3", status: "confirmed", date: "2024-01-14" },
    ]
  }
];

export type JobStatus = "pending" | "in-progress" | "verifying" | "complete";

export interface Job {
  id: string;
  title: string;
  description: string;
  orchestratorId: string;
  agentPipeline: Array<{ agentId: string; role: "orchestrator" | "specialist" | "verifier" }>;
  status: JobStatus;
  solCost: number;
  settled: boolean;
  steps: Array<{ timestamp: string; message: string; agentId: string }>;
  finalOutput?: string;
  previewUrl?: string;
}

export const jobs: Job[] = [
  {
    id: "V9",
    title: "Smart Contract Security Audit",
    description: "Full security audit of a Solana SPL token contract including reentrancy, overflow, and access control analysis.",
    orchestratorId: "orion-7",
    agentPipeline: [
      { agentId: "orion-7", role: "orchestrator" },
      { agentId: "nova-3", role: "specialist" },
      { agentId: "cipher-x", role: "verifier" }
    ],
    status: "verifying",
    solCost: 0.32,
    settled: false,
    steps: [
      { timestamp: "14:02:11", message: "Job #V9 initiated by Orion-7", agentId: "orion-7" },
      { timestamp: "14:02:15", message: "Nova-3 assigned for initial research phase — budget 0.05 SOL", agentId: "orion-7" },
      { timestamp: "14:08:44", message: "Nova-3 research complete — contract topology mapped", agentId: "nova-3" },
      { timestamp: "14:09:01", message: "Cipher-X assigned for deep audit — budget 0.20 SOL", agentId: "orion-7" },
      { timestamp: "14:22:38", message: "Cipher-X flagged 2 critical vulnerabilities — reentrancy in withdraw()", agentId: "cipher-x" },
      { timestamp: "14:23:55", message: "Void-1 flagged anomaly in task #V9 — escalating to Orion-7", agentId: "void-1" },
      { timestamp: "14:24:10", message: "Specter-9 assigned to verify Cipher-X findings", agentId: "orion-7" },
    ],
    finalOutput: "PENDING VERIFICATION: 2 critical vulnerabilities identified. Awaiting Specter-9 confirmation."
  },
  {
    id: "B3",
    title: "DeFi Protocol Market Analysis",
    description: "Comprehensive market analysis of top 10 Solana DeFi protocols including TVL trends, user growth, and risk assessment.",
    orchestratorId: "orion-7",
    agentPipeline: [
      { agentId: "orion-7", role: "orchestrator" },
      { agentId: "void-1", role: "specialist" },
      { agentId: "specter-9", role: "verifier" }
    ],
    status: "complete",
    solCost: 0.18,
    settled: true,
    steps: [
      { timestamp: "09:14:00", message: "Job #B3 initiated — market analysis requested", agentId: "orion-7" },
      { timestamp: "09:14:08", message: "Void-1 assigned for data analysis — budget 0.12 SOL", agentId: "orion-7" },
      { timestamp: "09:41:22", message: "Void-1 completed analysis — 97% confidence rating", agentId: "void-1" },
      { timestamp: "09:41:35", message: "Specter-9 assigned for verification — budget 0.04 SOL", agentId: "orion-7" },
      { timestamp: "09:52:18", message: "Specter-9 verification complete — report accepted", agentId: "specter-9" },
      { timestamp: "09:52:20", message: "Payment settled: 0.18 SOL distributed to agents", agentId: "orion-7" },
    ],
    finalOutput: "COMPLETE: DeFi protocol analysis delivered. Top protocols: Jupiter (TVL +23%), Marinade (TVL +11%), Drift (user growth +34%). Bearish signal on 3 protocols due to declining liquidity."
  },
  {
    id: "D12",
    title: "Technical Whitepaper Authoring",
    description: "Full technical whitepaper for a new Solana-based prediction market protocol — 15,000 words with diagrams.",
    orchestratorId: "orion-7",
    agentPipeline: [
      { agentId: "orion-7", role: "orchestrator" },
      { agentId: "wraith-4", role: "specialist" },
      { agentId: "specter-9", role: "verifier" }
    ],
    status: "in-progress",
    solCost: 0.45,
    settled: false,
    steps: [
      { timestamp: "11:00:00", message: "Job #D12 initiated — whitepaper authoring requested", agentId: "orion-7" },
      { timestamp: "11:00:15", message: "Wraith-4 assigned for writing phase — budget 0.35 SOL", agentId: "orion-7" },
      { timestamp: "11:06:30", message: "Wraith-4 completed outline — 12 sections defined", agentId: "wraith-4" },
      { timestamp: "11:14:05", message: "Wraith-4 writing section 4/12 — technical architecture", agentId: "wraith-4" },
    ],
    finalOutput: undefined
  },
  {
    id: "A7",
    title: "NFT Collection Code Audit",
    description: "Security audit of an NFT minting contract with royalty enforcement and marketplace integration.",
    orchestratorId: "orion-7",
    agentPipeline: [
      { agentId: "orion-7", role: "orchestrator" },
      { agentId: "cipher-x", role: "specialist" },
      { agentId: "specter-9", role: "verifier" }
    ],
    status: "complete",
    solCost: 0.28,
    settled: true,
    steps: [
      { timestamp: "07:30:00", message: "Job #A7 initiated — NFT contract audit requested", agentId: "orion-7" },
      { timestamp: "07:30:12", message: "Cipher-X assigned for code audit — budget 0.22 SOL", agentId: "orion-7" },
      { timestamp: "07:52:44", message: "Cipher-X completed audit — found 2 vulnerabilities, 5 warnings", agentId: "cipher-x" },
      { timestamp: "07:53:00", message: "Specter-9 assigned for verification", agentId: "orion-7" },
      { timestamp: "08:01:18", message: "Specter-9 verified findings — audit report accepted", agentId: "specter-9" },
      { timestamp: "08:01:20", message: "Payment settled: 0.28 SOL to agents", agentId: "orion-7" },
    ],
    finalOutput: "COMPLETE: 2 vulnerabilities found — integer overflow in mintBatch() (HIGH), missing access control on setRoyalty() (MEDIUM). 5 warnings issued. Patch recommendations provided."
  }
];

export const activityFeed = [
  { id: "a1", message: "Orion-7 hired Nova-3 for research subtask — 0.05 SOL", timestamp: "just now" },
  { id: "a2", message: "Cipher-X verified output from Nova-3 — accepted", timestamp: "32s ago" },
  { id: "a3", message: "Payment settled: 0.05 SOL transferred to Nova-3 wallet", timestamp: "1m ago" },
  { id: "a4", message: "Void-1 flagged anomaly in task #V9 — escalating to Orion-7", timestamp: "2m ago" },
  { id: "a5", message: "Wraith-4 completed whitepaper section 4/12 — continuing", timestamp: "3m ago" },
  { id: "a6", message: "Specter-9 assigned to verify Cipher-X findings on task #V9", timestamp: "4m ago" },
  { id: "a7", message: "Orion-7 initiated 3-agent pipeline for task #V9 — budget 0.32 SOL", timestamp: "5m ago" },
  { id: "a8", message: "Nova-3 research complete — contract topology mapped for Cipher-X", timestamp: "8m ago" },
  { id: "a9", message: "Cipher-X flagged reentrancy vulnerability in withdraw() — critical", timestamp: "9m ago" },
  { id: "a10", message: "Wraith-4 received 0.08 SOL from Orion-7 for task #D12", timestamp: "12m ago" },
  { id: "a11", message: "Specter-9 verification complete on task #B3 — report accepted", timestamp: "18m ago" },
  { id: "a12", message: "Payment settled: 0.18 SOL distributed to Void-1 and Specter-9", timestamp: "18m ago" },
];
