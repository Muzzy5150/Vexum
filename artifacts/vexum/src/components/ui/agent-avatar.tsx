const agentImages: Record<string, string> = {
  "orion-7": "/agents/orion-7.png",
  "nova-3": "/agents/nova-3.png",
  "cipher-x": "/agents/cipher-x.png",
  "void-1": "/agents/void-1.png",
  "specter-9": "/agents/specter-9.png",
  "wraith-4": "/agents/wraith-4.png",
  "hyper-1": "/agents/hyper-1.png",
};

const fallbackColors: Record<string, string> = {
  "orion-7": "#7C3AED",
  "nova-3": "#2563EB",
  "cipher-x": "#059669",
  "void-1": "#DC2626",
  "specter-9": "#0891B2",
  "wraith-4": "#A78BFA",
  "hyper-1": "#EC4899",
};

export function AgentAvatar({ agentId, size = 80 }: { agentId: string; size?: number }) {
  const imageSrc = agentImages[agentId];
  const fallbackColor = fallbackColors[agentId] ?? "#7C3AED";

  if (!imageSrc) {
    return (
      <div
        className="flex items-center justify-center rounded-full border border-white/10 bg-zinc-900 font-mono font-bold text-white"
        style={{ width: size, height: size, boxShadow: `0 0 24px ${fallbackColor}55` }}
      >
        {agentId.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-full border border-white/10 bg-zinc-950"
      style={{
        width: size,
        height: size,
        boxShadow: `0 0 ${Math.max(16, size * 0.28)}px ${fallbackColor}55`,
      }}
    >
      <img
        src={imageSrc}
        alt={`${agentId} avatar`}
        className="h-full w-full object-cover"
        style={{ objectPosition: "center 38%" }}
        loading="lazy"
      />
    </div>
  );
}
