# Multiplayer: arquitetura do servidor (ADR-0001)

- **Status:** proposto, 2026-11-19. Registrado para depois: o foco atual é jogabilidade single-player; o multiplayer começa quando a jogabilidade e a estrutura estiverem prontas.
- **Contexto:** o Scrapo é só cliente (Phaser 3 + Vite + TS) com save local. Queremos um ecossistema online: contas, mercado entre jogadores, oficinas (guilds), eventos coletivos. A referência estudada (PokeIdle) usa um WebSocket único com servidor autoritativo, estado por snapshot + delta, relógio do servidor e eventos de massa simulados no servidor e reproduzidos como "fita".
- **Decisão:** servidor Node/TS que reaproveita as regras puras de `src/core` num pacote compartilhado, modelo autoritativo em camadas e entrega em fases, como abaixo.
- **Consequências:** a Fase 0 move `src/core` para `packages/core` e exige rebase de todas as branches abertas; fazer num momento combinado entre as sessões. Mecânicas single-player: ver [MECANICAS_IDLE.md](MECANICAS_IDLE.md).

## Decisão: servidor do Scrapo

### Princípios (tirados do que funciona em idle online)
1. **Mesmas regras nos dois lados.** Jogos idle online maduros compartilham regras, constantes e validadores entre cliente e servidor. O Scrapo já tem isso de graça: `src/core/*.ts` são regras **puras** (`afk.ts` é função pura de `(sessão, agora)`, `economy.ts`, `progression.ts`, `rng.ts` seedável). Basta publicá-las como pacote compartilhado e importar no servidor.
2. **Servidor decide, cliente desenha e adivinha só o que é barato.** Nós podemos prever localmente o que é puro (cálculo de loot do terminal AFK, validação de receita) e deixar o servidor ser a verdade.
3. **Eventos longos como fita.** Colosso semanal, PvP, guerra: o servidor simula e grava; o cliente reproduz. Zero WebSocket em tempo real para eventos de massa.
4. **Tempo é do servidor.** Todo timer (extração, bancada, boost, passe, semana) usa um relógio autoritativo e o cliente sincroniza `desvio = agoraLocal − servidorAgora`.
5. **Duas moedas.** Créditos de sucata (ganhos jogando, com sumidouros) e **gemas** (compradas com USDT via Solana). Ver "Gemas e pagamentos".

### Stack sugerida
| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | Node 22 + TypeScript (o mesmo do cliente) | importa `src/core` direto |
| Repositório | Monorepo `packages/core` (regras puras), `packages/protocol` (tipos + validação), `apps/web` (Phaser), `apps/server` | uma só definição de tipos de mensagem |
| HTTP/WS | Fastify + `ws` (ou uWebSockets.js se precisar de escala) | REST para conta, WS para jogo |
| Validação | Zod (ou Valibot) nos schemas de `protocol` | valida no limite, "parse once" |
| Banco | PostgreSQL (contas, inventário, mercado, guilds, rankings) + Redis (sessões, filas, rate limit, pub/sub) | transações para mercado |
| Jobs | BullMQ (ou `pg-boss`) | fechamentos semanais, expiração, guerra diária |
| Fitas/estáticos | Object storage + CDN (R2/S3) | `fita.json` imutável com hash no nome |
| Auth | e-mail+senha (argon2) com captcha leve, ou OAuth; token de sessão rotativo | |
| Observabilidade | pino + métricas Prometheus + `/saude` com `versao` | |

### Modelo autoritativo
**Servidor valida (sempre):** posse e quantidade de itens; custo de craft e compra; fim de sessão AFK (resultado = `computeProgress(sessao, agoraServidor)` com semente guardada no servidor); XP e nível (`grantXp`); cooldowns; limites de bolsa; mercado, trocas e guild; prêmios semanais; unicidade (peças únicas).
**Cliente mantém (sem confiar):** combate em tempo real do modo manual e do Auto no mundo (Phaser), movimento, câmera, animação, UI.
Para não "punir" o jogo de ação, adote **modelo híbrido por camadas**:
- **Camada A, autoritativa e barata:** economia, inventário, terminal AFK, bancada offline, mercado, guild, rankings, passe diário.
- **Camada B, confiada com auditoria:** o resultado de combate do mundo (XP, drops) é **enviado em lotes** com um *resumo assinável* (sementes e contagens) e o servidor aplica **tetos por minuto** (XP/min, drops/min calculados a partir das tabelas de `data/`). Quem excede o teto é recortado.
- **Camada C, replay verificável (fase 3+):** para eventos competitivos (colosso, placar), o servidor **re-simula** a luta com a mesma `rng` e as mesmas regras puras e grava a fita.

### Protocolo
- Mensagem `{t, id?, ...}`; resposta `{t:'ok'|'erro', id, chave, params}`. `chave` é i18n (o servidor nunca manda texto).
- `hello{token, dispositivo, delta:1, versaoCliente}` → `welcome{constantes, estado, servidorAgora}`; depois `estado` parcial (só o que mudou no inventário e no mundo).
- `ping` 25 s; vigia 30 s; backoff com jitter e código especial de reinício.
- Fechamento: `4001` sessão substituída, `4003` bloqueio, `1012` reinício.
- **Ações idempotentes**: cada pedido leva `reqId`; o servidor guarda o último resultado por `reqId` por 5 min (reconexão no meio de um `market.comprar` não duplica).
- Versão do protocolo no `hello`; o servidor responde `versaoNova` para forçar recarga.
- Domínios iniciais: `conta`, `inv` (equip/craft/vender/desmontar), `afk` (iniciar/coletar), `mercado`, `amigo`, `oficina` (guild), `rank`, `evento`, `chat`.

### Persistência
- Tabelas: `conta`, `sessao`, `personagem` (nível, xp, ferromancia JSON), `item_stack`, `peca` (instância única com qualidade/nota), `afk_sessao`, `bancada_job`, `mercado_anuncio`, `mercado_historico`, `amigo`, `oficina`, `oficina_membro`, `oficina_cofre_log`, `evento_semanal`, `evento_participacao`, `rank_snapshot`, `reqid_cache`, `auditoria`.
- Mercado: transação única `SELECT ... FOR UPDATE` no anúncio + saldos; **escrow** = peça sai do inventário ao anunciar (`estado = 'anunciada'`).
- Inventário em formato "linha por stack" e "linha por peça única"; enviar para o cliente só diferenças.

### Migração do save local para conta
1. O cliente continua jogando offline com `scrapo.save` (versões 1, 2 e atual em `save.ts`).
2. Ao criar conta: `POST /conta/importar {save, assinaturaLocal}`. O servidor **não confia** no save: roda `parseSave` (mesma função), valida schema, aplica **normalização por teto** (créditos, nível e itens máximos plausíveis para o tempo declarado e o número de sessões) e cria o personagem com `origem:'importado'`.
3. Peças de qualidade/única ficam marcadas "importadas" e **não podem ir ao mercado** nos primeiros N dias (corta o abuso de editar o localStorage).
4. Depois da importação, o save local vira **cache**: `GET /estado` substitui; edições locais são ignoradas. Mantém modo offline "sem conta" para quem não quer online.
5. Guardar `saveVersion` e migrar pelo servidor (um único lugar).

### Mercado entre jogadores
- Moeda: **gemas** para o mercado entre jogadores; créditos continuam para a vendedora e a oficina. Regras de saque/conversão das gemas: ver "Gemas e pagamentos".
- Itens elegíveis: **peças com nota alta** e núcleos; peças calibradas e únicas fora.
- Regras anti-abuso copiadas na ideia: **retenção curta** (1 a 2 min) antes de poder comprar; **lotes** de compra com cotação; **limite de anúncios** por conta; **cooldown de reanúncio**; **taxa regressiva** por faixa (sumidouro); **preço mínimo** para o líquido não zerar; **sorteio de liberação** se houver disputa nos primeiros segundos; **estadia** paga para estender; devolução automática ao vencer.
- Teto de preço por item (faixa de 10x a média móvel de 7 dias) para frear lavagem entre contas próprias.
- Bloqueio de venda para conta com menos de N dias e para conta ligada ao mesmo dispositivo/rede.

### Oficinas (guilds)
- Entidade `oficina` com 3 papéis (líder, subdono, membro), recrutamento aberto/candidatura/convite, nome/tag filtrados.
- **Cofre**: meta fixa; ao encher, **bônus de oficina de 7 dias** para todos. Doação irrevogável (devolve se a oficina for apagada). Log paginado.
- **Time escalado** de tamanho fixo (não a oficina inteira) para o **desafio diário automático**, resolvido por job em horário fixo (UTC); resultado = nota 0 a 100 por sobrevivência e dano; GP somado em ranking.
- **Reserva** (quem não está no time) participa do evento semanal com bônus proporcional.
- Chat da oficina com espera própria.

### Evento semanal assíncrono (Colosso)
1. Segunda 00:00 UTC: o servidor cria o colosso (semente = semana). Inscrição consome 1 ficha, e o servidor guarda um **retrato** (nível, equipamento, módulos do drone).
2. Durante a semana: cada inscrito escolhe **quando** enfrentá-lo (uma tentativa por dia, até 3). A luta é **simulada no servidor** com `rng` seedável e regras de `core`, e o dano vai para um **acumulador comum** (vida do colosso). A fita (JSON versionado) fica em CDN.
3. Domingo 20:00: fecha. O bônus (XP/sucata por 12 h) é proporcional à vida restante e vai **a todos os inscritos** (mesmo quem lutou pouco, com um piso).
4. Placar de dano individual separado, só cosmético.
5. Tolerância: servidor reiniciando não perde nada, pois o acumulador é uma linha no banco e o job é idempotente.

### Gemas e pagamentos (Solana / USDT)
Decisão do produto (2026-11-19): gemas compradas com **USDT na rede Solana**, com vínculo de carteira; o mercado entre jogadores usa gemas.
- **Vínculo de carteira:** assinatura de mensagem (nonce do servidor) pela carteira do jogador (ex.: Phantom/Solflare); uma carteira por conta.
- **Compra:** o servidor gera uma ordem com referência única; o jogador paga USDT (SPL) para o endereço do jogo; um verificador confirma a transação on-chain (finalidade `finalized`, valor, mint USDT, referência) e credita as gemas uma vez só (idempotente por assinatura da transação).
- **Livro-razão:** toda mudança de gemas é uma linha imutável (compra, gasto, taxa de mercado, estorno); saldo = soma. Nada de saldo editável direto.
- **Chaves:** carteira quente com saldo mínimo, fria para o restante; segredos só em cofre de segredos, nunca no repositório.
- **Antes de abrir (obrigatório):** parecer jurídico sobre venda de moeda virtual e cripto no Brasil (Lei 14.478/2022 e regras do BC para ativos virtuais), KYC/AML se houver saque, impostos, termos de uso, idade mínima, regras das lojas de apps, e proibição de mecânicas de sorte pagas (caixas aleatórias) onde forem reguladas.

### Entrega em fases e esforço
Esforço em pessoa-semanas (1 dev sênior; ±40%).

| Fase | Entrega | Esforço |
|---|---|---|
| 0 Preparação | Extrair `packages/core` + `packages/protocol`; testes de regras já existentes (27) rodando nos dois lados; `save` versionado | 1 |
| 1 MVP de conta | Contas + login + sessão única + `hello/welcome/estado` delta + importação de save + salvar na nuvem + `/saude` + backoff/vigia no cliente | 3 a 4 |
| 2 Economia autoritativa | Inventário, craft, loja e **terminal AFK** no servidor; `reqId` idempotente; auditoria; tetos de combate (camada B) | 3 |
| 3 Social leve | Amigos, chat global + espera, ranking semanal de variedade, passe diário, Top Catch equivalente | 3 |
| 4 Mercado | Anúncios, retenção, lote, taxa, estadia, favoritos, histórico de preços, bloqueios anti-abuso | 4 a 5 |
| 5 Oficinas | CRUD de oficina, cofre e bônus, time escalado, desafio diário por job, chat | 4 a 5 |
| 6 Evento semanal | Colosso assíncrono com simulação servidor, fitas em CDN, player de replay | 4 a 6 |
| 7 Escala e operação | Redis pub/sub entre instâncias, particionamento por `contaId`, rate limit por conta, painel de moderação, backups e métricas, testes de carga | 3 a 4 |
| 8 Gemas e pagamentos | Carteira Solana, compra de gemas em USDT, livro-razão, conciliação on-chain, conformidade | 4 a 6 |
| Total aproximado | | **29 a 38** |

### Riscos
- **Ação em tempo real no cliente** é o ponto frágil de um servidor autoritativo; a camada B (teto + lote) é um compromisso, não prova. Se o jogo ficar competitivo, avance para a camada C.
- **Mercado** atrai bots e lavagem; coloque monitoramento antes de abrir (preço fora de faixa, mesmas contas, volume).
- **Custo de tick offline**: não simule combate offline por jogador; use **fórmula fechada** como o `afk.ts` (função pura do relógio) para tudo que roda sem aba.
- **Dinheiro real** atrai fraude, lavagem e exigências legais: livro-razão, monitoramento e parecer jurídico antes do lançamento. Saque de gemas para USDT só depois de KYC/AML resolvidos.
