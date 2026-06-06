import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import nacl from "tweetnacl";
import { toast } from "sonner";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function toBase58(bytes: Uint8Array): string {
  let num = 0n;
  for (const b of bytes) num = num * 256n + BigInt(b);
  let out = "";
  while (num > 0n) { out = BASE58[Number(num % 58n)] + out; num /= 58n; }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out; }
  return out;
}

function generateSolanaKeypair() {
  const kp = nacl.sign.keyPair();
  return {
    publicKey: toBase58(kp.publicKey),
    privateKey: btoa(String.fromCharCode(...Array.from(kp.secretKey))),
  };
}

export interface VexumUser {
  email?: string;
  publicKey: string;
  privateKey: string;
  authMethod: "email" | "phantom" | "metamask";
  ethAddress?: string;
}

interface AuthContextType {
  user: VexumUser | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  connectPhantom: () => Promise<void>;
  connectMetaMask: () => Promise<void>;
  showAccountModal: boolean;
  setShowAccountModal: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "vexum_wallet";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<VexumUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    setIsLoading(false);
  }, []);

  function persist(u: VexumUser) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUser(u);
  }

  async function signUp(email: string, password: string) {
    const { publicKey, privateKey } = generateSolanaKeypair();
    const u: VexumUser = {
      email,
      publicKey,
      privateKey,
      authMethod: "email",
    };
    localStorage.setItem("vexum_account", JSON.stringify({
      email,
      password: btoa(password),
      publicKey,
      privateKey,
      createdAt: new Date().toISOString(),
    }));
    persist(u);
    toast.success("Account created. Your Solana wallet has been generated.", {
      description: publicKey.slice(0, 12) + "…",
    });
  }

  function signOut() {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setShowAccountModal(false);
    toast("Signed out", { description: "See you next time." });
  }

  async function connectPhantom() {
    const solana = (window as any).solana;
    if (!solana?.isPhantom) {
      toast.warning("Phantom wallet not detected.", {
        description: "Install it at phantom.app",
        action: { label: "Install", onClick: () => window.open("https://phantom.app", "_blank") },
      });
      window.open("https://phantom.app", "_blank");
      return;
    }
    try {
      const resp = await solana.connect();
      const publicKey = resp.publicKey.toString();
      const { privateKey } = generateSolanaKeypair();
      const u: VexumUser = { publicKey, privateKey, authMethod: "phantom" };
      persist(u);
      toast.success("Phantom wallet connected.", { description: publicKey.slice(0, 12) + "…" });
    } catch (e: any) {
      toast.error("Phantom connection failed.", { description: e?.message });
    }
  }

  async function connectMetaMask() {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      toast.warning("MetaMask not detected.", {
        description: "Install it at metamask.io",
        action: { label: "Install", onClick: () => window.open("https://metamask.io", "_blank") },
      });
      window.open("https://metamask.io", "_blank");
      return;
    }
    try {
      const accounts: string[] = await ethereum.request({ method: "eth_requestAccounts" });
      const ethAddress = accounts[0];
      const { publicKey, privateKey } = generateSolanaKeypair();
      const u: VexumUser = { publicKey, privateKey, authMethod: "metamask", ethAddress };
      persist(u);
      toast.success("MetaMask connected. Solana wallet generated.", {
        description: publicKey.slice(0, 12) + "…",
      });
    } catch (e: any) {
      toast.error("MetaMask connection failed.", { description: e?.message });
    }
  }

  return (
    <AuthContext.Provider value={{
      user, isLoading, signUp, signOut,
      connectPhantom, connectMetaMask,
      showAccountModal, setShowAccountModal,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
