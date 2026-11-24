RANKING FARMACÊUTICO — QUEIMADOS 2026
Versão adaptada para Cloudflare Pages Functions + Cloudflare D1.

IMPORTANTE SOBRE A PONTUAÇÃO
A fórmula do projeto original é:
Português (0–10) + Legislação (0–10) + SUS (0–5 × 4) + Específicos (0–15 × 4).
A pontuação máxima matemática é 100 pontos (10 + 10 + 20 + 60), não 110.
Não existe campo nem pontuação de títulos nesta versão.

ESTRUTURA
- public/: site estático
- functions/api/candidatos/index.js: consulta e cadastro
- functions/api/candidatos/[id].js: exclusão protegida por token secreto
- migrations/0001_create_candidatos.sql: estrutura do banco D1

PUBLICAÇÃO RECOMENDADA
Esta versão NÃO deve ser enviada pelo botão de upload de arquivos estáticos/drag-and-drop, porque esse método não publica as Pages Functions com a API.
Use a integração Git (GitHub) do Cloudflare Pages:
1. Crie um repositório GitHub e envie o conteúdo desta pasta (os arquivos e pastas internos, não a pasta externa).
2. Cloudflare > Workers & Pages > Create application > Pages > Connect to Git.
3. Selecione o repositório.
4. Build command: deixe vazio.
5. Build output directory: public.
6. Deploy.
7. No projeto Pages, Settings > Functions > D1 database bindings, adicione:
   Variable name: DB
   D1 database: selecione o banco criado para o ranking.
8. Crie o banco D1 em Storage & databases > D1 SQL Database e execute todo o conteúdo de migrations/0001_create_candidatos.sql no console SQL desse banco.
9. Faça novo deploy depois de configurar a binding.

SEGURANÇA E LIMITAÇÕES
- A nota é recalculada no servidor; o navegador não escolhe a nota final.
- O token de exclusão em texto puro é entregue uma única vez ao navegador que enviou o registro; no banco fica apenas o SHA-256.
- Se a pessoa apagar os dados do navegador ou trocar de aparelho, perde o botão de exclusão daquele envio.
atualizacao.
- Não existe login/verificação de identidade: o sistema garante que só quem tem o token daquele envio consegue excluí-lo, não prova que o nome informado pertence à pessoa.
- Os registros do banco antigo da Netlify NÃO são transferidos por este pacote. Não apague nem encerre o banco antigo antes de decidir como exportar os registros.
- Plano gratuito tem cotas e não garante disponibilidade ilimitada; acompanhe o uso no painel da Cloudflare.
