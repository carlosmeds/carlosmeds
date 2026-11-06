# Stats card

Card próprio de estatísticas de contribuição do GitHub, gerado como SVG por GitHub Actions e
servido pelo próprio GitHub. Substitui o `github-readme-streak-stats` (Heroku) sem servidor,
banco de dados ou serviço de terceiros.

```
main                                   generated (órfã, só arquivos gerados)
├── src/            código TS           ├── README.md
├── test/           testes              └── assets/
├── scripts/publish.sh                      ├── streak-light.svg
├── stats.config.json                       ├── streak-dark.svg
├── .github/workflows/                      ├── streak-compact-light.svg
│   ├── update-stats.yml  (diário)          └── streak-compact-dark.svg
│   └── keepalive.yml     (mensal)
└── README.md  ──── referencia ────────────▶ raw.githubusercontent.com/.../generated/assets/*.svg
```

## Como funciona

1. `update-stats.yml` roda todo dia às 04:17 (America/Sao_Paulo) ou manualmente.
2. Faz checkout da `main`, instala dependências e roda lint, typecheck e testes.
3. `src/github/` consulta a API GraphQL oficial, **um ano por consulta** (o limite da API é
   1 ano por janela), do primeiro ano com contribuições até hoje.
4. Cada janela é conferida contra o `totalContributions` que o próprio GitHub informa; se a
   soma dos dias divergir, a execução falha e nada é publicado.
5. Os dias são unificados (datas duplicadas são consolidadas, conflitos abortam), as métricas
   são calculadas e os 4 SVGs são renderizados e validados (XML bem formado, `viewBox`,
   textos esperados, nada de `NaN`/scripts).
6. `scripts/publish.sh` monta um commit na `generated` via plumbing do git (sem tocar na
   `main` nem no working tree), como `github-actions[bot]`, **só se algum SVG mudou**, e faz
   push só para `generated`.

| Módulo | Responsabilidade |
| --- | --- |
| `src/github/client.ts` | Cliente GraphQL: auth, retries, rate limit, redação de tokens |
| `src/github/contributions.ts` | Busca ano a ano e validação contra os totais do GitHub |
| `src/contributions.ts` | Merge/deduplicação dos dias |
| `src/streaks.ts` | Current/longest streak, `excludeWeekends` |
| `src/stats.ts` | Total, dias ativos, média |
| `src/format.ts` | Números e intervalos de datas |
| `src/config.ts` | Leitura e validação do `stats.config.json` |
| `src/svg/` | Temas e renderização |
| `src/validate.ts` | Barreiras antes de publicar |
| `src/cli.ts` | Ponto de entrada |

## Métricas

- **Total Contributions**: soma de todos os dias do calendário de contribuições (o mesmo
  número que aparece no perfil, incluindo contribuições privadas quando o GitHub as expõe).
- **Active Days**: dias com pelo menos 1 contribuição.
- **Contributions / Active Day**: total ÷ dias ativos, 1 casa decimal.
- **Current Streak**: dias consecutivos com contribuição terminando hoje. Hoje ainda não
  acabou, então um "hoje" zerado não quebra o streak (ele termina ontem).
- **Longest Streak**: maior sequência em todo o histórico (em empate, vale a mais recente).

### Datas e fuso horário

O GitHub devolve datas de calendário (`YYYY-MM-DD`) sem fuso. Elas são usadas como vêm, e toda
a aritmética é feita em UTC, então horário de verão, anos bissextos e virada de ano não
deslocam dias. O `timezone` da configuração (padrão `America/Sao_Paulo`) só decide qual data
é "hoje". Se o calendário já estiver no dia seguinte em UTC, esse dia também não quebra o
streak.

### `excludeWeekends`

`false` (padrão): sábados e domingos contam como qualquer outro dia.

`true`: um sábado ou domingo **sem** contribuição é ignorado (não quebra nem soma). Um sábado
ou domingo **com** contribuição soma no tamanho do streak, porque você contribuiu naquele dia.
Assim, sexta → segunda continua o streak. Total, Active Days e média não mudam.

Para ativar: `"excludeWeekends": true` no `stats.config.json` (ou a variável
`STATS_EXCLUDE_WEEKENDS=true`).

## Executar localmente

Requer Node 20+ (o CI usa a versão do `.nvmrc`).

```bash
npm ci
npm run check              # lint + typecheck + testes
npm run preview            # SVGs com dados de exemplo em ./out (sem token)
GH_STATS_TOKEN=<token> npm run generate   # dados reais em ./out
```

Opções: `node dist/cli.js --help` (`--out`, `--config`, `--sample`, `--today YYYY-MM-DD`).
Para publicar manualmente na `generated` (normalmente só o Actions faz isso):
`scripts/publish.sh out` (use `PUBLISH_DRY_RUN=1` para criar o commit sem push).

## Token

O workflow usa o `GITHUB_TOKEN` automático, com `contents: write` só para fazer push na
`generated`. Ele lê o calendário público, que **já inclui as contribuições privadas como
contagens anônimas** quando o perfil tem *Settings → Public profile → Contributions & activity
→ "Include private contributions on my profile"* ativado (é o caso deste perfil).

Só é preciso um token pessoal se essa opção estiver desligada e você quiser as contribuições
privadas no card:

1. Crie um token *fine-grained* em *Settings → Developer settings → Personal access tokens*,
   só deste usuário, acesso **Public repositories (read-only)**, sem permissões extras, com
   validade definida. Se os números privados não aparecerem, use um *classic* com o escopo
   `read:user`.
2. No repositório: *Settings → Secrets and variables → Actions → New repository secret*,
   nome `GH_STATS_TOKEN`.

Se `GH_STATS_TOKEN` existir, ele tem prioridade. O token nunca vai para código, SVG ou log: o
GitHub mascara secrets nos logs e o cliente também redige qualquer coisa com formato de token
nas mensagens de erro.

## GitHub Actions

- Ativar: aba *Actions* do repositório → habilitar workflows, se pedir.
- Rodar agora: *Actions → Update stats card → Run workflow* (ou
  `gh workflow run update-stats.yml`).
- Na primeira execução a branch `generated` é criada. Até lá as imagens do README ficam
  quebradas.
- `concurrency` impede duas execuções simultâneas, e o push não usa force: se a branch mudar
  no meio da execução, o push falha em vez de sobrescrever.

### Atrasos e desativação

- O `schedule` do GitHub não é pontual: execuções podem atrasar minutos ou horas e, em picos,
  ser descartadas.
- Em repositório público, workflows agendados são **desativados após 60 dias sem atividade
  no repositório**. Para verificar: *Actions → (workflow)* mostra um aviso, ou
  `gh workflow list --all` mostra `disabled_inactivity`. Para reativar: botão *Enable workflow*
  ou `gh workflow enable update-stats.yml`.

### Keepalive

`keepalive.yml` roda no dia 1 de cada mês (intervalo de 28 a 31 dias) e chama o endpoint
oficial `PUT /repos/{owner}/{repo}/actions/workflows/{id}/enable` para `update-stats.yml` e
para ele mesmo. É a mesma ideia do modo API do `gautamkrishnar/keepalive-workflow`, sem
depender da Action dele: sem commits artificiais, sem tocar em branch nenhuma, só com
`actions: write`. Falhas aparecem como erro no job (e o GitHub manda e-mail de falha).

Limitações, sendo honesto:

- A documentação oficial do endpoint diz apenas que ele "ativa o workflow". **Não está
  documentado** que chamá-lo num workflow já ativo zera o contador de 60 dias. É a premissa do
  modo API do keepalive-workflow, mas não pude confirmá-la, e o GitHub pode mudar isso a
  qualquer momento.
- O repositório `gautamkrishnar/keepalive-workflow` foi **desativado pelo GitHub por violação
  dos termos de uso** (verificado em nov/2026). A variante que ele tinha por commits
  artificiais é a mais óbvia candidata a isso; a variante por API não cria atividade falsa,
  mas não há garantia oficial de que o GitHub a aprove. Se preferir zero risco, apague
  `keepalive.yml` e reative manualmente quando necessário.
- Se o próprio keepalive for desativado, ele não consegue se reativar. Por isso o intervalo
  (~30 dias) fica bem abaixo dos 60.
- Na prática, o próprio `update-stats.yml` gera atividade legítima: cada dia em que os números
  mudam ele faz push na `generated`. Com contribuições frequentes isso por si só já deve manter
  os agendamentos vivos. O keepalive cobre períodos longos sem mudança.

## A branch `generated`

- Branch órfã (não compartilha histórico com a `main`) contendo só `assets/*.svg` e um
  README explicativo.
- Commits por `github-actions[bot]`: não contam como suas contribuições, e commits fora da
  branch padrão também não contariam. O card não infla suas estatísticas.
- Nunca faça merge dela na `main`. Pode apagá-la sem medo: a próxima execução a recria.

## README

O snippet usa `<picture>`:

```html
<p align="center">
  <picture>
    <source media="(max-width: 560px) and (prefers-color-scheme: dark)" srcset=".../streak-compact-dark.svg" />
    <source media="(max-width: 560px)" srcset=".../streak-compact-light.svg" />
    <source media="(prefers-color-scheme: dark)" srcset=".../streak-dark.svg" />
    <img src=".../streak-light.svg" alt="..." />
  </picture>
</p>
```

Base dos caminhos: `https://raw.githubusercontent.com/<user>/<user>/generated/assets/`.
O `<img>` é o fallback para renderizadores sem suporte a `<picture>` (tema claro, layout largo).

### Responsividade e limitações

- O GitHub remove `style`, CSS e JavaScript do README. Sobram atributos HTML e `<picture>`.
  O sanitizador mantém `media` com largura e tema (verificado com a API `/markdown`).
- O card tem duas linhas em ambos os layouts: 3 colunas (Total | Current Streak | Longest)
  e 2 colunas (Active Days | Contributions / Active Day). Nada é empilhado.
- **Largo**: 500×220, proporção próxima do GitHub Readme Streak Stats. O `<img>` não tem
  `width`: o tamanho vem do próprio SVG (`width`/`height` + `viewBox`), e o GitHub aplica
  `max-width: 100%`, então o card encolhe proporcionalmente quando a coluna é mais estreita.
- **Compacto**: 330×200, mesma estrutura, com margens menores e tipografia relativamente
  maior. É escolhido por `max-width: 560px`. Num celular (coluna de ~308px) o card largo
  ficaria com legendas de ~7px; o compacto fica em ~9–10px. Esse é o limite físico de 3
  colunas lado a lado nessa largura sem empilhar.
- Cada papel de texto (números, títulos, datas, legendas) usa **um único tamanho por linha**.
  Se um valor for longo demais para a coluna (ex.: `Dec 30, 2026 – Jan 2, 2027` ou números
  de 6 dígitos), o tamanho daquele papel diminui em todas as colunas, em vez de cortar ou
  sobrepor. A largura é estimada, porque o SVG em `<img>` não mede texto, e a estimativa é
  conservadora.
- A media query avalia a largura da **janela**, não da coluna do README. Perto de 560px o
  card largo pode aparecer levemente reduzido.
- Dentro de `<img>` o SVG não carrega fontes externas. Usamos a pilha de fontes do sistema
  (a mesma do GitHub), então a tipografia varia levemente entre sistemas. O layout tem folga
  para isso.
- Imagens passam pelo cache (camo) do GitHub e do `raw.githubusercontent.com` (~5 min). Uma
  atualização pode demorar alguns minutos para aparecer.
- O GitHub Mobile e alguns clientes podem ignorar `prefers-color-scheme`. Nesse caso aparece
  o tema claro do fallback.

## Personalizar

`stats.config.json`:

```json
{
  "username": "carlosmeds",
  "timezone": "America/Sao_Paulo",
  "excludeWeekends": false,
  "allowEmpty": false,
  "accent": "#f97316",
  "themes": {
    "light": { "muted": "#59636e" },
    "dark": { "background": "#0d1117" }
  }
}
```

- `accent` troca o laranja em todos os detalhes, nos dois temas.
- `themes.light` / `themes.dark` aceitam `background`, `border`, `divider`, `text`, `label`,
  `muted`, `accent` (hex) e `accentSoftOpacity` (0–1, fundo dos ícones). Os padrões ficam em
  `src/svg/theme.ts`.
- `allowEmpty`: por segurança, um card com 0 contribuições não é publicado (geralmente indica
  problema de API ou auth). Ative só para perfis realmente vazios.

### Usar em outro perfil

1. Copie `src/`, `scripts/`, `test/`, os arquivos de config na raiz (`package*.json`,
   `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`, `.nvmrc`, `stats.config.json`) e
   `.github/workflows/` para o repositório `<usuario>/<usuario>`.
2. Troque `username` no `stats.config.json`.
3. Troque `carlosmeds/carlosmeds` pelas URLs do novo repositório no snippet do README.
4. Rode o workflow manualmente uma vez.

## Solução de problemas

| Sintoma | Causa provável / solução |
| --- | --- |
| `401 Unauthorized` | `GH_STATS_TOKEN` expirado ou inválido. Gere outro ou apague o secret para usar o `GITHUB_TOKEN`. |
| `token contains whitespace` | O secret foi colado com quebra de linha no meio. Recrie o secret. |
| `403` / `rate limit` | O cliente espera até 5 min e tenta de novo. Se o reset estiver mais longe, a execução falha e as imagens anteriores continuam publicadas. |
| `Refusing to publish an all-zero card` | A API devolveu zero contribuições. Normalmente é auth ou o usuário errado em `username`. |
| `Validation failed for <ano>` | A soma dos dias divergiu do total do GitHub. É transitório: rode de novo. |
| Push para `generated` rejeitado | Outra execução publicou no meio. Rode de novo. Confira se *Settings → Actions → General → Workflow permissions* permite escrita (o workflow já pede `contents: write`). |
| Imagens quebradas no README | A branch `generated` ainda não existe: rode o workflow. |
| Números privados faltando | Ative "Include private contributions on my profile" ou configure o `GH_STATS_TOKEN`. |
| Workflow parou de rodar | Veja "Atrasos e desativação" acima. |
