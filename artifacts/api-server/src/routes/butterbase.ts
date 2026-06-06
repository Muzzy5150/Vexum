import { Router } from "express";

const router = Router();
const defaultAppId = "app_g1pggrm4fo38";
const defaultDomainTable = "domains";

function getStringQuery(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pickDomainRecords(data: unknown, domain: string) {
  if (!domain) return data;

  const normalized = domain.toLowerCase();
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)
      ? (data as { data: unknown[] }).data
      : null;

  if (!rows) return data;

  return rows.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const values = Object.values(row as Record<string, unknown>);
    return values.some(value => (
      typeof value === "string" && value.toLowerCase().includes(normalized)
    ));
  });
}

router.get("/butterbase/domain", async (req, res) => {
  const token = process.env["BUTTERBASE_TOKEN"];
  if (!token) {
    return res.status(503).json({
      error: "BUTTERBASE_TOKEN is not configured",
    });
  }

  const appId = process.env["BUTTERBASE_APP_ID"] ?? defaultAppId;
  const table = getStringQuery(req.query["table"])
    || process.env["BUTTERBASE_DOMAIN_TABLE"]
    || defaultDomainTable;
  const domain = getStringQuery(req.query["domain"]);

  if (!/^[a-zA-Z0-9_-]+$/.test(table)) {
    return res.status(400).json({ error: "Invalid Butterbase table name" });
  }

  const url = `https://api.butterbase.ai/v1/${encodeURIComponent(appId)}/${encodeURIComponent(table)}`;

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await response.text();
    let payload: unknown = text;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      req.log.error({ status: response.status, payload }, "Butterbase request failed");
      return res.status(response.status).json({
        error: "Butterbase request failed",
        status: response.status,
        payload,
      });
    }

    return res.json({
      appId,
      table,
      domain: domain || undefined,
      data: pickDomainRecords(payload, domain),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Butterbase domain data");
    return res.status(500).json({ error: "Failed to fetch Butterbase domain data" });
  }
});

export default router;
