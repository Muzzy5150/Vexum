import { emitKeypressEvents, type Key } from "node:readline";
import { stdin, stdout } from "node:process";

export async function terminalInput(
  prompt: string,
  secret = false,
): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY)
    throw new Error(
      secret
        ? "Secret input requires a terminal or configured passphrase environment"
        : "Interactive input requires a terminal; use a structured command",
    );
  const wasRaw = stdin.isRaw;
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.off("keypress", onKey);
      stdin.off("end", onEnd);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
      stdout.write("\n");
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("Input closed"));
    };
    const onKey = (text: string, key: Key) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Cancelled"));
        return;
      }
      if (key.name === "escape") {
        cleanup();
        resolve("");
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(value);
        return;
      }
      if (key.name === "backspace") {
        if (value.length) {
          value = Array.from(value).slice(0, -1).join("");
          stdout.write("\b \b");
        }
        return;
      }
      if (key.ctrl || key.meta || !text || key.sequence?.startsWith("\x1b"))
        return;
      const clean = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
      if (value.length + clean.length > 4096) return;
      value += clean;
      stdout.write(secret ? "*".repeat(clean.length) : clean);
    };
    stdin.on("keypress", onKey);
    stdin.once("end", onEnd);
    stdout.write(prompt);
  });
}
export type MenuKey =
  | "up"
  | "down"
  | "left"
  | "enter"
  | "escape"
  | "backspace"
  | "other";
export async function menuKey(): Promise<MenuKey> {
  if (!stdin.isTTY)
    throw new Error(
      "Interactive menus require a terminal; use --help for direct commands",
    );
  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve) => {
    const cleanup = () => {
      stdin.off("keypress", onKey);
      stdin.off("end", onEnd);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    };
    const onEnd = () => {
      cleanup();
      resolve("escape");
    };
    const onKey = (_text: string, key: Key) => {
      cleanup();
      resolve(
        key.ctrl && key.name === "c"
          ? "escape"
          : key.name === "return" || key.name === "enter"
            ? "enter"
            : ["up", "down", "left", "escape", "backspace"].includes(
                  key.name ?? "",
                )
              ? (key.name as MenuKey)
              : "other",
      );
    };
    stdin.once("keypress", onKey);
    stdin.once("end", onEnd);
  });
}
export async function passphrase(
  label = "Wallet passphrase",
  envName = "VEXUM_PASSPHRASE",
) {
  const configured = process.env[envName];
  if (configured) return configured;
  return terminalInput(`${label}: `, true);
}
export async function authorize(review: { digest: string }) {
  return terminalInput(
    `Type SUBMIT ${review.digest} to authorize this exact transaction: `,
  );
}
