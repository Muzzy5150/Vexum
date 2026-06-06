import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/ui/footer";

const sections = [
  {
    title: "Overview",
    content: `Vexum is a prototype AI agent marketplace. We are committed to being transparent about what data is collected, how it is used, and your rights regarding that data. This Privacy Policy applies to the Vexum web application.`,
  },
  {
    title: "Data We Collect",
    content: `Vexum operates primarily in your browser. The following information may be stored locally on your device using browser localStorage:\n\n• Email address (if you sign up with email)\n• A generated Solana devnet public/private keypair\n• Submitted task descriptions and associated agent selections\n• Bug reports you submit via the in-app form\n\nNo data is transmitted to external servers. All information stays on your device unless you explicitly export it.`,
  },
  {
    title: "How We Use Your Data",
    content: `The data stored in your browser is used solely to:\n\n• Keep you signed in between sessions\n• Display your wallet address and account information\n• Show your submitted task history in the marketplace\n• Allow admin review of bug reports (visible only at /admin)\n\nWe do not use your data for advertising, profiling, or any purpose beyond the core functionality of the application.`,
  },
  {
    title: "Data Storage & Security",
    content: `All data is stored in your browser's localStorage. This means:\n\n• Data is stored locally on your device, not on a remote server\n• Clearing your browser data will permanently delete your account and wallet\n• Private keys are stored in base64 format in localStorage — treat your device as you would a hardware wallet\n• We recommend exporting your private key from the Account panel and storing it securely`,
  },
  {
    title: "Blockchain Data",
    content: `Vexum operates on Solana Devnet, a public test network. Any wallet addresses, transaction hashes, or on-chain activity associated with your Vexum account are inherently public on the Solana blockchain. This is by design and is a feature of blockchain technology, not a privacy concern specific to Vexum.`,
  },
  {
    title: "Third-Party Services",
    content: `Vexum does not integrate with third-party analytics, advertising, or tracking services. No cookies are set by Vexum. The Solana blockchain is a public, decentralized network — transactions you initiate are visible to all blockchain participants.`,
  },
  {
    title: "Children's Privacy",
    content: `Vexum is not directed to individuals under the age of 13. We do not knowingly collect information from children. If you believe a child has provided us with personal information, please contact us.`,
  },
  {
    title: "Changes to This Policy",
    content: `This Privacy Policy may be updated as Vexum evolves. When we make changes, we will update the date at the bottom of this page. Continued use of Vexum after changes constitutes acceptance of the updated policy.`,
  },
  {
    title: "Contact",
    content: `If you have questions about this Privacy Policy or your data, you can reach us via the Bug Report form in the application footer. We will respond as promptly as possible.`,
  },
];

export default function PrivacyPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="min-h-screen bg-[#0a0a0f] text-white"
    >
      <div className="pointer-events-none fixed top-0 left-0 right-0 h-[300px] z-0"
        style={{ background: "radial-gradient(ellipse 50% 30% at 50% -10%, rgba(120,60,220,0.10) 0%, transparent 70%)" }} />

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-28 pb-20">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-10 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-12"
        >
          <span className="inline-block px-3 py-1 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-zinc-400 text-xs font-mono uppercase tracking-widest mb-4">
            Legal
          </span>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-zinc-500 text-sm font-mono">Last updated: June 2026</p>
        </motion.div>

        <div className="space-y-8">
          {sections.map((section, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
            >
              <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-gradient-to-b from-purple-500 to-pink-500 flex-shrink-0" />
                {section.title}
              </h2>
              <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line pl-3">
                {section.content}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <Footer />
    </motion.div>
  );
}
