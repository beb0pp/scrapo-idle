# Arquitetura

## Stack

- **Cliente**: TypeScript + Phaser 3.90 + Vite 7. Phaser cuida de cenas, câmera, input, física arcade, sprites e tilemaps. Painéis e HUD são DOM com CSS, por cima do canvas.
- **Mapas**: formato JSON do Tiled (`public/maps/*.json`) com tileset PNG em `public/tiles/scrapo-tiles.png`.
- **Testes**: Vitest para as regras puras (`npm test`).
- **Sem servidor** nesta fase. Backend planejado em C# + ASP.NET Core + PostgreSQL (ver abaixo).

Decisão: Phaser 3.90 em vez de Phaser 4. A API do 3.x é estável e muito documentada. A migração para o 4 fica para quando o protótipo estabilizar.

## Organização do código

```
src/
  data/        catálogos com IDs estáveis: items, recipes, areas (AFK + tabelas de pilhas), vendor
  core/        regras puras, sem Phaser nem DOM (testadas)
    state.ts     GameState, inventário (removeItems é tudo-ou-nada)
    economy.ts   craft, equip/unequip, dismantle, sell, buy → Result
    afk.ts       sessão AFK: start, computeProgress, settleFull, endAfk, finalizeAfterReload, claimAfk
    derived.ts   valores derivados do equipamento (raio do pulso, saltos do arco, carga do drone)
    save.ts      parse/validação do save versionado no limite de entrada
    rng.ts       mulberry32 + rolagem em tabelas
  session.ts   dono único do GameState: aplica regras, salva, notifica a UI, relógio AFK
  art/
    tileArt.ts   pintura dos tiles em raster puro (roda no Node e no navegador)
    sprites.ts   sprites de personagens, inimigos, drone, ícones (canvas)
  game/
    enemies.ts   robôs de triagem, prensador, Guindaste de Arrasto
    pathfind.ts  A* em grade para o clique-para-andar (testado)
  scenes/      Boot → Title → World(mapId) ⇄ Extraction
  ui/          HUD, painéis (inventário, oficina, comércio, terminal), modal, painel de extração
tools/
  build-maps.ts  gera o tileset PNG e os mapas Tiled iniciais
```

**Regra de dependência**: `data` ← `core` ← `session` ← `ui`/`scenes`. As cenas nunca mexem no estado direto; chamam `session.run(op)` ou `session.mutate(fn)`, que salvam e notificam a UI.

## Cenas

| Cena | Papel |
|---|---|
| `Boot` | carrega tileset e mapas, gera sprites, monta HUD e painéis |
| `Title` | menu (Jogar/Continuar, Apagar progresso), introdução, desvio para extração pendente |
| `World` | um mapa por vez (`patio`, `yard`, `dungeon`). Movimento por clique (A*) ou teclado, habilidades, pilhas, drone, saídas, chefe. Pausa a física enquanto um painel está aberto |
| `Extraction` | diorama da área com o drone animado a partir do relógio da sessão; painel lateral com estado, carga, ciclo e achados |

## Formato dos mapas (Tiled)

Cada mapa tem quatro camadas com nomes fixos:

| Camada | Tipo | Conteúdo |
|---|---|---|
| `terrain` | tile | chão: terra, grama, cascalho, trilhos, concreto, piso, esteira |
| `objects` | tile | o que fica de pé ou no chão por cima do terreno (vagões, sucata, cercas, decalques) |
| `collision` | tile, oculta | qualquer tile não vazio bloqueia |
| `interact` | objetos | pontos de jogo, pelo `type` do objeto (abaixo) |

Tipos de objeto em `interact`:

| `type` | `name` | Propriedades |
|---|---|---|
| `spawn` | id da entrada (`default`, `from_yard`…) | — |
| `exit` | — | `target` (id do mapa), `entry` (spawn de destino), `label` |
| `pile` | id estável da pilha | `loot` (tabela em `data/areas.ts`), `special` opcional (`first_wagon`) |
| `enemy` | — | `kind`: `sorter` ou `press` |
| `boss` | `crane` | `kind`: `crane` |
| `workbench`, `vendor`, `terminal` | — | — |
| `note` | — | `text` (placa legível) |

Fluxo para áreas novas: gere uma base com `tools/build-maps.ts` (ou crie direto no Tiled usando `public/tiles/scrapo-tiles.png`, tileset `scrapo`, firstgid 1). Depois edite no Tiled e registre o id em `BootScene` e no tipo `MapId`. `npm run maps` **não** sobrescreve mapas existentes; só com `--force`. O tileset PNG é sempre regenerado a partir de `src/art/tileArt.ts`.

O gerador verifica por BFS se todo spawn, pilha, inimigo e NPC é alcançável a partir da entrada, e falha se não for.

## Dados

- IDs estáveis em inglês snake_case (`gear`, `mod_magnet`, `rcp_drone_spark`, `afk_sorting`, `offer_bp_cargo`). Nomes exibidos ficam só nos catálogos.
- Itens: `kind` (scrap, component, part, module, upgrade, drone, relic), `sell`, `dismantle`, `slot`.
- Receitas: `inputs`, `output`, `requiresFlag`, `equipsOutput`/`installs` (o drone sai montado com a Garra instalada).
- Tabelas de loot com peso, mínimo e máximo, e marca `rare` (afetada pelo Módulo Magnético).

## Persistência

- `localStorage['scrapo.save']`, JSON com `version: 1`.
- `parseSave` valida no limite: IDs de item desconhecidos são descartados, números são checados, save corrompido ou de versão desconhecida vira jogo novo. Futuras versões entram como migração `vN → vN+1` nesse mesmo ponto.
- Salvo a cada mudança de estado, a cada 2 s durante extração (heartbeat) e no `pagehide`.
- Estado só de execução, não salvo: vida atual, pilhas esgotadas, posição no mapa.
- Preferência de zoom: `localStorage['scrapo.zoomBias']`.

Esse progresso local serve ao teste e **não** entra na futura economia compartilhada.

## Regras da sessão AFK

- `AfkSession = { id, areaId, startedAt, cycleMs, capacity, rareFactor, seed, endedAt, endReason }`. Capacidade e fator de raros ficam congelados no início.
- **O resultado é uma função pura de `(sessão, agora)`.** O ciclo `i` usa `mulberry32(mix(seed, i))`. Por isso:
  - timers desacelerados em aba de fundo não alteram o resultado, só o momento em que a UI atualiza;
  - ao voltar o foco (`visibilitychange`), a UI se refaz a partir do relógio;
  - a animação do drone na cena de extração também é derivada do relógio.
- `settleFull` fecha a sessão no instante exato do ciclo que encheu a carga.
- **Fechar a aba**: o heartbeat (`lastHeartbeat`) é salvo a cada 2 s e no `pagehide`. No próximo carregamento, `finalizeAfterReload` encerra a sessão em `min(agora, lastHeartbeat)` com motivo `tab_closed`. Só contam os ciclos concluídos até ali. Não há produção offline.
- **Coleta única**: `claimAfk` encerra, entrega o loot, zera `afk` e grava o id em `claimedSessions` (últimos 20). Uma cópia antiga da mesma sessão não entrega nada.
- Uma sessão por vez. Retomar o controle encerra (`manual_control`) e recolhe.

## Transição para o backend

**Quando**: antes da fase de persistência online e, obrigatoriamente, antes de abrir o mercado entre jogadores.

**Estrutura planejada**

```
server/
  Scrapo.Api/          ASP.NET Core (minimal APIs), autenticação, endpoints
  Scrapo.Domain/       regras portadas de src/core (receitas, loot, AFK), sem IO
  Scrapo.Infrastructure/ EF Core + PostgreSQL, migrações
  Scrapo.Tests/
```

Tabelas iniciais: `accounts`, `characters`, `inventory_items (character_id, item_id, qty)`, `wallets`, `afk_sessions`, `ledger_entries` (toda movimentação de item e moeda, com idempotency key).

**Autoridade do servidor** sobre inventário, moeda, fabricação e recompensas negociáveis:

- O cliente envia intenções (`craft rcp_x`, `sell gear 3`, `start afk area`, `claim afk id`); o servidor valida contra o estado dele e responde com o novo estado.
- A AFK no servidor reutiliza o mesmo modelo: `startedAt`, `seed` e capacidade gerados e guardados no servidor; o resultado é calculado no servidor no `claim`. Sessões ativas são identificadas por um heartbeat do cliente (ex.: a cada 30 s); sem heartbeat por N minutos, o servidor encerra em `lastHeartbeat`, a mesma regra de hoje.
- Combate que gera recompensa compartilhável (drops de miniboss) é validado no servidor por plausibilidade: tempo mínimo de luta, área desbloqueada, limite de recompensas por janela.
- O save local do protótipo não migra para a economia compartilhada.

**Mercado (fase posterior), sempre em transação atômica**

- Anunciar: retira o item do inventário e cria `listing` com o item **reservado**.
- Comprar: numa única transação, debita o comprador, credita o vendedor, transfere o item e fecha o anúncio (`SELECT … FOR UPDATE` no anúncio).
- Cancelar: devolve o item reservado e fecha o anúncio.
- Toda operação grava `ledger_entries` com chave de idempotência.
