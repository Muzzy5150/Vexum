import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";

const router = Router();
const previewBase = path.resolve(process.cwd(), "tmp", "hyperframes");
const compositionId = "vexum-hyperframes-promo";
const maxPromptLength = 2_000;

function safeId(id: string) {
  const safe = id.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 80);
  return safe || `task-${Date.now()}`;
}

function extractLink(text: string): string | undefined {
  const urlMatch = text.match(/https?:\/\/[^\s)"'<>]+/i);
  if (urlMatch) return urlMatch[0].replace(/[.,;:!?]+$/, "");
  const xMatch = text.match(/(?:x\.com\/[^\s)"'<>]+|twitter\.com\/[^\s)"'<>]+|@\w+)/i);
  return xMatch ? xMatch[0] : undefined;
}

function buildTitle(prompt: string) {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (!trimmed) return "HyperFrames Promo";
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function serializeForScript(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function buildCompositionHtml(prompt: string, previewUrl?: string) {
  const title = buildTitle(prompt);
  const link = extractLink(prompt);
  const subtitle = link ? `About ${link}` : "A short promo video composition.";
  const brief = prompt.trim().replace(/\s+/g, " ");
  const data = {
    title,
    subtitle,
    brief,
    link,
    previewId: previewUrl?.split("/").pop() ?? "local-preview",
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1920, height=1080" />
  <title>${escapeHtml(title)}</title>
  <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
  <style>
    * { box-sizing: border-box; }
    html,
    body {
      margin: 0;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background: #060712;
      color: #f8fafc;
      font-family: Arial, Helvetica, sans-serif;
    }
    #root {
      position: relative;
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background:
        linear-gradient(135deg, rgba(14, 165, 233, 0.22), transparent 34%),
        radial-gradient(circle at 78% 18%, rgba(236, 72, 153, 0.22), transparent 28%),
        linear-gradient(180deg, #111827 0%, #030712 100%);
    }
    .scene {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      padding: 104px 128px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 34px;
    }
    .scene::before {
      content: "";
      position: absolute;
      inset: 64px;
      border: 1px solid rgba(248, 250, 252, 0.14);
      pointer-events: none;
    }
    .eyebrow {
      width: max-content;
      padding: 12px 18px;
      border: 1px solid rgba(45, 212, 191, 0.5);
      color: #99f6e4;
      font-size: 24px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0;
      background: rgba(15, 23, 42, 0.68);
    }
    .title {
      max-width: 1220px;
      margin: 0;
      color: #ffffff;
      font-size: 96px;
      line-height: 1;
      font-weight: 900;
      letter-spacing: 0;
      text-wrap: balance;
    }
    .subtitle {
      max-width: 1040px;
      margin: 0;
      color: rgba(226, 232, 240, 0.84);
      font-size: 34px;
      line-height: 1.35;
      font-weight: 500;
    }
    .brief-wrap {
      width: 1160px;
      max-width: 100%;
      padding: 44px 48px;
      background: rgba(15, 23, 42, 0.78);
      border: 1px solid rgba(148, 163, 184, 0.25);
    }
    .brief-label {
      margin: 0 0 18px;
      color: #38bdf8;
      font-size: 26px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .brief {
      margin: 0;
      color: #e5e7eb;
      font-size: 38px;
      line-height: 1.35;
      font-weight: 650;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 24px;
      width: 100%;
    }
    .beat {
      min-height: 238px;
      padding: 34px;
      background: rgba(248, 250, 252, 0.08);
      border: 1px solid rgba(248, 250, 252, 0.14);
    }
    .beat strong {
      display: block;
      margin-bottom: 24px;
      color: #facc15;
      font-size: 24px;
      text-transform: uppercase;
      letter-spacing: 0;
    }
    .beat span {
      display: block;
      color: #f8fafc;
      font-size: 34px;
      line-height: 1.2;
      font-weight: 800;
    }
    .footer {
      position: absolute;
      left: 128px;
      right: 128px;
      bottom: 72px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: rgba(226, 232, 240, 0.68);
      font-size: 22px;
      font-weight: 650;
    }
    .brand {
      color: #ffffff;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0;
    }
  </style>
</head>
<body>
  <div id="root" data-composition-id="${compositionId}" data-start="0" data-duration="10" data-width="1920" data-height="1080">
    <div id="scene-intro" class="clip scene" data-start="0" data-duration="3.4" data-track-index="1">
      <div class="eyebrow">VEXUM HyperFrames</div>
      <h1 class="title" data-bind="title"></h1>
      <p class="subtitle" data-bind="subtitle"></p>
    </div>

    <div id="scene-brief" class="clip scene" data-start="3.2" data-duration="3.4" data-track-index="2">
      <div class="brief-wrap">
        <p class="brief-label">Video Brief</p>
        <p class="brief" data-bind="brief"></p>
      </div>
    </div>

    <div id="scene-plan" class="clip scene" data-start="6.4" data-duration="3.6" data-track-index="3">
      <div class="grid">
        <div class="beat"><strong>01</strong><span>Hook the viewer fast</span></div>
        <div class="beat"><strong>02</strong><span>Frame the offer clearly</span></div>
        <div class="beat"><strong>03</strong><span>Finish with a usable CTA</span></div>
      </div>
    </div>

    <div class="footer">
      <div class="brand">HyperFrames Composition</div>
      <div data-bind="previewId"></div>
    </div>
  </div>

  <script>
    const compositionData = ${serializeForScript(data)};
    for (const el of document.querySelectorAll("[data-bind]")) {
      const key = el.getAttribute("data-bind");
      el.textContent = compositionData[key] || "";
    }

    const tl = gsap.timeline({ paused: true });
    tl.set(["#scene-brief", "#scene-plan"], { opacity: 0 }, 0);
    tl.from("#scene-intro .eyebrow", { opacity: 0, y: 28, duration: 0.45, ease: "power3.out", immediateRender: false }, 0.2);
    tl.from("#scene-intro .title", { opacity: 0, y: 56, duration: 0.7, ease: "power3.out", immediateRender: false }, 0.35);
    tl.from("#scene-intro .subtitle", { opacity: 0, y: 34, duration: 0.55, ease: "power3.out", immediateRender: false }, 0.65);
    tl.to("#scene-intro", { opacity: 0, y: -28, duration: 0.45, ease: "power2.in" }, 2.85);
    tl.to("#scene-brief", { opacity: 1, duration: 0.01 }, 3.2);
    tl.from("#scene-brief .brief-wrap", { opacity: 0, x: -68, duration: 0.7, ease: "power3.out", immediateRender: false }, 3.35);
    tl.to("#scene-brief", { opacity: 0, x: 48, duration: 0.45, ease: "power2.in" }, 5.95);
    tl.set("#scene-brief", { opacity: 0 }, 6.4);
    tl.to("#scene-plan", { opacity: 1, duration: 0.01 }, 6.4);
    tl.from("#scene-plan .beat", { opacity: 0, y: 58, duration: 0.7, stagger: 0.14, ease: "power3.out", immediateRender: false }, 6.55);
    tl.from(".footer", { opacity: 0, y: 24, duration: 0.45, ease: "power2.out", immediateRender: false }, 0.25);
    window.__timelines = window.__timelines || {};
    window.__timelines["${compositionId}"] = tl;

    if (!new URLSearchParams(window.location.search).has("paused")) {
      tl.play(0);
    }
  </script>
</body>
</html>`;
}

async function ensurePreviewDir() {
  await fs.mkdir(previewBase, { recursive: true });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

router.post("/hyperframes/compose", async (req, res) => {
  try {
    const { prompt, taskId } = req.body as { prompt?: unknown; taskId?: unknown };
    if (typeof prompt !== "string" || typeof taskId !== "string") {
      return res.status(400).json({ error: "prompt and taskId are required" });
    }

    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      return res.status(400).json({ error: "prompt cannot be empty" });
    }

    if (normalizedPrompt.length > maxPromptLength) {
      return res.status(413).json({ error: `prompt must be ${maxPromptLength} characters or fewer` });
    }

    const safeTaskId = safeId(taskId);
    const taskDir = path.join(previewBase, safeTaskId);
    await ensurePreviewDir();
    await fs.mkdir(taskDir, { recursive: true });

    const previewUrl = `/api/hyperframes/preview/${safeTaskId}`;
    const content = buildCompositionHtml(normalizedPrompt, previewUrl);
    const filePath = path.join(taskDir, "index.html");

    await fs.writeFile(filePath, content, "utf-8");
    return res.json({ compositionId, previewUrl });
  } catch (err) {
    req.log.error({ err }, "Failed to create HyperFrames composition");
    return res.status(500).json({ error: "Failed to create HyperFrames composition" });
  }
});

router.get("/hyperframes/preview/:taskId", async (req, res) => {
  try {
    const taskId = safeId(req.params.taskId);
    const filePath = path.join(previewBase, taskId, "index.html");
    if (!(await fileExists(filePath))) {
      return res.status(404).json({ error: "Preview not found" });
    }
    return res.sendFile(filePath);
  } catch (err) {
    req.log.error({ err }, "Failed to serve HyperFrames preview");
    return res.status(500).json({ error: "Failed to serve HyperFrames preview" });
  }
});

export default router;
