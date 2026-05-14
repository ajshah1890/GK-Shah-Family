/**
 * Vercel Edge Function — /api/data/:type
 *
 * Mirrors the Express API server for Vercel static deployments.
 * GET  /api/data/:type  — fetch JSON from GitHub (public)
 * POST /api/data/:type  — write JSON to GitHub (requires X-Admin-Secret)
 */

export const config = { runtime: "edge" };

const GITHUB_REPO = process.env.GITHUB_REPO ?? "ajshah1890/GK-Shah-Family";
const ALLOWED = new Set(["members", "moments", "settings"]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function jsonRes(data: unknown, status = 200, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gkshah-family-app",
  };
}

/** UTF-8 safe base64 encoder (for GitHub API). */
function encodeBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binary = Array.from(bytes, (b: number) => String.fromCharCode(b)).join("");
  return btoa(binary);
}

/** UTF-8 safe base64 decoder (from GitHub API). */
function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c: string) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(request: Request): Promise<Response> {
  // Extract :type from the last URL segment
  const url = new URL(request.url);
  const type = url.pathname.split("/").filter(Boolean).pop() ?? "";

  if (!ALLOWED.has(type)) {
    return jsonRes({ error: "Invalid data type. Must be members | moments | settings." }, 400);
  }

  const GITHUB_TOKEN = process.env.GITHUB_PERSONAL_ACCESS_TOKEN ?? "";
  const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "";
  const filePath = `data/${type}.json`;

  // ── GET ────────────────────────────────────────────────────────────────────
  if (request.method === "GET") {
    if (!GITHUB_TOKEN) {
      return jsonRes({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured on server." }, 503);
    }
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
        { headers: ghHeaders(GITHUB_TOKEN) },
      );
      if (res.status === 404) return jsonRes({ data: null, sha: null });
      if (!res.ok) {
        const body = await res.text();
        return jsonRes({ error: `GitHub API error ${res.status}`, detail: body.slice(0, 300) }, 502);
      }
      const file = await res.json() as { content: string; sha: string };
      const decoded = decodeBase64(file.content);
      return jsonRes({ data: JSON.parse(decoded), sha: file.sha });
    } catch (err) {
      return jsonRes({ error: String(err) }, 502);
    }
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  if (request.method === "POST") {
    if (!ADMIN_SECRET) {
      return jsonRes({ error: "ADMIN_SECRET not configured on server." }, 503);
    }
    const secret = request.headers.get("x-admin-secret");
    if (secret !== ADMIN_SECRET) {
      return jsonRes({ error: "Forbidden — invalid admin secret." }, 403);
    }
    if (!GITHUB_TOKEN) {
      return jsonRes({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not configured on server." }, 503);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json() as Record<string, unknown>;
    } catch {
      return jsonRes({ error: "Invalid JSON body." }, 400);
    }

    try {
      // Get existing SHA for update (or create new file)
      const getRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
        { headers: ghHeaders(GITHUB_TOKEN) },
      );
      let sha: string | null = null;
      if (getRes.ok) {
        const existing = await getRes.json() as { sha: string };
        sha = existing.sha;
      }

      const now = new Date().toISOString();
      const withMeta = { ...body, _savedAt: now };
      const encoded = encodeBase64(JSON.stringify(withMeta, null, 2));

      const putBody: Record<string, unknown> = {
        message: `sync: update ${type} at ${now}`,
        content: encoded,
      };
      if (sha) putBody.sha = sha;

      const putRes = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`,
        {
          method: "PUT",
          headers: { ...ghHeaders(GITHUB_TOKEN), "Content-Type": "application/json" },
          body: JSON.stringify(putBody),
        },
      );

      if (!putRes.ok) {
        const errBody = await putRes.text();
        return jsonRes({ error: `GitHub PUT ${putRes.status}`, detail: errBody.slice(0, 300) }, 502);
      }

      return jsonRes({ ok: true, savedAt: now });
    } catch (err) {
      return jsonRes({ error: String(err) }, 502);
    }
  }

  // ── Method not allowed ─────────────────────────────────────────────────────
  return jsonRes({ error: "Method not allowed. Supported: GET, POST." }, 405, { Allow: "GET, POST" });
}
