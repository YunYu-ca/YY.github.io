/**
 * Game5 幸运筹码乐园 —— 云存档同步 Worker（Cloudflare Workers）
 * ---------------------------------------------------------------
 * 作用：把浏览器的存档自动写进你的 GitHub 仓库 `Game5Saves/{用户名}/save.json`。
 * 密钥只放在这里（服务端），永不进入前端代码。
 *
 * 部署到 Cloudflare Workers（免费）后，把下面 3 个环境变量/密钥配置好：
 *   GITHUB_TOKEN : 细粒度 PAT（Fine-grained token），仅授权 YunYu-ca/YunYu-ca.github.io 的 Contents:write
 *   REPO_OWNER   : YunYu-ca
 *   REPO_NAME    : YunYu-ca.github.io
 *
 * 浏览器端只做：
 *   GET  {worker}/?username=xxx        —— 拉取该用户的云端存档
 *   POST {worker}/?username=xxx {save} —— 推送该用户的存档
 */

const ALLOWED_ORIGINS = new Set([
  "https://yunyu-ca.github.io",
  "http://localhost:8137",
  "http://127.0.0.1:8137",
]);

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ "Content-Type": "application/json" }, headers || {}),
  });
}

function b64(s) {
  const bin = new TextEncoder().encode(s);
  let str = "";
  for (const b of bin) str += String.fromCharCode(b);
  return btoa(str);
}

function decodeB64(s) {
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(arr);
}

async function ghGet(owner, repo, path, token) {
  return fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "game5-cloud-sync-worker",
      Accept: "application/vnd.github+json",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowed =
      !origin ||
      ALLOWED_ORIGINS.has(origin) ||
      origin.startsWith("http://localhost") ||
      origin.startsWith("http://127.0.0.1");

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowed ? (origin || "https://yunyu-ca.github.io") : "null",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (!allowed) {
      return json({ ok: false, error: "origin not allowed" }, 403, corsHeaders);
    }

    const owner = env.REPO_OWNER || "YunYu-ca";
    const repo = env.REPO_NAME || "YunYu-ca.github.io";
    const token = env.GITHUB_TOKEN;
    if (!token) {
      return json({ ok: false, error: "server not configured: missing GITHUB_TOKEN" }, 500, corsHeaders);
    }

    const username = (url.searchParams.get("username") || "").trim();
    if (!username || !/^[A-Za-z0-9_-]{2,50}$/.test(username)) {
      return json({ ok: false, error: "invalid username" }, 400, corsHeaders);
    }
    const isAccount = url.searchParams.get("account") === "1";
    const path = isAccount
      ? `Game5Accounts/${username}.json`
      : `Game5Saves/${username}/save.json`;

    if (request.method === "GET") {
      const res = await ghGet(owner, repo, path, token);
      if (res.status === 404) return json({ ok: true, exists: false }, 200, corsHeaders);
      if (res.status !== 200) return json({ ok: false, error: `github ${res.status}` }, 502, corsHeaders);
      const data = await res.json();
      let parsed;
      try {
        parsed = JSON.parse(decodeB64(data.content));
      } catch {
        return json({ ok: false, error: "corrupt cloud save" }, 500, corsHeaders);
      }
      return json({ ok: true, exists: true, save: parsed }, 200, corsHeaders);
    }

    if (request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "bad json body" }, 400, corsHeaders);
      }
      const payloadData = isAccount ? (body && body.account) : (body && body.save);
      if (!payloadData || typeof payloadData !== "object") {
        return json({ ok: false, error: "missing payload" }, 400, corsHeaders);
      }

      // 更新已有文件需要带原 sha
      let sha = null;
      const existing = await ghGet(owner, repo, path, token);
      if (existing.status === 200) {
        const d = await existing.json();
        sha = d.sha || null;
      } else if (existing.status !== 404) {
        return json({ ok: false, error: `github read ${existing.status}` }, 502, corsHeaders);
      }

      const payload = {
        message: `Game5 ${isAccount ? "account" : "save"} ${username}`,
        content: b64(JSON.stringify(payloadData)),
        ...(sha ? { sha } : {}),
      };
      const put = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "game5-cloud-sync-worker",
          },
          body: JSON.stringify(payload),
        },
      );
      if (put.status !== 200 && put.status !== 201) {
        const errTxt = await put.text();
        return json({ ok: false, error: `github write ${put.status}: ${errTxt.slice(0, 200)}` }, 502, corsHeaders);
      }
      return json({ ok: true, message: "saved" }, 200, corsHeaders);
    }

    return json({ ok: false, error: "method not allowed" }, 405, corsHeaders);
  },
};
