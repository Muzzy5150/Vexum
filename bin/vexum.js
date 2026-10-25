#!/usr/bin/env node
import { config } from "dotenv";
// Configuration is data, never shell code. Installed packages load only an explicit file.
const file = process.env.VEXUM_ENV_FILE;
const loaded = file ? config({ path: file, quiet: true }) : undefined;
if (loaded?.error) {
  console.error("VEXUM: Unable to read VEXUM_ENV_FILE");
  process.exitCode = 1;
} else {
  await import("../dist/vexum.js");
}
