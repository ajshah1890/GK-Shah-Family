import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

const GITHUB_TOKEN = process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] ?? "";
const GITHUB_REPO  = process.env["GITHUB_REPO"] ?? "ajshah1890/GK-Shah-Family";
const ADMIN_SECRET = process.env["ADMIN_SECRET"] ?? "";

const ALLOWED_TYPES = new Set(["members", "moments", "settings"]);

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gkshah-family-app",
  };
}

async function getFileSha(path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}`);
  const json = await res.json() as { sha: string };
  return json.sha;
}

async function getFileContent(path: string): Promise<{ content: string; sha: string } | null> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub GET ${path} → ${res.status}`);
  const json = await res.json() as { content: string; sha: string };
  const decoded = Buffer.from(json.content, "base64").toString("utf-8");
  return { content: decoded, sha: json.sha };
}

async function putFileContent(
  path: string,
  content: string,
  message: string,
  sha: string | null
): Promise<void> {
  const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`;
  const body: Record<string, unknown> = {
    message,
    content: Buffer.from(content, "utf-8").toString("base64"),
  };
  if (sha) body["sha"] = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: { ...ghHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT ${path} → ${res.status}: ${text}`);
  }
}

// GET /api/data/:type  — public, no auth required
router.get("/:type", async (req: Request, res: Response) => {
  const type = Array.isArray(req.params["type"]) ? req.params["type"][0] : req.params["type"];
  if (!type || !ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: "Invalid data type" });
    return;
  }

  try {
    const file = await getFileContent(`data/${type}.json`);
    if (!file) {
      res.json({ data: null, sha: null });
      return;
    }
    const parsed = JSON.parse(file.content);
    res.json({ data: parsed, sha: file.sha });
  } catch (err) {
    req.log.error({ err }, "Failed to load data from GitHub");
    res.status(502).json({ error: "Failed to load data from GitHub" });
  }
});

// POST /api/data/:type  — admin only, requires X-Admin-Secret header
router.post("/:type", async (req: Request, res: Response) => {
  const type = Array.isArray(req.params["type"]) ? req.params["type"][0] : req.params["type"];
  if (!type || !ALLOWED_TYPES.has(type)) {
    res.status(400).json({ error: "Invalid data type" });
    return;
  }

  const secret = req.headers["x-admin-secret"];
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const payload = req.body;
  if (!payload || typeof payload !== "object") {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  try {
    const filePath = `data/${type}.json`;

    // Snapshot: write backup before overwriting
    const existing = await getFileContent(filePath);
    if (existing) {
      const snapshotPath = `data/backups/${type}_${Date.now()}.json`;
      const snapshotSha = await getFileSha(snapshotPath);
      await putFileContent(
        snapshotPath,
        existing.content,
        `backup: ${type} snapshot before overwrite`,
        snapshotSha
      );
    }

    const sha = existing?.sha ?? null;
    const now = new Date().toISOString();
    const withMeta = { ...payload, _savedAt: now };
    await putFileContent(
      filePath,
      JSON.stringify(withMeta, null, 2),
      `sync: update ${type} at ${now}`,
      sha
    );

    res.json({ ok: true, savedAt: now });
  } catch (err) {
    req.log.error({ err }, "Failed to save data to GitHub");
    res.status(502).json({ error: "Failed to save data to GitHub" });
  }
});

export default router;
