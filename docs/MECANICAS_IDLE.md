# Mecânicas idle: referências e propostas

Análise de design de jogos idle online (referência principal: PokeIdle), feita a partir do que o cliente web mostra ao jogador. Aqui ficam só as **conclusões de design** e as **propostas originais** para o Scrapo; nada de código, texto, arte ou números foi copiado. Arquitetura online: ver [MULTIPLAYER.md](MULTIPLAYER.md).

## Ritmo e recompensa (regra de design)

Lição do jogo estudado, observada jogando: capturar e subir de nível é lento demais, e isso deixa o jogo chato. O Scrapo tem dificuldade, mas **mediana**: o jogador precisa sentir recompensa numa frequência alta e constante. Toda mecânica nova e todo ajuste de números passam por estas metas.

| Evento | Meta (jogo ativo, conteúdo principal) |
|---|---|
| Algo bom na tela (XP, dano, sucata, drop) | a cada 10–20 s |
| Item Incomum ou melhor | a cada 2–4 min |
| Item Raro ou melhor | a cada 10–15 min |
| Primeiros 5 níveis | em até 10 min |
| Nível 10 | em ~30 min (curva atual: `XP_BASE=22`, `XP_EXP=2,2` em `src/core/level.ts`) |
| Nível seguinte, até o Nv 25 | a cada 10–20 min; nunca mais de ~45 min entre níveis |
| Algo novo desbloqueado (receita, área, feitiço, construção) | em toda sessão de 15–20 min |
| Próxima área ou fase | em 1–2 sessões, não em dias |
| Renda offline (terminal, bancada) | pelo menos metade do ritmo ativo |

Regras:
- **Sem parede de progressão.** A dificuldade acompanha o jogador; se ele travar, o jogo diz em uma frase o que fazer.
- **Falha não zera.** Azar acumula garantia (pity) e morrer custa pouco tempo, nunca progresso.
- **Medir, não achar.** A sessão automática (`e2e/auto.spec.ts`, `session.autoLog`) mede itens/min, raros/h e níveis/h; um ajuste de números só entra se ficar dentro destas faixas.
- **Monetização não compra ritmo.** Gemas podem acelerar ou cosméticos, mas o jogo grátis precisa cumprir esta tabela sozinho.

## Mecânicas de referência que sustentam retenção

1. **Hunt idle com automações como "custo operacional".** O jogador não clica no combate; ele gerencia estoque (poção, revive, bola) e escolhe a área. O gargalo é o consumível, e a falta dele "para" o idle e puxa o jogador de volta. Consistência: aparece em tutorial, painel, eventos, Modo Economia.
2. **Teto de estoque que trava só a captura**. A caça continua pagando XP e ouro, então a parada é leve, mas força a "faxina" regularmente e alimenta três sumidouros (venda, oferenda, sacrifício). Evita perda silenciosa (ovo espera, aviso em 95%).
3. **Sumidouros com recompensa nobre: Sacrifício e Oferenda.** Converter excedente em boost de XP (sacrifício, barra de 5 níveis, teto de 30 dias) ou em pedra (roleta, fatias por tipo) dá destino a tudo que sobra e fecha o ciclo "capturar, converter, evoluir". O desenho da barra (marcos, teto, resgate manual) é limpo.
4. **Progressão infinita com degraus mais refino cúbico.** Conteúdo reaproveitado multiplicado (x1 a x20 em 40 degraus) e um sumidouro sem fim. Não precisa de conteúdo novo para segurar o jogador de fim de jogo.
5. **Eventos com horário fixo e resultado coletivo (Raid semanal).** Um chefe, todos juntos, resultado vira bônus para todo inscrito mesmo que contribuam pouco; usa "retrato" (zero risco). Cria o compromisso "segunda 20h" sem punir quem falta (bônus menor, não zero).
6. **Passe diário de 30 dias, não retroativo.** Um resgate por dia com raridade crescente e baús marcados nos dias 7/14/21/28/30. A regra "o de hoje entra" evita a frustração de quem compra tarde.
7. **Boost dos Atrasados (catch-up).** XP até 10x por 7 dias, sem perda ao morrer, com preço proporcional ao que falta. Protege o jogador novo da distância para os veteranos e dá motivo para voltar.
8. **Marcos semanais por variedade (Top Catch).** O placar conta **espécies distintas**, não volume, o que recompensa exploração e não só grind; marcos pagam boosts curtos. Zera no domingo.
9. **Meta social com participação offline (Guild: banco, boost, guerra automática).** A guerra roda sozinha todo dia, ninguém precisa estar online, e a doação coletiva entrega boost a todos. Mantém a guild viva sem exigir presença.
10. **Painel de sessão (Modo Economia).** Lucro, ETA de nível, ritmo de captura e uma janela flutuante. Faz do idle um número que o jogador quer melhorar, e reduz o custo de render (bateria).

Menções honrosas: tipagem do dia (barata, alta rotação), pity que devolve munição, Safari como "modo de captura pura" limitado por ticket, Arena Mística (uma bola, uma chance: tensão máxima com custo mínimo de conteúdo).

Monetização: o Scrapo terá gemas compradas em USDT via Solana e mercado entre jogadores (ver [MULTIPLAYER.md](MULTIPLAYER.md), "Gemas e pagamentos"). Ficam fora: afiliados vitalícios e garantia de raro vendida.

## Proposta para o Scrapo

Premissas do Scrapo (lidas em `README.md`, `docs/ALPHA.md`, nomes em `src/core` e `src/data`): herói catador de sucata, cão-robô Ferrugem, drone Faísca, oficina (craft), terminal de extração AFK (`afk.ts`: sessões pelo relógio, capacidade, lote final), modo Auto (T), Ferromancia (árvore e feitiços), 5 inimigos, vendedora Dona Rebite, save local. Tudo abaixo é **versão original**, sem nomes, textos ou números do PokeIdle.

### Single-player agora

| # | Mecânica nova (nome de trabalho) | Versão para o Scrapo | O que já existe e aproveita | Esforço | Prioridade |
|---|---|---|---|---|---|
| 1 | **Consumíveis de operação para o Auto** | O Auto gasta **cartuchos de reparo** e **fusíveis**: reparo cura quando a vida baixa, fusível reativa o herói "caído" (em vez de morrer, desliga 5 s). Sem estoque, o Auto para e avisa. A Dona Rebite vende em pacotes. | Auto (T) já recua com vida baixa; vendor e `buy/sell` em `economy.ts` | M | Alta |
| 2 | **Bolsa limitada que trava só a coleta** | A mochila tem teto de peças. Cheia: o terminal AFK e o Auto param de recolher sucata, mas o combate segue dando XP. Aviso a 90%. Destinos: vender, **desmontar**, **fundir**. | `dismantle`, `sell` em `economy.ts`; `capacity` em `afk.ts` | P | Alta |
| 3 | **Fornalha de Sacrifício** | Sucata de nota alta (peças com "qualidade") vira **pontos de calor**; uma barra de 5 degraus paga um **Overclock da bancada** (+X% XP por N horas, teto acumulado de dias). Resgate manual, teto de acumulação. Protege peças equipadas e únicas. | Oficina/recipes; `XP` em `data/xp.ts`; `grantXp` em `level.ts` | M | Alta |
| 4 | **Roleta de Fundição** | Até 5 peças na fundição; cada uma colore uma fatia pelo **elemento** (Ferromancia já tem `elements.ts`); gira e sai um **núcleo** do elemento da fatia; casas vazias = fatia "escória". Cinco peças = garantia. | `core/elements.ts`, `data/elements.ts`; `rng.ts` seedável (determinístico, testável) | M | Média |
| 5 | **Qualidade e potência das peças** | Peças dropam com **qualidade** (faixas com probabilidade, raridades no topo), **calibre** (1 a 5) e **nota** exibida. Arma/armadura/módulos do drone com variação visível. A nota guia venda, fundição e sacrifício. | `items.ts`, `recipes.ts`, `equip/unequip`; `rng.ts` | G | Alta (é o eixo que dá sentido às mecânicas 3 e 4) |
| 6 | **Calibragem sem teto** | Cada peça equipada pode ser **recalibrada**: +1 por degrau, custo cúbico em núcleos do elemento. Peça calibrada fica trancada para venda. Sumidouro infinito do fim de jogo. | Ferromancia tree; núcleos da mecânica 4 | M | Média |
| 7 | **Zonas escalonadas com multiplicador** | A mesma zona reaparece em **degraus de risco** (1 a ~20): mais HP e dano nos inimigos, mais sucata rara, desbloqueados por nível. Fácil de gerar com a tabela `areas.ts`. | `AFK_AREAS`, `ENEMY_INFO`, mapas | M | Alta |
| 8 | **Terminal AFK como "Safari"** | Modo **expedição de 1 h por ficha**: sem XP, sem ouro, só sucata rara com chance extra; a expedição se resolve pelo relógio (já é `computeProgress`). Fichas ganhas por jogo, não compradas. | `afk.ts` (função pura do relógio), `claimAfk` | P | Alta |
| 9 | **Chocadeira vira Bancada de Montagem offline** | Um **kit de drone** (6 h/12 h/24 h, três qualidades) monta um módulo aleatório do pool; corre offline pelo relógio; nasce no inventário; espera se a bolsa estiver cheia. | `afk.ts` (padrão de sessão por relógio), `recipes.ts`, `save.ts` | M | Média |
| 10 | **Passe diário de 30 dias (modo "Diário da Colônia")** | 30 entradas por dia local; raridade crescente; marcos nos dias 7/14/21/28/30 com baú; **não retroativo**; "o de hoje entra". Sem premium: só uma linha de recompensas e itens cosméticos. | `save.ts` (data do último resgate), vendor, HUD (`hud.ts`) | M | Alta (retenção D1 a D30) |
| 11 | **Marcos semanais de variedade** | Contador semanal de **tipos de sucata distintos coletados** e **inimigos distintos derrotados**; marcos pagam boosts curtos (XP, sorte) e um cosmético. Reseta por semana local. | `enemies.ts`, `items.ts`, `save.ts` | P | Média |
| 12 | **Elemento do dia** | Um elemento por dia (`elements.ts`): feitiços e inimigos desse elemento dão +100% / +dano recebido; vira à meia-noite local. Dá variedade de rotina com custo quase zero. | `core/elements.ts`, `spells.ts`, `mana.ts` | P | Média |
| 13 | **Catch-up** | **Reforço de oficina**: se o nível do herói estiver abaixo de uma meta, multiplicador de XP temporário e sem perda ao cair; ativável com sucata, preço proporcional ao XP que falta. Útil se vier a haver conteúdo pago ou muitos saltos de dificuldade. | `level.ts`, `xp.ts` | P | Baixa (só se houver abandono por dificuldade) |
| 14 | **Painel de sessão do Auto** | Tela leve que desliga a cena (economia de bateria, já que é Phaser): sucata/min, lucro (vendas menos gastos), ETA do próximo nível, taxa de drop raro, estoque de consumíveis. O jogo segue no relógio. | `session.ts` (`autoLog`), `afk.ts`, UI `hud.ts` | M | Alta |
| 15 | **Revelação de raro** | Item raro dá uma tela curta ("achado"), com som próprio e entrada no diário. Reforça o ciclo de recompensa sem mudar números. | `banner.ts`, `ui.ts` | P | Média |
| 16 | **Boss único com arena e "fúria"** | Um chefe de sucateiro (ex.: guindaste enlouquecido) com fúria que dobra o dano a cada N segundos, ficha de entrada, loot do boss e rotação diária de qual prêmio cada chefe dá. | `enemies.ts`, `WorldScene` | G | Média |
| 17 | **Pity de munição** | Se N horas de extração raras sem achado raro, o jogo paga um **pacote de insumos** (munição de raridade), não o raro em si. Mesma ideia: suaviza a variância sem garantir o item. Gratuito, sem monetização. | `afk.ts` (`rareFound` já existe), `rng.ts` | P | Média |

Sequência sugerida para o single-player: **2, 1, 8** (barato, muda o ritmo) → **5** (alicerce) → **3, 4, 7** → **10, 11, 12, 14** → **6, 9, 16, 15, 17, 13**.

### Precisa de backend / online depois

| # | Mecânica | Versão para o Scrapo | Requisito técnico | Esforço | Prioridade |
|---|---|---|---|---|---|
| A | **Ataque semanal do Colosso** | Um colosso de sucata por semana; **todos os jogadores inscritos** enfrentam o mesmo chefe num horário fixo; o resultado (vida que sobrou) vira **bônus de XP e de sucata por 12 h para todos os inscritos**. Usa "retrato" do herói/drone (sem risco). | Servidor autoritativo de resolução; agenda; ranking agregado. Comece **assíncrono**: cada um luta quando quiser durante a semana e o servidor soma o dano. | G | Alta |
| B | **Oficinas (guilds)** com cofre e boost | Cofre coletivo (meta fixa) que libera **bônus de oficina** de 7 dias para todos; time escalado fixo para um **desafio diário automático** que não exige presença. | Contas, persistência, jobs diários | G | Média |
| C | **Placar semanal de variedade** | Ranking semanal de "tipos distintos de sucata" com prêmios cosméticos, não de volume. Reseta no domingo. | Contas, leaderboard, antifraude básica (validar por eventos) | M | Média |
| D | **Troca entre jogadores** | Feira de peças com taxa progressiva (sumidouro). Negociada em gemas (ver MULTIPLAYER.md). Peça calibrada e peça única não circulam. | Contas, mercado, anti-abuso, moderação | G | Baixa |
| E | **Pódio por elemento** (ginásio) | Para cada elemento, o jogador com a "oficina" mais forte ganha um bônus de dano daquele elemento enquanto estiver no topo. | Servidor para calcular força por build; recálculo periódico | G | Baixa |
| F | **Eventos com janela** (campeonato) | Torneios de sucata com regras fixas (sem peça lendária) em dia marcado. | Resolução no servidor, agenda | G | Baixa |
| G | **Sincronização de relógio e anti-trapaça** | Relógio autoritativo para fichas, passe, semana e resgates diários (hoje `Date.now()` local). | Servidor de tempo; validação do `save` | M | Pré-requisito de A a F |

### Riscos e cuidados para o Scrapo

- **Peso dos números.** Os valores de referência são para entender a **forma** da mecânica. O Scrapo precisa de números próprios, calibrados no próprio simulador (`e2e/auto.spec.ts` já tem sessões de 5 min).
- **Não copiar** nomes, textos, arte ou tabelas do PokeIdle; os nomes de trabalho acima são provisórios e originais.
- **Teto de acumulação** em qualquer boost de tempo para evitar economia quebrada.
- **Determinismo.** `rng.ts` e `computeProgress` já são funções puras do relógio; manter esse padrão em Fornalha, Roleta e Bancada, para teste e para um futuro servidor reproduzir o resultado.
- **Gargalo único e legível.** A força do loop do PokeIdle é que cada trava (estoque cheio, falta de poção) tem **uma frase** que explica o que fazer. Replicar essa clareza vale mais que replicar a quantidade de sistemas.
