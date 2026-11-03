// Trianon Workbench — Phase 0 Worker
// POST /api/chat  { messages, baseURL, apiKey, model }
// → 流式代理到 ${baseURL}/chat/completions，SSE 原样回传

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request);
    }

    return new Response("Not Found", { status: 404, headers: CORS });
  },
};

async function handleChat(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  const { messages, baseURL, apiKey, model } = body || {};

  if (!messages || !Array.isArray(messages) || !baseURL || !apiKey || !model) {
    return json({ error: "missing fields: messages / baseURL / apiKey / model" }, 400);
  }

  const upstream = baseURL.replace(/\/+$/, "") + "/chat/completions";

  let resp;
  try {
    resp = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });
  } catch (e) {
    return json({ error: "upstream fetch failed: " + e.message }, 502);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    return new Response(text || `upstream ${resp.status}`, {
      status: resp.status,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS },
    });
  }

  // 流式原样回传
  return new Response(resp.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      ...CORS,
    },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS },
  });
}
