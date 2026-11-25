const $ = id => document.getElementById(id);

const fields = ["portugues", "legislacao", "sus", "especificos"];
const weights = { portugues: 1, legislacao: 1, sus: 4, especificos: 4 };
const limits = { portugues: 10, legislacao: 10, sus: 5, especificos: 15 };

// Secret delete codes for entries sent from this browser: { [id]: token }
const OWN_KEY = "ranking-meus-envios";

let activeFilter = "Todos";
let candidates = [];
// A senha administrativa fica somente na memória desta aba e é enviada apenas por HTTPS.
let adminPassword = "";

const number = id => {
  const value = Number($(id).value);
  return Number.isFinite(value) ? value : 0;
};

const fmt = n => Number(n).toLocaleString("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

function ownEntries() {
  try {
    return JSON.parse(localStorage.getItem(OWN_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function saveOwnEntries(map) {
  localStorage.setItem(OWN_KEY, JSON.stringify(map));
}

function calculate() {
  let correct = 0;
  let total = 0;

  fields.forEach(id => {
    const n = number(id);
    correct += n;
    total += n * weights[id];
    $("p-" + id).textContent = fmt(n * weights[id]);
  });


  $("correct-count").textContent = `${correct} de 40 acertos`;
  $("total-score").innerHTML = `${fmt(total)} <small>pontos</small>`;

  return { correct, total };
}

fields.forEach(id => {
  $(id).addEventListener("input", () => {
    if (limits[id] !== undefined && number(id) > limits[id]) $(id).value = limits[id];
    if (number(id) < 0) $(id).value = 0;
    calculate();
  });
});

function stats(list) {
  $("total-candidatos").textContent = list.length;
  $("maior-nota").textContent = list.length
    ? fmt(Math.max(...list.map(x => x.score)))
    : "—";
  $("media-notas").textContent = list.length
    ? fmt(list.reduce((s, x) => s + x.score, 0) / list.length)
    : "—";

  const ordered = [...list].sort((a, b) => b.score - a.score);
  $("nota-corte").textContent = ordered.length
    ? fmt(ordered[Math.min(9, ordered.length - 1)].score)
    : "—";
}

function render() {
  const query = $("search").value.toLocaleLowerCase("pt-BR");
  const own = ownEntries();

  const list = candidates
    .filter(c =>
      (activeFilter === "Todos" || c.category === activeFilter) &&
      c.name.toLocaleLowerCase("pt-BR").includes(query)
    )
    .sort((a, b) => b.score - a.score);

  const body = $("ranking-body");
  body.innerHTML = "";

  if (!list.length) {
    body.innerHTML = `<tr><td colspan="6" class="empty">${
      candidates.length ? "Nenhum resultado encontrado." : "Nenhum resultado cadastrado ainda."
    }</td></tr>`;
  }

  list.forEach((c, i) => {
    const mine = Boolean(own[c.id]);
    const tr = document.createElement("tr");
    if (mine) tr.className = "mine";

    tr.innerHTML =
      `<td class="position">${i + 1}º</td><td class="name-cell"></td><td></td><td>${c.correct}/40</td><td class="score">${fmt(c.score)}</td><td class="actions"></td>`;

    const nameCell = tr.children[1];
    nameCell.textContent = c.name;
    if (mine) {
      const badge = document.createElement("span");
      badge.className = "you-badge";
      badge.textContent = "Você";
      nameCell.appendChild(badge);
    }

    tr.children[2].textContent = c.category;

    if (mine || adminPassword) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-delete";
      del.textContent = "Excluir";
      del.setAttribute("aria-label", `Excluir o resultado de ${c.name}`);
      del.addEventListener("click", () => removeEntry(c, del));
      tr.children[5].appendChild(del);
    }

    body.appendChild(tr);
  });

  stats(candidates);
}

async function load() {
  try {
    const res = await fetch("/api/candidatos", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();

    candidates = data.map(x => ({
      id: x.id,
      name: x.nome,
      category: x.modalidade,
      correct: x.acertos,
      portugues: x.portugues,
      legislacao: x.legislacao,
      sus: x.sus,
      especificos: x.especificos,
      createdAt: x.createdAt,
      score: Number(x.nota)
    }));

    // Forget delete codes for entries that no longer exist.
    const own = ownEntries();
    const ids = new Set(candidates.map(c => String(c.id)));
    let changed = false;
    Object.keys(own).forEach(id => {
      if (!ids.has(id)) { delete own[id]; changed = true; }
    });
    if (changed) saveOwnEntries(own);

    render();
  } catch {
    $("ranking-body").innerHTML =
      '<tr><td colspan="6" class="empty">Não foi possível carregar o ranking. Atualize a página para tentar novamente.</td></tr>';
  }
}

async function removeEntry(candidate, button) {
  const own = ownEntries();
  const token = own[candidate.id];
  const isAdmin = Boolean(adminPassword);
  if (!isAdmin && !token) return;

  const ok = confirm(
    `Excluir o resultado "${candidate.name}" (${fmt(candidate.score)} pontos) do ranking?\n\nEssa ação não pode ser desfeita.`
  );
  if (!ok) return;

  button.disabled = true;
  button.textContent = "Excluindo...";

  try {
    const res = await fetch(`/api/candidatos/${candidate.id}`, {
      method: "DELETE",
      headers: isAdmin
        ? { "x-admin-password": adminPassword }
        : { "x-delete-token": token }
    });

    if (res.ok || res.status === 404) {
      if (token) {
        delete own[candidate.id];
        saveOwnEntries(own);
      }
      candidates = candidates.filter(c => c.id !== candidate.id);
      render();
      $("form-message").textContent = isAdmin
        ? "Cadastro excluído pelo administrador."
        : "Seu resultado foi excluído do ranking.";
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert(data.error || "Não foi possível excluir. Tente novamente.");
  } catch {
    alert("Não foi possível excluir. Verifique sua conexão e tente novamente.");
  }

  button.disabled = false;
  button.textContent = "Excluir";
}

$("admin-button").addEventListener("click", async () => {
  if (adminPassword) {
    adminPassword = "";
    $("admin-button").textContent = "Acesso administrador";
    render();
    $("form-message").textContent = "Modo administrador encerrado nesta aba.";
    return;
  }

  const password = prompt("Digite a senha de administrador:");
  if (!password) return;

  const button = $("admin-button");
  button.disabled = true;
  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Senha incorreta ou acesso administrativo não configurado.");
      return;
    }
    adminPassword = password;
    button.textContent = "Sair do administrador";
    $("form-message").textContent = "Modo administrador ativado. Agora você pode excluir qualquer cadastro.";
    render();
  } catch {
    alert("Não foi possível validar a senha. Verifique sua conexão.");
  } finally {
    button.disabled = false;
  }
});

$("candidate-form").addEventListener("submit", async e => {
  e.preventDefault();

  calculate();

  const name = $("candidate-name").value.trim();
  const category = $("category").value;

  if (!name) {
    $("form-message").textContent = "Informe seu nome ou identificação.";
    return;
  }

  const button = $("candidate-form").querySelector('button[type="submit"]');
  button.disabled = true;
  $("form-message").textContent = "Enviando resultado...";

  try {
    const res = await fetch("/api/candidatos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nome: name,
        modalidade: category,
        portugues: number("portugues"),
        legislacao: number("legislacao"),
        sus: number("sus"),
        especificos: number("especificos")
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      $("form-message").textContent = data.error || "Erro ao enviar. Tente novamente.";
      return;
    }

    const own = ownEntries();
    own[data.id] = data.deleteToken;
    saveOwnEntries(own);

    $("form-message").textContent =
      "Resultado enviado ao ranking! Se precisar, você pode excluí-lo pelo botão “Excluir” na tabela.";

    await load();
  } catch {
    $("form-message").textContent = "Ocorreu um erro ao enviar o resultado. Tente novamente.";
  } finally {
    button.disabled = false;
  }
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeFilter = btn.dataset.filter;
    render();
  });
});

$("search").addEventListener("input", render);


function csvCell(value) {
  let text = String(value ?? "");
  // Prevent spreadsheet formula execution when a CSV is opened in Excel/Sheets.
  if (/^[\s]*[=+@\-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

$("backup-button").addEventListener("click", async () => {
  const button = $("backup-button");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Preparando...";

  try {
    // Fetch the complete current ranking, regardless of active tab or search filter.
    const res = await fetch("/api/candidatos", { cache: "no-store" });
    if (!res.ok) throw new Error("Não foi possível consultar o ranking.");
    const rows = await res.json();
    const header = ["Posição", "Nome", "Modalidade", "Português", "Legislação", "SUS", "Específicos", "Acertos totais", "Nota", "Data do cadastro"];
    const lines = [header, ...rows.map((x, i) => [
      i + 1, x.nome, x.modalidade, x.portugues, x.legislacao, x.sus,
      x.especificos, x.acertos, Number(x.nota).toFixed(2).replace(".", ","), x.createdAt
    ])];
    const csv = "\uFEFF" + lines.map(line => line.map(csvCell).join(";" )).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toLocaleDateString("sv-SE");
    link.href = url;
    link.download = `backup-ranking-farmaceutico-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    button.textContent = "Backup baixado!";
  } catch (error) {
    alert(error.message || "Erro ao gerar o backup. Tente novamente.");
    button.textContent = originalText;
  } finally {
    button.disabled = false;
    setTimeout(() => { button.textContent = originalText; }, 2500);
  }
});

$("share-button").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $("share-button").textContent = "Link copiado!";
  } catch {
    $("share-button").textContent = "Copie o endereço do navegador";
  }
});

calculate();
load();
