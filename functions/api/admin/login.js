const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return json({ error: "A senha de administrador ainda não foi configurada no Cloudflare." }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return json({ error: "Requisição inválida." }, 400); }
  const password = typeof body.password === "string" ? body.password : "";
  if (!safeEqual(password, env.ADMIN_PASSWORD)) {
    return json({ error: "Senha de administrador incorreta." }, 401);
  }
  return json({ ok: true });
}
