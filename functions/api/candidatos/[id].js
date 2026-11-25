async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

export async function onRequestDelete({ request, env, params }) {
  try {
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id < 1) return json({ error: "Identificador inválido." }, 400);

    const adminPassword = request.headers.get("x-admin-password") || "";
    const token = request.headers.get("x-delete-token") || "";

    // Admin deletion is allowed only when ADMIN_PASSWORD is configured as a Cloudflare secret.
    const isAdmin = Boolean(env.ADMIN_PASSWORD) && Boolean(adminPassword) &&
      safeEqual(adminPassword, env.ADMIN_PASSWORD);

    if (!isAdmin) {
      if (!token) return json({ error: "Código de exclusão ausente." }, 401);
      const row = await env.DB.prepare("SELECT delete_token_hash FROM candidatos WHERE id = ?").bind(id).first();
      if (!row) return json({ error: "Resultado não encontrado." }, 404);
      if (!safeEqual(row.delete_token_hash, await sha256(token))) {
        return json({ error: "Você só pode excluir os resultados que enviou neste aparelho." }, 403);
      }
    } else {
      const exists = await env.DB.prepare("SELECT id FROM candidatos WHERE id = ?").bind(id).first();
      if (!exists) return json({ error: "Resultado não encontrado." }, 404);
    }

    await env.DB.prepare("DELETE FROM candidatos WHERE id = ?").bind(id).run();
    return json({ ok: true });
  } catch (error) {
    console.error("DELETE candidato", error);
    return json({ error: "Não foi possível excluir. Tente novamente." }, 500);
  }
}
