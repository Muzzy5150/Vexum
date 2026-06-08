import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import nacl from "tweetnacl";
import { agents, jobs, activityFeed as initialFeed, Job } from "@/lib/data";
import { PulseBeams } from "@/components/ui/pulse-beams";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { Workspaces, WorkspaceTrigger, WorkspaceContent } from "@/components/ui/workspaces";
import AnimatedGlowingBorder from "@/components/ui/animated-glowing-search-bar";
import AgentPlan from "@/components/ui/agent-plan";
import { useAuth } from "@/context/auth-context";
import { Footer } from "@/components/ui/footer";
import { toast } from "sonner";

const RetroGrid = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden [perspective:200px]" style={{ opacity: 0.12 }}>
    <div className="absolute inset-0 [transform:rotateX(65deg)]">
      <div className="[background-image:linear-gradient(to_right,#4c1d95_1px,transparent_0),linear-gradient(to_bottom,#4c1d95_1px,transparent_0)] [background-repeat:repeat] [background-size:60px_60px] [height:300vh] [inset:0%_0px] [margin-left:-200%] [transform-origin:100%_0_0] [width:600vw]" />
    </div>
    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] to-transparent to-90%" />
  </div>
);

const RepArc = ({ reputation, uid, size = 76 }: { reputation: number; uid: string; size?: number }) => {
  const strokeW = 3.5;
  const r = size / 2 - strokeW - 2;
  const cx = size / 2;
  const cy = size / 2;
  const circum = 2 * Math.PI * r;
  const trackLen = circum * 0.75;
  const fillLen = (reputation / 100) * trackLen;
  const gradId = `arcGrad-${uid}`;
  return (
    <svg width={size} height={size} className="absolute inset-0" style={{ transform: "rotate(135deg)" }}>
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth={strokeW}
        strokeDasharray={`${trackLen} ${circum - trackLen}`} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={strokeW}
        strokeDasharray={`${fillLen} ${circum - fillLen}`} strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px rgba(124,58,237,0.9))" }} />
    </svg>
  );
};

const statusGlows: Record<string, string> = {
  idle:    "0 0 24px rgba(74,222,128,0.10), 0 0 48px rgba(74,222,128,0.05)",
  working: "0 0 24px rgba(251,191,36,0.10), 0 0 48px rgba(251,191,36,0.05)",
  busy:    "0 0 24px rgba(248,113,113,0.10), 0 0 48px rgba(248,113,113,0.05)",
};

const statusHoverGlows: Record<string, string> = {
  idle:    "0 0 0 1px rgba(168,85,247,0.55), 0 0 20px rgba(168,85,247,0.18), 0 0 40px rgba(236,72,153,0.10), 0 0 28px rgba(74,222,128,0.12)",
  working: "0 0 0 1px rgba(168,85,247,0.55), 0 0 20px rgba(168,85,247,0.18), 0 0 40px rgba(236,72,153,0.10), 0 0 28px rgba(251,191,36,0.12)",
  busy:    "0 0 0 1px rgba(168,85,247,0.55), 0 0 20px rgba(168,85,247,0.18), 0 0 40px rgba(236,72,153,0.10), 0 0 28px rgba(248,113,113,0.12)",
};

const jobBorderColors: Record<string, string> = {
  verifying:   "border-l-purple-500",
  complete:    "border-l-green-500",
  "in-progress": "border-l-yellow-500",
  pending:     "border-l-red-500",
};

const jobGlowColors: Record<string, string> = {
  verifying:   "rgba(168,85,247,0.12)",
  complete:    "rgba(74,222,128,0.12)",
  "in-progress": "rgba(251,191,36,0.12)",
  pending:     "rgba(248,113,113,0.12)",
};

type FeedType = "payment" | "alert" | "hire" | "complete" | "neutral";

const getFeedType = (msg: string): FeedType => {
  const m = msg.toLowerCase();
  if (m.includes("payment") || m.includes("settled") || m.includes("transferred") || m.includes("received sol") || m.includes("sol transferred")) return "payment";
  if (m.includes("flagged") || m.includes("anomaly") || m.includes("critical") || m.includes("vulnerability") || m.includes("escalat")) return "alert";
  if (m.includes("hired") || m.includes("assigned") || m.includes("initiated")) return "hire";
  if (m.includes("verified") || m.includes("complete") || m.includes("accepted")) return "complete";
  return "neutral";
};

const feedStyles: Record<FeedType, { border: string; bg: string; dot: string; time: string }> = {
  payment:  { border: "border-l-yellow-400", bg: "bg-yellow-500/5",  dot: "bg-yellow-400",  time: "text-yellow-400/60" },
  alert:    { border: "border-l-red-400",    bg: "bg-red-500/5",     dot: "bg-red-400",     time: "text-red-400/60" },
  hire:     { border: "border-l-purple-400", bg: "bg-purple-500/5",  dot: "bg-purple-400",  time: "text-purple-400/60" },
  complete: { border: "border-l-green-400",  bg: "bg-green-500/5",   dot: "bg-green-400",   time: "text-green-400/60" },
  neutral:  { border: "border-l-zinc-600",   bg: "bg-zinc-800/20",   dot: "bg-zinc-500",    time: "text-zinc-500/60" },
};

const activityBeams = [
  {
    path: "M269 220.5H16.5C10.9772 220.5 6.5 224.977 6.5 230.5V398.5",
    gradientConfig: {
      initial: { x1: "0%", x2: "0%", y1: "80%", y2: "100%" },
      animate: { x1: ["0%","0%","200%"], x2: ["0%","0%","180%"], y1: ["80%","0%","0%"], y2: ["100%","20%","20%"] },
      transition: { duration: 2, repeat: Infinity, repeatType: "loop" as const, ease: "linear", repeatDelay: 5, delay: 0.5 },
    },
    connectionPoints: [{ cx: 6.5, cy: 398.5, r: 6 }, { cx: 269, cy: 220.5, r: 6 }],
  },
  {
    path: "M380 168V17C380 11.4772 384.477 7 390 7H414",
    gradientConfig: {
      initial: { x1: "-40%", x2: "-10%", y1: "0%", y2: "20%" },
      animate: { x1: ["40%","0%","0%"], x2: ["10%","0%","0%"], y1: ["0%","0%","180%"], y2: ["20%","20%","200%"] },
      transition: { duration: 2, repeat: Infinity, repeatType: "loop" as const, ease: "linear", repeatDelay: 5, delay: 2.5 },
    },
    connectionPoints: [{ cx: 420.5, cy: 6.5, r: 6 }, { cx: 380, cy: 168, r: 6 }],
  },
];

const agentWorkspaces = agents.map(a => ({
  id: a.id,
  name: a.name,
  logo: `/agents/${a.id}.png`,
  plan: a.specialty,
}));

type StoredJob = Partial<Job> & {
  id: string;
  description: string;
  agentName?: string;
  submittedAt?: string;
  submittedBy?: string;
};

type TaskQuote = {
  id: string;
  prompt: string;
  agentId: string;
  agentName: string;
  totalSol: number;
  estimatedSeconds: number;
  taskTypes: string[];
  lineItems: Array<{ label: string; sol: number; detail: string }>;
};

function roundSol(value: number) {
  return Number(value.toFixed(4));
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes: Uint8Array) {
  if (bytes.length === 0) return "";

  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const value = digits[i] * 256 + carry;
      digits[i] = value % 58;
      carry = Math.floor(value / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let leadingZeroes = 0;
  for (const byte of bytes) {
    if (byte !== 0) break;
    leadingZeroes += 1;
  }

  return "1".repeat(leadingZeroes) + digits.reverse().map(digit => BASE58_ALPHABET[digit]).join("");
}

function classifyTask(prompt: string) {
  const text = prompt.toLowerCase();
  return {
    wallet: /\b(wallet|keypair|private key|secret key|phantom|address)\b/.test(text),
    tokenMint: /\b(spl token|token-2022|token mint|mint token|create token|coin|memecoin|supply|decimals)\b/.test(text),
    nftMint: /\b(nft|digital asset|collection|collectible|pnft|metaplex core)\b/.test(text),
    metadata: /\b(metadata|json metadata|token json|uri|image uri|symbol|royalt|attributes?)\b/.test(text),
    transfer: /\b(transfer|send|pay|payment|recipient)\b/.test(text),
    swap: /\b(swap|jupiter|route|slippage|dex|trade|sol to|usdc|quote)\b/.test(text),
    airdrop: /\b(airdrop|devnet|faucet|fund wallet)\b/.test(text),
    audit: /\b(audit|security|vulnerabilit|unchecked account|anchor program|risk check|simulate transaction|transaction risk)\b/.test(text),
    launch: /\b(launch|launch package|go to market|token launch|presale|campaign)\b/.test(text),
    tokenScan: extractSolanaAddress(prompt) !== "",
    domain: /\b(domain|dns|website name|subdomain|butterbase)\b/.test(text),
    hyperframes: /\b(video|make a video|create a video|film|promo|website|twitter|x account|link to website|social media|tweet)\b/.test(text),
    research: /\b(research|analy[sz]e|report|market|compare|strategy|find|summari[sz]e)\b/.test(text),
    code: /\b(code|build|fix|debug|deploy|api|contract|script|app|website)\b/.test(text),
  };
}

function estimateTaskQuote(prompt: string, agentId: string): TaskQuote {
  const agent = agents.find(a => a.id === agentId) ?? agents[0];
  const trimmed = prompt.trim();
  const inputChars = trimmed.length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const fileChars = [...trimmed.matchAll(/\[File:[^\]]+\]\s*([\s\S]*?)(?=\n\n\[File:|$)/g)]
    .reduce((sum, match) => sum + (match[1]?.length ?? 0), 0);
  const taskTypes = classifyTask(trimmed);

  const lineItems: TaskQuote["lineItems"] = [
    {
      label: "Base orchestration",
      sol: 0.012,
      detail: "Intent parsing, routing, execution log, and settlement setup",
    },
  ];

  const promptSol = Math.max(0.003, Math.ceil(inputChars / 500) * 0.0025);
  lineItems.push({
    label: "Input processing",
    sol: promptSol,
    detail: `${inputChars.toLocaleString()} characters, ${wordCount.toLocaleString()} words`,
  });

  if (fileChars > 0) {
    lineItems.push({
      label: "Attached file context",
      sol: Math.ceil(fileChars / 2_000) * 0.006,
      detail: `${fileChars.toLocaleString()} file characters added to context`,
    });
  }

  if (taskTypes.hyperframes) {
    lineItems.push({
      label: "HyperFrames composition",
      sol: 0.065,
      detail: "Storyboard, HTML animation, preview generation, and visual QA budget",
    });
  }

  if (taskTypes.wallet) {
    lineItems.push({
      label: "Wallet/key operation",
      sol: 0.01,
      detail: "Secure keypair generation and delivery formatting",
    });
  }

  if (taskTypes.tokenMint) {
    lineItems.push({
      label: "SPL token mint plan",
      sol: 0.055,
      detail: "Mint config, supply/decimals planning, authorities, and ATA setup checklist",
    });
  }

  if (taskTypes.nftMint) {
    lineItems.push({
      label: "NFT asset plan",
      sol: 0.06,
      detail: "Metaplex metadata, collection fields, royalty settings, and mint workflow",
    });
  }

  if (taskTypes.metadata) {
    lineItems.push({
      label: "Metadata generation",
      sol: 0.018,
      detail: "URI-ready JSON, symbol/name validation, attributes, and media fields",
    });
  }

  if (taskTypes.transfer) {
    lineItems.push({
      label: "Transfer simulation",
      sol: 0.014,
      detail: "Recipient validation, balance impact summary, and confirmation copy",
    });
  }

  if (taskTypes.swap) {
    lineItems.push({
      label: "Swap route quote",
      sol: 0.026,
      detail: "Route planning, slippage assumptions, fee estimate, and signing summary",
    });
  }

  if (taskTypes.airdrop) {
    lineItems.push({
      label: "Devnet funding flow",
      sol: 0.008,
      detail: "Airdrop request plan and wallet balance verification",
    });
  }

  if (taskTypes.audit) {
    lineItems.push({
      label: "Security/risk analysis",
      sol: 0.075,
      detail: "Transaction or program review, authority checks, and issue report",
    });
  }

  if (taskTypes.tokenScan) {
    lineItems.push({
      label: "Token intelligence scan",
      sol: 0.024,
      detail: "Helius RPC token supply, top holder distribution, and DexScreener market summary",
    });
  }

  if (taskTypes.launch) {
    lineItems.push({
      label: "Launch package",
      sol: 0.09,
      detail: "Token/NFT plan, metadata, launch checklist, and optional promo asset coordination",
    });
  }

  if (taskTypes.domain) {
    lineItems.push({
      label: "Domain lookup",
      sol: 0.012,
      detail: "Butterbase domain table request, filtering, and availability summary",
    });
  }

  if (taskTypes.research) {
    lineItems.push({
      label: "Research depth",
      sol: Math.min(0.045, Math.max(0.012, Math.ceil(wordCount / 80) * 0.006)),
      detail: "Multi-step analysis and result synthesis",
    });
  }

  if (taskTypes.code) {
    lineItems.push({
      label: "Implementation effort",
      sol: 0.035,
      detail: "Code-oriented execution and verification budget",
    });
  }

  const agentPremium = Math.max(0.004, agent.reputation / 100 * 0.009);
  lineItems.push({
    label: "Agent reputation premium",
    sol: agentPremium,
    detail: `${agent.name} reputation: ${agent.reputation}`,
  });

  const totalSol = roundSol(Math.min(0.35, lineItems.reduce((sum, item) => sum + item.sol, 0)));
  const labels = [
    taskTypes.launch ? "launch" : null,
    taskTypes.hyperframes ? "video" : null,
    taskTypes.wallet ? "wallet" : null,
    taskTypes.tokenMint ? "token-mint" : null,
    taskTypes.nftMint ? "nft" : null,
    taskTypes.metadata ? "metadata" : null,
    taskTypes.transfer ? "transfer" : null,
    taskTypes.swap ? "swap" : null,
    taskTypes.airdrop ? "airdrop" : null,
    taskTypes.audit ? "audit" : null,
    taskTypes.tokenScan ? "token-scan" : null,
    taskTypes.domain ? "domain" : null,
    taskTypes.research ? "research" : null,
    taskTypes.code ? "build" : null,
  ].filter((label): label is string => Boolean(label));

  return {
    id: `Q${Date.now().toString(36).toUpperCase()}`,
    prompt: trimmed,
    agentId,
    agentName: agent.name,
    totalSol,
    estimatedSeconds: Math.min(90, 12 + Math.ceil(inputChars / 180) + lineItems.length * 5),
    taskTypes: labels.length > 0 ? labels : ["general"],
    lineItems: lineItems.map(item => ({ ...item, sol: roundSol(item.sol) })),
  };
}

function extractMatch(prompt: string, pattern: RegExp, fallback: string) {
  const match = prompt.match(pattern);
  return match?.[1]?.trim() || fallback;
}

function makeMockSolanaAddress() {
  return encodeBase58(nacl.sign.keyPair().publicKey);
}

function extractDomainQuery(prompt: string) {
  return prompt.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i)?.[1]
    ?? prompt.match(/\bdomain\s+([a-z0-9.-]+)\b/i)?.[1]
    ?? "";
}

function extractSolanaAddress(prompt: string) {
  return prompt.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)?.[0] ?? "";
}

function deriveSymbol(prompt: string) {
  const explicit = prompt.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/)?.[1]
    ?? prompt.match(/\bsymbol\s*[:=]?\s*([A-Za-z][A-Za-z0-9]{1,9})\b/i)?.[1];
  if (explicit) return explicit.toUpperCase().slice(0, 10);

  const name = extractMatch(prompt, /\b(?:called|named|token)\s+([A-Za-z][A-Za-z0-9 ]{1,28})/i, "VEX");
  return name
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "VEX";
}

function deriveTokenName(prompt: string) {
  return extractMatch(prompt, /\b(?:called|named)\s+([A-Za-z][A-Za-z0-9 ]{1,30})/i, "Vexum Token").slice(0, 32);
}

function deriveSupply(prompt: string) {
  const raw = prompt.match(/\b(\d+(?:\.\d+)?)\s*(billion|million|thousand|b|m|k)?\b/i);
  if (!raw) return "1,000,000,000";

  const value = Number(raw[1]);
  const unit = raw[2]?.toLowerCase();
  const multiplier = unit === "billion" || unit === "b" ? 1_000_000_000
    : unit === "million" || unit === "m" ? 1_000_000
    : unit === "thousand" || unit === "k" ? 1_000
    : 1;
  return Math.round(value * multiplier).toLocaleString();
}

function buildMetadataJson(prompt: string, taskTypes: ReturnType<typeof classifyTask>) {
  const name = taskTypes.nftMint ? deriveTokenName(prompt).replace(/ Token$/i, " NFT") : deriveTokenName(prompt);
  const symbol = deriveSymbol(prompt);

  return {
    name,
    symbol,
    description: `Generated by VEXUM for: ${prompt.slice(0, 140)}`,
    image: "https://example.com/asset.png",
    external_url: "https://vexum.ai",
    attributes: [
      { trait_type: "Network", value: "Solana" },
      { trait_type: "Generated By", value: "VEXUM" },
      { trait_type: "Asset Type", value: taskTypes.nftMint ? "NFT" : "Fungible Token" },
    ],
    properties: {
      files: [{ uri: "https://example.com/asset.png", type: "image/png" }],
      category: "image",
    },
  };
}

function buildSolanaOutput({
  prompt,
  agentName,
  agentSpecialty,
  quote,
  previewUrl,
  domainData,
  tokenScanData,
}: {
  prompt: string;
  agentName: string;
  agentSpecialty: string;
  quote: TaskQuote;
  previewUrl?: string;
  domainData?: unknown;
  tokenScanData?: unknown;
}) {
  const taskTypes = classifyTask(prompt);
  const sections: string[] = [];

  sections.push(`✓ VEXUM SOLANA TASK COMPLETE\n\nTask: "${prompt}"\nProcessed by: ${agentName}\nSpecialty: ${agentSpecialty}`);

  if (taskTypes.wallet) {
    const kp = nacl.sign.keyPair();
    sections.push(`WALLET / KEYPAIR\n\nPublic Key / Address (base58):\n${encodeBase58(kp.publicKey)}\n\nPrivate Key / Secret Key (base58 - Phantom import format):\n${encodeBase58(kp.secretKey)}\n\nSecurity note: import this into Phantom only if you intend to control this generated wallet. Never share the secret key.`);
  }

  if (taskTypes.tokenMint || taskTypes.launch) {
    sections.push(`SPL TOKEN MINT PLAN\n\nToken Name: ${deriveTokenName(prompt)}\nSymbol: ${deriveSymbol(prompt)}\nSupply: ${deriveSupply(prompt)}\nDecimals: ${prompt.match(/\bdecimals?\s*[:=]?\s*(\d+)\b/i)?.[1] ?? "9"}\nToken Program: ${/token-?2022/i.test(prompt) ? "Token-2022" : "SPL Token Program"}\nMint Account Preview: ${makeMockSolanaAddress()}\nMetadata PDA Preview: ${makeMockSolanaAddress()}\n\nRecommended authority settings:\n- Mint authority: keep during setup, revoke after final supply if fixed-supply launch\n- Freeze authority: remove for liquid public token unless you need compliance controls\n- Metadata update authority: project wallet or multisig`);
  }

  if (taskTypes.nftMint || taskTypes.launch) {
    sections.push(`NFT / DIGITAL ASSET PLAN\n\nCollection: ${deriveTokenName(prompt).replace(/ Token$/i, " Collection")}\nStandard: ${/core/i.test(prompt) ? "Metaplex Core" : "Metaplex Token Metadata"}\nRoyalty: ${prompt.match(/\b(\d+(?:\.\d+)?)\s*%?\s*royalt/i)?.[1] ?? "0"}%\nMint Preview: ${makeMockSolanaAddress()}\nCollection Preview: ${makeMockSolanaAddress()}\n\nWorkflow:\n1. Upload media asset\n2. Upload metadata JSON\n3. Create collection or standalone asset\n4. Mint to target wallet\n5. Verify metadata and collection linkage`);
  }

  if (taskTypes.metadata || taskTypes.tokenMint || taskTypes.nftMint || taskTypes.launch) {
    sections.push(`METADATA JSON\n\n${JSON.stringify(buildMetadataJson(prompt, taskTypes), null, 2)}`);
  }

  if (taskTypes.transfer) {
    sections.push(`TRANSFER SIMULATION\n\nStatus: Prepared, not broadcast\nEstimated network fee: 0.000005 SOL\nRecipient validation: pending wallet input\nBalance impact: exact debit plus network fee\n\nBefore signing, VEXUM should show:\n- Sender wallet\n- Recipient wallet\n- Asset and amount\n- Fees\n- Irreversible transfer warning`);
  }

  if (taskTypes.swap) {
    sections.push(`SWAP ROUTE QUOTE\n\nStatus: Simulated route, not signed\nDefault slippage: ${prompt.match(/\b(\d+(?:\.\d+)?)\s*%?\s*slippage/i)?.[1] ?? "0.5"}%\nIntegrator: Jupiter-style quote flow\nPriority fee: dynamic\n\nUser confirmation should include:\n- Input token and amount\n- Output token estimate\n- Minimum received\n- Price impact\n- Route hops\n- Expiration window`);
  }

  if (taskTypes.airdrop) {
    sections.push(`DEVNET AIRDROP PLAN\n\nNetwork: devnet\nSuggested amount: ${prompt.match(/\b(\d+(?:\.\d+)?)\s*sol\b/i)?.[1] ?? "1"} SOL\nTarget wallet: provide or use generated address\nFollow-up: check balance after faucet response\n\nNote: mainnet SOL cannot be airdropped.`);
  }

  if (taskTypes.domain) {
    sections.push(`DOMAIN LOOKUP\n\nSource: Butterbase app_g1pggrm4fo38\nStatus: ${domainData ? "Fetched" : "Unavailable or not configured"}\n\n${domainData ? JSON.stringify(domainData, null, 2) : "Set BUTTERBASE_TOKEN on the API server to enable live Butterbase domain results."}`);
  }

  if (taskTypes.tokenScan) {
    sections.push(`SOLANA TOKEN SCAN\n\n${formatTokenScanOutput(tokenScanData)}`);
  }

  if (taskTypes.audit || taskTypes.research) {
    sections.push(`SECURITY / RESEARCH REVIEW\n\nInitial risk checklist:\n- Verify transaction signer set\n- Check token account ownership\n- Check mint and freeze authorities\n- Confirm recipient addresses\n- Simulate before signing\n- Inspect program IDs for expected Solana/Metaplex/Jupiter programs\n- Flag unexpected SOL drains or token approvals\n\nRisk level: ${taskTypes.audit ? "Needs full review before signing" : "Informational"}`);
  }

  if (previewUrl) {
    sections.push(`HYPERFRAMES PREVIEW\n\n${previewUrl}`);
  }

  sections.push(`QUOTE\n\nStatus: COMPLETE\nCost: ${quote.totalSol} SOL\nTimestamp: ${new Date().toISOString()}`);

  return sections.join("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n");
}

function formatTokenScanOutput(tokenScanData: unknown) {
  if (!tokenScanData || typeof tokenScanData !== "object") {
    return "Token scan unavailable. Start the API server and ensure the Helius RPC URL is reachable.";
  }

  const data = tokenScanData as {
    token?: { name?: string; ticker?: string };
    market?: {
      dex?: string;
      chart?: string;
      priceUsd?: string;
      marketCap?: number;
      fdv?: number;
      liquidityUsd?: number;
      volume24h?: number;
      change24h?: number;
    };
    holders?: {
      totalSupply?: string;
      holderCount?: number | null;
      holderCountNote?: string;
      top10Percent?: number | null;
      largestHolderPercent?: number | null;
      top?: Array<{ rank: number; owner?: string; tokenAccount: string; amount: string; percent: number }>;
      importantWallets?: Array<{ owner?: string; tokenAccount: string; percent: number; reason: string }>;
    };
    sources?: { errors?: string[] };
  };

  const importantWallets = data.holders?.importantWallets ?? [];
  const topHolders = data.holders?.top ?? [];
  return [
    `Token: ${data.token?.name ?? "Unknown token"}`,
    `Ticker: ${data.token?.ticker ?? "Unknown"}`,
    `DEX: ${data.market?.dex ?? "Unavailable"}`,
    `Chart: ${data.market?.chart ?? "Unavailable"}`,
    `Price: ${data.market?.priceUsd ? `$${data.market.priceUsd}` : "Unavailable"}`,
    `Market Cap: ${formatUsd(data.market?.marketCap)}`,
    `FDV: ${formatUsd(data.market?.fdv)}`,
    `Liquidity: ${formatUsd(data.market?.liquidityUsd)}`,
    `24h Volume: ${formatUsd(data.market?.volume24h)}`,
    `24h Change: ${typeof data.market?.change24h === "number" ? `${data.market.change24h.toFixed(2)}%` : "Unavailable"}`,
    "",
    `Total Supply: ${data.holders?.totalSupply ?? "Unavailable"}`,
    `Holder Count: ${typeof data.holders?.holderCount === "number" ? data.holders.holderCount.toLocaleString() : data.holders?.holderCountNote ?? "Unavailable"}`,
    `Top 10 Concentration: ${typeof data.holders?.top10Percent === "number" ? `${data.holders.top10Percent.toFixed(2)}%` : "Unavailable"}`,
    `Largest Holder: ${typeof data.holders?.largestHolderPercent === "number" ? `${data.holders.largestHolderPercent.toFixed(2)}%` : "Unavailable"}`,
    "",
    "Top holders:",
    ...(topHolders.length > 0
      ? topHolders.map(holder => `${holder.rank}. ${(holder.owner ?? holder.tokenAccount).slice(0, 6)}...${(holder.owner ?? holder.tokenAccount).slice(-4)} holds ${holder.amount} (${holder.percent.toFixed(2)}%)`)
      : ["No top-holder distribution returned."]),
    "",
    "Important wallets:",
    ...(importantWallets.length > 0
      ? importantWallets.map(wallet => `${(wallet.owner ?? wallet.tokenAccount).slice(0, 6)}...${(wallet.owner ?? wallet.tokenAccount).slice(-4)} controls ${wallet.percent.toFixed(2)}% (${wallet.reason})`)
      : ["No single top holder crossed the importance threshold."]),
    ...(data.sources?.errors?.length ? ["", "Source warnings:", ...data.sources.errors.map(error => `- ${error}`)] : []),
  ].join("\n");
}

function formatUsd(value: number | undefined) {
  if (typeof value !== "number" || Number.isNaN(value)) return "Unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 0 : 6,
  }).format(value);
}

function buildJobTitle(taskTypes: ReturnType<typeof classifyTask>) {
  if (taskTypes.launch) return "Solana Launch Package";
  if (taskTypes.tokenMint) return "SPL Token Mint Setup";
  if (taskTypes.nftMint) return "Solana NFT Mint Setup";
  if (taskTypes.swap) return "Solana Swap Quote";
  if (taskTypes.transfer) return "Solana Transfer Simulation";
  if (taskTypes.airdrop) return "Devnet Airdrop Setup";
  if (taskTypes.audit) return "Solana Security Review";
  if (taskTypes.tokenScan) return "Solana Token Intelligence Scan";
  if (taskTypes.domain) return "Domain Lookup";
  if (taskTypes.metadata) return "Solana Metadata Generator";
  if (taskTypes.wallet) return "Solana Wallet Generation";
  if (taskTypes.hyperframes) return "HyperFrames Video Production";
  return "Custom User Task";
}

function buildExecutionSteps(taskTypes: ReturnType<typeof classifyTask>, quote: TaskQuote, agentName: string) {
  const now = Date.now();
  const steps = [
    { timestamp: new Date(now).toLocaleTimeString(), message: `Quote accepted: ${quote.totalSol} SOL`, agentId: quote.agentId },
    { timestamp: new Date(now + 700).toLocaleTimeString(), message: "Job submitted by user", agentId: quote.agentId },
    { timestamp: new Date(now + 1000).toLocaleTimeString(), message: `${agentName} processing task...`, agentId: quote.agentId },
    { timestamp: new Date(now + 2000).toLocaleTimeString(), message: "Task analysis complete", agentId: quote.agentId },
  ];

  if (taskTypes.wallet) steps.push({ timestamp: new Date(now + 2600).toLocaleTimeString(), message: "Generating Phantom-compatible base58 keypair", agentId: quote.agentId });
  if (taskTypes.tokenMint) steps.push({ timestamp: new Date(now + 3000).toLocaleTimeString(), message: "Preparing SPL token mint configuration", agentId: quote.agentId });
  if (taskTypes.nftMint) steps.push({ timestamp: new Date(now + 3400).toLocaleTimeString(), message: "Preparing Metaplex NFT metadata and collection plan", agentId: quote.agentId });
  if (taskTypes.metadata) steps.push({ timestamp: new Date(now + 3800).toLocaleTimeString(), message: "Generating URI-ready metadata JSON", agentId: quote.agentId });
  if (taskTypes.transfer) steps.push({ timestamp: new Date(now + 4200).toLocaleTimeString(), message: "Simulating transfer confirmation details", agentId: quote.agentId });
  if (taskTypes.swap) steps.push({ timestamp: new Date(now + 4600).toLocaleTimeString(), message: "Preparing swap route and slippage summary", agentId: quote.agentId });
  if (taskTypes.airdrop) steps.push({ timestamp: new Date(now + 5000).toLocaleTimeString(), message: "Preparing devnet airdrop request plan", agentId: quote.agentId });
  if (taskTypes.audit) steps.push({ timestamp: new Date(now + 5400).toLocaleTimeString(), message: "Running Solana risk checklist", agentId: quote.agentId });
  if (taskTypes.tokenScan) steps.push({ timestamp: new Date(now + 5600).toLocaleTimeString(), message: "Scanning token market data and holder distribution", agentId: quote.agentId });
  if (taskTypes.hyperframes) steps.push({ timestamp: new Date(now + 5800).toLocaleTimeString(), message: "Generating HyperFrames preview", agentId: quote.agentId });
  if (taskTypes.domain) steps.push({ timestamp: new Date(now + 6100).toLocaleTimeString(), message: "Fetching Butterbase domain data", agentId: quote.agentId });

  steps.push(
    { timestamp: new Date(now + 6400).toLocaleTimeString(), message: "Compiling final deliverable", agentId: quote.agentId },
    { timestamp: new Date(now + 7200).toLocaleTimeString(), message: "Task completed successfully", agentId: quote.agentId },
  );

  return steps;
}

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

export default function MarketplacePage() {
  const { user } = useAuth();
  const [localJobs, setLocalJobs] = useState<Job[]>(() => {
    const storedJobs = loadStoredJobs();
    const storedIds = new Set(storedJobs.map(job => job.id));
    return [...storedJobs, ...jobs.filter(job => !storedIds.has(job.id))];
  });
  const [taskDesc, setTaskDesc] = useState("");
  const [selectedAgent, setSelectedAgent] = useState(agents[0].id);
  const backendUrl = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "");
  const [feed, setFeed] = useState(initialFeed.slice(0, 5));
  const feedIndexRef = useRef(5);
  const [showPlan, setShowPlan] = useState(false);
  const [planKey, setPlanKey] = useState(0);
  const [submittedDesc, setSubmittedDesc] = useState("");
  const [submittedAgentName, setSubmittedAgentName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [pendingQuote, setPendingQuote] = useState<TaskQuote | null>(null);
  const [quoteThinking, setQuoteThinking] = useState(false);
  const [executingQuote, setExecutingQuote] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const nextItem = initialFeed[feedIndexRef.current % initialFeed.length];
      feedIndexRef.current += 1;
      setFeed(prev => [{ ...nextItem, timestamp: "just now" }, ...prev.slice(1)]);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please create an account to submit tasks.");
      return;
    }
    if (!taskDesc.trim()) return;

    setQuoteThinking(true);
    setPendingQuote(null);
    window.setTimeout(() => {
      setPendingQuote(estimateTaskQuote(taskDesc, selectedAgent));
      setQuoteThinking(false);
    }, 650);
  };

  const executeQuotedTask = async (quote: TaskQuote) => {
    if (!user || executingQuote) return;

    setExecutingQuote(true);
    const prompt = quote.prompt;
    const agent = agents.find(a => a.id === quote.agentId) ?? agents[0];
    const taskTypes = classifyTask(prompt);
    const isHyperframesTask = taskTypes.hyperframes;
    const jobId = `J${Date.now().toString(36).toUpperCase()}`;
    let previewUrl: string | undefined;
    let domainData: unknown;
    let tokenScanData: unknown;

    if (isHyperframesTask) {
      try {
        const response = await fetch(`${backendUrl}/api/hyperframes/compose`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, taskId: jobId }),
        });
        if (response.ok) {
          const payload = await response.json();
          previewUrl = `${backendUrl}${payload.previewUrl}`;
        } else {
          const payload = await response.json().catch(() => ({}));
          previewUrl = undefined;
          toast.error(`HyperFrames preview unavailable: ${payload.error || response.statusText}`);
        }
      } catch (error) {
        previewUrl = undefined;
        toast.error(`HyperFrames preview unavailable: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    if (taskTypes.domain) {
      try {
        const params = new URLSearchParams();
        const domain = extractDomainQuery(prompt);
        if (domain) params.set("domain", domain);
        const response = await fetch(`${backendUrl}/api/butterbase/domain${params.toString() ? `?${params.toString()}` : ""}`);
        const payload = await response.json().catch(() => null);
        if (response.ok) {
          domainData = payload;
        } else {
          domainData = payload ?? { error: response.statusText };
        }
      } catch (error) {
        domainData = { error: error instanceof Error ? error.message : "Unknown Butterbase error" };
      }
    }

    if (taskTypes.tokenScan) {
      try {
        const mint = extractSolanaAddress(prompt);
        const response = await fetch(`${backendUrl}/api/token/scan/${encodeURIComponent(mint)}`);
        const payload = await response.json().catch(() => null);
        if (response.ok) {
          tokenScanData = payload;
        } else {
          tokenScanData = payload ?? { error: response.statusText };
          toast.error(`Token scan unavailable: ${payload?.error || response.statusText}`);
        }
      } catch (error) {
        tokenScanData = { error: error instanceof Error ? error.message : "Unknown token scan error" };
        toast.error(`Token scan unavailable: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    const finalOutput = buildSolanaOutput({
      prompt,
      agentName: agent.name,
      agentSpecialty: agent.specialty,
      quote,
      previewUrl,
      domainData,
      tokenScanData,
    });
    
    const newJob: Job = {
      id: jobId,
      title: buildJobTitle(taskTypes),
      description: prompt,
      orchestratorId: quote.agentId,
      agentPipeline: [{ agentId: quote.agentId, role: "orchestrator" }],
      status: "complete",
      solCost: quote.totalSol,
      settled: false,
      previewUrl,
      steps: buildExecutionSteps(taskTypes, quote, agent.name),
      finalOutput,
    };
    setLocalJobs(prev => [newJob, ...prev.filter(job => job.id !== newJob.id)]);

    try {
      const stored = JSON.parse(localStorage.getItem("vexum_jobs") || "[]");
      const storedJob = {
        ...newJob,
        submittedBy: user.publicKey,
        agentName: agent.name,
        submittedAt: new Date().toISOString(),
      };
      const nextStored = Array.isArray(stored)
        ? [storedJob, ...stored.filter((job: { id?: string }) => job?.id !== newJob.id)]
        : [storedJob];
      localStorage.setItem("vexum_jobs", JSON.stringify(nextStored));
    } catch {}

    setSubmittedDesc(prompt);
    setSubmittedAgentName(agent.name);
    setPlanKey(k => k + 1);
    setShowPlan(true);
    setTaskDesc("");
    setPendingQuote(null);
    setDragActive(false);
    setExecutingQuote(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setTaskDesc(prev => prev ? `${prev}\n\n[File: ${file.name}]\n${content}` : `[File: ${file.name}]\n${content}`);
        toast.success(`File "${file.name}" added to task`);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="bg-[#0a0a0f] text-white">
    <div className="h-screen pt-16 flex overflow-hidden relative">
      {/* Page background */}
      <RetroGrid />
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-[500px] z-0"
        style={{ background: "radial-gradient(ellipse 70% 40% at 50% -10%, rgba(120,60,220,0.18) 0%, transparent 70%)" }} />

      {/* ── LEFT SIDEBAR ───────────────────────────────────────────────────── */}
      <div className="w-[280px] border-r border-zinc-800/50 flex flex-col h-full bg-zinc-950/60 backdrop-blur-md relative z-10">
        <div className="p-4 border-b border-zinc-800/50">
          <h2 className="font-mono text-sm tracking-widest text-purple-400">ACTIVE AGENTS</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {agents.map((agent) => (
            <motion.div
              key={agent.id}
              whileHover={{ y: -3, boxShadow: statusHoverGlows[agent.status] }}
              style={{ boxShadow: statusGlows[agent.status] }}
              className="rounded-xl"
              data-testid={`agent-card-${agent.id}`}
            >
              <Link href={`/agent/${agent.id}`} className="block">
                <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border border-zinc-800/80 rounded-xl p-4 transition-colors hover:border-zinc-700/60">
                  {/* Avatar + Rep Arc */}
                  <div className="flex flex-col items-center mb-3">
                    <div className="relative" style={{ width: 76, height: 76 }}>
                      <RepArc reputation={agent.reputation} uid={agent.id} size={76} />
                      <div className="absolute inset-0 flex items-center justify-center" style={{ padding: 12 }}>
                        <AgentAvatar agentId={agent.id} size={52} />
                      </div>
                    </div>
                    <div className="mt-2 text-center">
                      <h3 className="font-semibold text-white text-sm leading-tight">{agent.name}</h3>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[9px] uppercase font-mono tracking-wider border border-purple-500/20">
                        {agent.specialty}
                      </span>
                    </div>
                  </div>

                  {/* Wallet + balance */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-500 mb-2 px-1">
                    <span>{agent.walletAddress.slice(0, 6)}...{agent.walletAddress.slice(-4)}</span>
                    <span className="text-yellow-400 font-semibold">{agent.solBalance} SOL</span>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      agent.status === "idle" ? "bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]" :
                      agent.status === "working" ? "bg-yellow-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" :
                      "bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.8)]"
                    }`} />
                    <span className="text-[10px] text-zinc-400 capitalize font-mono">{agent.status}</span>
                    <span className="ml-auto text-[10px] font-mono text-purple-300/70">{agent.reputation} rep</span>
                  </div>

                  {/* Hire button */}
                  <span className="relative inline-block overflow-hidden rounded-md p-[1px] w-full">
                    <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                    <button className="relative w-full inline-flex items-center justify-center px-4 py-1.5 text-xs font-medium text-white bg-[#0a0a0f] rounded-md transition-colors hover:bg-zinc-900">
                      Hire
                    </button>
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── CENTER PANEL ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Submit form */}
        <div className="p-5 border-b border-zinc-800/50 relative">
          <form onSubmit={handleSubmit} className="bg-zinc-900/70 border border-zinc-800/80 rounded-xl p-5 backdrop-blur-sm">

            <h2 className="text-lg font-semibold mb-4 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
              Submit New Task
            </h2>
            <AnimatedGlowingBorder className="mb-4">
              <textarea
                value={taskDesc}
                onChange={e => setTaskDesc(e.target.value)}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                placeholder="Describe your task... or drag & drop files here"
                className={`w-full bg-[#010201] border-none rounded-xl p-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none resize-none h-24 font-mono transition-colors ${dragActive ? 'bg-purple-950/20' : ''}`}
              />
            </AnimatedGlowingBorder>
            <div className="flex items-center justify-between gap-3">
              <Workspaces
                workspaces={agentWorkspaces}
                selectedWorkspaceId={selectedAgent}
                onWorkspaceChange={(ws) => setSelectedAgent(ws.id)}
              >
                <WorkspaceTrigger className="flex-1" />
                <WorkspaceContent title="Select Agent" searchable />
              </Workspaces>
              <span className="relative inline-block overflow-hidden rounded-md p-[1px] flex-shrink-0">
                <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                <button
                  type="submit"
                  disabled={quoteThinking}
                  className="relative inline-flex items-center justify-center px-6 py-2 text-sm font-medium text-white bg-[#0a0a0f] rounded-md hover:bg-zinc-900 transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {quoteThinking ? "Estimating..." : "Get SOL Quote"}
                </button>
              </span>
            </div>
          </form>

          <AnimatePresence>
            {pendingQuote && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 12 }}
                  transition={{ duration: 0.2 }}
                  className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-purple-950/30"
                >
                  <div className="border-b border-zinc-800 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-mono text-xs tracking-widest text-purple-400 uppercase">Agent Cost Estimate</p>
                        <h3 className="mt-1 text-xl font-semibold text-white">{pendingQuote.totalSol} SOL</h3>
                      </div>
                      <div className="rounded-lg border border-yellow-500/25 bg-yellow-500/10 px-3 py-2 text-right">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-yellow-300/80">ETA</p>
                        <p className="font-mono text-sm text-yellow-300">{pendingQuote.estimatedSeconds}s</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">
                      {pendingQuote.agentName} priced this from input size, task type, tool usage, and agent reputation.
                    </p>
                  </div>

                  <div className="max-h-[360px] overflow-y-auto px-5 py-4">
                    <div className="mb-4 flex flex-wrap gap-2">
                      {pendingQuote.taskTypes.map(type => (
                        <span key={type} className="rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-purple-300">
                          {type}
                        </span>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {pendingQuote.lineItems.map((item) => (
                        <div key={item.label} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-zinc-100">{item.label}</p>
                            <p className="font-mono text-sm text-green-400">{item.sol} SOL</p>
                          </div>
                          <p className="mt-1 text-xs text-zinc-500">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 rounded-lg border border-zinc-800 bg-black/30 p-3">
                      <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Prompt</p>
                      <p className="line-clamp-3 text-xs leading-relaxed text-zinc-300">{pendingQuote.prompt}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 border-t border-zinc-800 px-5 py-4">
                    <button
                      type="button"
                      disabled={executingQuote}
                      onClick={() => setPendingQuote(null)}
                      className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={executingQuote}
                      onClick={() => executeQuotedTask(pendingQuote)}
                      className="rounded-md border border-green-500/30 bg-green-500/15 px-4 py-2 text-sm font-medium text-green-300 transition-colors hover:bg-green-500/25 disabled:opacity-60"
                    >
                      {executingQuote ? "Starting..." : `Continue for ${pendingQuote.totalSol} SOL`}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auth lock — only covers the submit form */}
          <AnimatePresence>
            {!user && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 rounded-xl flex items-center justify-center bg-[#0a0a0f]/75 backdrop-blur-[3px]"
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-9 h-9 rounded-full bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center">
                    <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Sign in to submit tasks</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Your wallet. Your agents.</p>
                  </div>
                  <Link
                    href="/auth"
                    className="relative inline-flex overflow-hidden rounded-full p-[1.5px] mt-1"
                  >
                    <span className="absolute inset-[-1000%] animate-[spin_3s_linear_infinite] [will-change:transform] bg-[conic-gradient(from_90deg_at_50%_50%,#E2CBFF_0%,#393BB2_50%,#E2CBFF_100%)]" />
                    <span className="relative flex items-center justify-center rounded-full bg-[#0a0a0f] px-5 py-1.5 text-xs font-medium text-white hover:bg-zinc-900 transition-colors">
                      Create Account
                    </span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Agent Plan panel — inline when active */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            {showPlan ? (
              <motion.div
                key="plan"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-y-auto p-5 flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-sm tracking-widest text-purple-400">ACTIVE TASK EXECUTION</h2>
                  <button
                    onClick={() => setShowPlan(false)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors text-sm px-2 py-1 rounded hover:bg-zinc-800/50"
                  >
                    ← Back to Jobs
                  </button>
                </div>
                <AgentPlan
                  key={planKey}
                  taskDesc={submittedDesc}
                  agentName={submittedAgentName}
                  job={localJobs[0]}
                  onClose={() => setShowPlan(false)}
                />
              </motion.div>
            ) : (
              <motion.div
                key="jobs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-y-auto p-5"
              >
                <h2 className="font-mono text-sm tracking-widest text-purple-400 mb-5">ACTIVE JOBS</h2>
                <div className="space-y-3">
                  {localJobs.map((job) => (
                    <motion.div
                key={job.id}
                whileHover={{ y: -2, boxShadow: `0 0 0 1px rgba(168,85,247,0.3), 0 4px 24px ${jobGlowColors[job.status] ?? "rgba(168,85,247,0.1)"}` }}
                className="rounded-xl"
              >
                <Link href={`/job/${job.id}`} className="block">
                  <div className={`bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800/80 border-l-[3px] ${jobBorderColors[job.status] ?? "border-l-zinc-600"} rounded-xl p-4 transition-colors`}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-purple-400 text-xs">#{job.id}</span>
                        <h3 className="font-semibold text-white text-sm">{job.title}</h3>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider flex-shrink-0 ${
                        job.status === "complete"     ? "bg-green-500/10 text-green-400 border border-green-500/25" :
                        job.status === "verifying"   ? "bg-purple-500/10 text-purple-400 border border-purple-500/25" :
                        job.status === "in-progress" ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/25" :
                        "bg-red-500/10 text-red-400 border border-red-500/25"
                      }`}>
                        {job.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3 line-clamp-1 font-mono">{job.description}</p>
                    <div className="flex justify-between items-center">
                      {/* Overlapping agent avatar chips */}
                      <div className="flex -space-x-2">
                        {job.agentPipeline.map((p, idx) => (
                          <div
                            key={idx}
                            className="w-7 h-7 rounded-full border-2 border-[#0d0d14] bg-zinc-900 flex items-center justify-center overflow-hidden"
                            style={{ zIndex: job.agentPipeline.length - idx }}
                            title={p.agentId}
                          >
                            <AgentAvatar agentId={p.agentId} size={28} />
                          </div>
                        ))}
                      </div>
                      <span
                        className="font-mono text-sm font-semibold text-green-400"
                        style={{ textShadow: "0 0 10px rgba(74,222,128,0.55)" }}
                      >
                        {job.solCost} SOL
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
            </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="w-[300px] border-l border-zinc-800/50 bg-zinc-950/60 backdrop-blur-md flex flex-col relative overflow-hidden z-10">
        {/* PulseBeams background */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <PulseBeams
            beams={activityBeams}
            width={300}
            height={800}
            svgOpacity={0.55}
            gradientColors={{ start: "#7C3AED", middle: "#6344F5", end: "#AE48FF" }}
          />
        </div>

        {/* Header */}
        <div className="p-4 border-b border-zinc-800/50 relative z-10 bg-zinc-950/80 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400" />
            </span>
            <h2 className="font-mono text-sm tracking-widest text-purple-400">LIVE FEED</h2>
          </div>
        </div>

        {/* Feed entries */}
        <div className="flex-1 overflow-y-auto p-3 relative z-10" data-testid="activity-feed">
          <div className="flex flex-col gap-2">
            {feed.map((entry, i) => {
              const type = getFeedType(entry.message);
              const style = feedStyles[type];
              return (
                <div
                  key={`feed-slot-${i}`}
                  className={`${style.bg} border border-zinc-800/60 border-l-[2.5px] ${style.border} rounded-lg p-3 text-xs backdrop-blur-sm`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${style.dot}`} />
                    <p className="text-zinc-300 leading-snug">{entry.message}</p>
                  </div>
                  <p className={`font-mono text-[10px] mt-1.5 uppercase pl-3.5 ${style.time}`}>{entry.timestamp}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </div>
  );
}
