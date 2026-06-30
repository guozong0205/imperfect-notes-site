// Cloudflare Worker template for the Zi Wei interpretation endpoint.
//
// It accepts the page payload:
//   { system, user, max_tokens, stream }
//
// and returns plain text, streaming when possible. The browser page deliberately
// does not call model providers directly; keep API keys only in Worker secrets.
//
// Required secret:
//   OPENAI_API_KEY
//
// Optional variables:
//   OPENAI_MODEL      default: gpt-4.1-mini
//   OPENAI_BASE_URL   default: https://api.openai.com/v1
//   ALLOWED_ORIGIN    default: *

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function jsonResponse(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(env),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function buildPromptPayload(input, env) {
  const system = String(input.system || "").trim();
  const user = String(input.user || "").trim();
  if (!system || !user) {
    throw new Error("Missing system or user prompt");
  }
  return {
    model: env.OPENAI_MODEL || "gpt-4.1-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    max_tokens: Math.min(Number(input.max_tokens || 2000), 3000),
    temperature: 0.7,
    stream: input.stream !== false,
  };
}

async function streamOpenAIText(upstream, env) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  let buffer = "";

  return new Response(new ReadableStream({
    async pull(controller) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) {
            controller.enqueue(encoder.encode(buffer));
          }
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const event = JSON.parse(data);
            const text = event.choices?.[0]?.delta?.content || "";
            if (text) controller.enqueue(encoder.encode(text));
          } catch (_) {
            // Ignore malformed keepalive chunks.
          }
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  }), {
    headers: {
      ...corsHeaders(env),
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

async function nonStreamingText(upstream, env) {
  const data = await upstream.json();
  const text = data.choices?.[0]?.message?.content || "";
  return new Response(text, {
    headers: {
      ...corsHeaders(env),
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, env);
    }
    if (!env.OPENAI_API_KEY) {
      return jsonResponse({ error: "OPENAI_API_KEY is not configured" }, 500, env);
    }

    let input;
    try {
      input = await request.json();
      const payload = buildPromptPayload(input, env);
      const baseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
      const upstream = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!upstream.ok) {
        const detail = await upstream.text();
        return jsonResponse({ error: `Model request failed: ${upstream.status}`, detail }, 502, env);
      }

      return payload.stream ? streamOpenAIText(upstream, env) : nonStreamingText(upstream, env);
    } catch (err) {
      return jsonResponse({ error: err.message || String(err) }, 400, env);
    }
  },
};
