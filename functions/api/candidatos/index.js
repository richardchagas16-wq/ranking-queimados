const LIMITS = { portugues: 10, legislacao: 10, sus: 5, especificos: 15 };
const WEIGHTS = { portugues: 1, legislacao: 1, sus: 4, especificos: 4 };
const MODALIDADES = new Set(["Ampla concorrência", "Cotas"]);

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});

function toInt(value, max) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function newToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function onRequestGet({ env }) {
  try {
    const { results = [] } = await env.DB.prepare(
      `SELECT id, nome, modalidade,
        (acertos_portugues + acertos_legislacao + acertos_sus + acertos_especificos) AS acertos,
        nota_total AS nota, created_at AS createdAt
       FROM candidatos ORDER BY nota_total DESC, created_at ASC, id ASC`
    ).all();
    return json(results);
  } catch (error) {
    console.error("GET candidatos", error);
    return json({ error: "Não foi possível carregar o ranking." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Requisição inválida." }, 400); }

    const nome = String(body.nome ?? "").trim().replace(/\s+/g, " ");
    if (!nome || nome.length > 60) return json({ error: "Informe um nome ou identificação com até 60 caracteres." }, 400);

    const modalidade = String(body.modalidade ?? "");
    if (!MODALIDADES.has(modalidade)) return json({ error: "Modalidade inválida." }, 400);

    const acertos = {};
    for (const key of Object.keys(LIMITS)) {
      const n = toInt(body[key], LIMITS[key]);
      if (n === null) return json({ error: "Número de acertos inválido." }, 400);
      acertos[key] = n;
    }

    const nota = Object.keys(WEIGHTS).reduce((sum, key) => sum + acertos[key] * WEIGHTS[key], 0);
    const deleteToken = newToken();
    const deleteTokenHash = await sha256(deleteToken);

    const result = await env.DB.prepare(
      `INSERT INTO candidatos
       (nome, modalidade, acertos_portugues, acertos_legislacao, acertos_sus, acertos_especificos, nota_total, delete_token_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(nome, modalidade, acertos.portugues, acertos.legislacao, acertos.sus, acertos.especificos, nota, deleteTokenHash).run();

    return json({ id: result.meta.last_row_id, deleteToken }, 201);
  } catch (error) {
    console.error("POST candidatos", error);
    return json({ error: "Erro interno ao salvar. Tente novamente." }, 500);
  }
}
