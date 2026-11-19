# Progressão da Ferromancia

Base de pesquisa (2026-11-19) e números implementados. Fonte dos dados: `src/data/ferromancy.ts` e `src/core/progression.ts`. Dados de jogos vêm de wikis de fãs e variam por versão.

## 1. Jogos pesquisados

- **Noita**: feitiço tem custo de mana e atraso de lançamento; a varinha recarrega ao fim da fila. Os dois relógios correm em paralelo (vale o maior). Sem mana o feitiço é pulado. [Cast Delay](https://noita.wiki.gg/wiki/Cast_Delay) · [Wands](https://noita.wiki.gg/wiki/Wands) · [Tuple Spell](https://noita.wiki.gg/wiki/Tuple_Spell) · [Add Trigger](https://noita.wiki.gg/wiki/Add_Trigger)
- **Magicka**: poucos elementos base combinam em muitos efeitos; opostos se cancelam; auto-lançamento serve para cura e escudo. [Elements](https://strategywiki.org/wiki/Magicka/Elements) · [Dicas](https://www.gameskinny.com/tips/magicka-2-general-tips-tricks-and-effective-combos/) · [Tutorial](https://lparchive.org/Magicka/Tutorial%201)
- **Graveyard Keeper**: tecnologia custa pontos de 3 cores, ganhos fazendo (coletar, craftar, estudar). Tech libera receitas e construções. Números são do GK2. [Tech points](https://wikily.gg/graveyard-keeper-2/tech-points) · [Research tree](https://allthings.how/graveyard-keeper-2-research-tree-building-and-smithing-unlocks-and-how-to-get-them/)
- **Wizard of Legend**: skill básica sem cooldown, padrão com cooldown (6 a 8,5 s), Signature carrega ao acertar. [Stats](https://wizardoflegend.fandom.com/wiki/Stats) · [Absolute Finale](https://wizardoflegend.fandom.com/wiki/Absolute_Finale) · [Chaotic Buster](https://wizardoflegend.fandom.com/wiki/Chaotic_Buster)
- **Chrono Trigger**: dual tech exige techs simples aprendidas pelos dois, e eles juntos em campo. Alguns personagens não aprendem duplas. [Techs](https://thonky.com/chrono-trigger/techs) · [Sistemas](https://guides.gamercorner.net/ct/systems) · [Gameplay](https://strategywiki.org/wiki/Chrono_Trigger/Gameplay)
- **Path of Exile**: árvore com nós pequenos, notáveis e keystones (efeito forte com contrapartida). Pontos vêm de nível e quests. [Passive](https://www.poewiki.net/wiki/Passive) · [PoE2 tree](https://poe2wiki.net/wiki/Passive_skill_tree)
- **Idle Champions**: buffs posicionais (adjacentes, mesma coluna); campeão fora do alcance do buff é vaga perdida. [Formation strategy](https://idlechampions.fandom.com/wiki/Formation_strategy) · [Melhores formações](https://gamersdecide.com/articles/idle-champions-of-the-forgotten-realms-best-formations)

## 2. O que adaptamos

| Ideia (jogo) | Onde vive no Scrapo | Por quê |
|---|---|---|
| Poucos reagentes geram vários efeitos (Magicka) | `t_ember`, `t_ward`, `t_lodestone`; 1 reagente por feitiço | Variedade sem lista longa de feitiços |
| Custo duplo: consumível + recarga (Noita) | `SPELLS.*.cost` + `cooldownMs`; sem reagente não conjura | Freio natural ao Auto |
| Cooldown por papel (Wizard of Legend) | ataque 6 s, extração 12 s, defesa 15 s | Papéis legíveis; ataque gira mais rápido |
| Pontos ganhos fazendo (Graveyard Keeper) | `skillPoints()`: kills, buscas, extrações, construções | Progresso vem do jogo, não de farm cego; saves antigos ganham crédito |
| Estação/bancada destrava receitas (Graveyard Keeper) | `b_alchemy` (Estação Alquímica) abre `s_mag_init` | Árvore de oficina liga ao ramo de magia |
| Nós pequenos, notáveis, keystone (PoE) | Combate/Extração: nós de 1 ponto; `s_cmb_fury` e `s_mag_channel`: 2 pontos | Poucos nós fortes com preço maior |
| Descoberta ligada à exploração | `ether_vein` exige o Veio de Éter para `b_alchemy`; `automaton` para o Cobalto | Gate por exploração do mapa |
| Combo exige pré-requisitos de dois lados (Chrono Trigger) | `s_cmb_fury` requer `s_cmb_dash` e `s_mag_init` | Liga combate e magia |
| Sinergia posicional (Idle Champions) | `resonance` e `bulwark`: dependem de quem fica na frente e atrás | Simples de ler e testar |
| Auto com política explícita | Auto só usa feitiços equipados, mesmo gate de custo/recarga do manual (`castProblem`) | Auto não esvazia reagentes nem burla regras |

## 3. O que não adaptamos (ainda)

- **Feitiços modulares e modificadores (Noita)**: exigem fila e motor de combos; escopo grande para 3 feitiços.
- **Fila de elementos e opostos que se cancelam (Magicka)**: não há combate com entrada de elementos em tempo real.
- **Fogo amigo (Magicka)**: jogo AFK; companheiros não devem se ferir.
- **Pontos em 3 cores por trilha (Graveyard Keeper)**: um único ponto de ofício basta por ora.
- **Carga ao acertar / Signature (Wizard of Legend)**: não há ultimate ainda.
- **Dual tech com barra cheia (Chrono Trigger)**: sinergia é de formação, sem comando de combo.
- **Keystone com contrapartida e joias (PoE)**: nenhum nó tem penalidade; sem soquetes.
- **Alquimia em 3 níveis**: temos Estação e Alambique (2 níveis).
- **Receita em silhueta ao descobrir reagente**: não implementado.
- **Playtest**: todos os números abaixo são ponto de partida, não validados.

## 4. Números atuais

### Pontos de ofício

`earned = 1 + floor(kills/5) + floor(buscas/8) + extrações + construções`. `livres = earned - gastos`.

### Árvore de construção (itens, sem pontos)

| Nó | Requer | Custo | Efeito |
|---|---|---|---|
| `b_workshop` Oficina Restaurada | - | 6 sucata | +1 defesa |
| `b_bench_tools` Bancada de Ferramentas | oficina | 2 engrenagem, 6 sucata | +3 combate, +1 extração |
| `b_bench_modules` Bancada de Módulos | oficina | 2 engrenagem, 1 cabo | +2 carga; conserta autômatos |
| `b_drone_servos` Servos Calibrados | módulos | 1 servo, 1 engrenagem | +30% dano do drone |
| `b_drone_bay` Porão do Drone | módulos | 2 cabo, 8 sucata | +4 carga |
| `b_alchemy` Estação Alquímica | oficina + Veio de Éter | 8 sucata, 1 cabo, 1 fragmento de éter | libera transmutação |
| `b_alembic` Alambique Rúnico | alquimia + ferramentas | 2 fragmento de éter, 2 engrenagem | +1 reagente por transmutação |

### Árvore de habilidades (pontos)

| Nó | Requer | Custo | Efeito |
|---|---|---|---|
| `s_cmb_arm` | - | 1 | +3 combate |
| `s_cmb_dash` | `s_cmb_arm` | 1 | Investida -20% de recarga |
| `s_cmb_fury` | `s_cmb_dash`, `s_mag_init` | 2 | feitiços +25% de efeito |
| `s_ext_eye` | - | 1 | +2 sorte |
| `s_ext_hands` | `s_ext_eye` | 1 | vasculha 30% mais rápido |
| `s_ext_magnet` | `s_ext_hands` | 1 | +40 px de atração |
| `s_mag_init` | `b_alchemy` | 1 | aprende Lança de Brasa |
| `s_mag_ward` | `s_mag_init` | 1 | aprende Égide de Ferro |
| `s_mag_lode` | `s_mag_init` | 1 | aprende Chamado Imantado |
| `s_mag_channel` | `s_mag_ward` | 2 pontos + 1 fragmento de éter | recarga de feitiços -20% |

### Feitiços

| Feitiço | Tecla | Custo | Recarga | Alvo | Efeito |
|---|---|---|---|---|---|
| Lança de Brasa `spell_ember` | Z | 1 reagente de brasa | 6 s | inimigo, alcance 150 | 24 de dano e respingo |
| Égide de Ferro `spell_ward` | X | 1 reagente de ferro | 15 s | si mesmo | escudo de 40 por 6 s |
| Chamado Imantado `spell_lodestone` | C | 1 reagente imantado | 12 s | área, raio 170 | puxa achados; próxima pilha rende +1 |

Z, X e C são os slots; K abre o painel da Ferromancia; QWER seguem como antes.

### Transmutações (Estação Alquímica)

| Receita | Entrada | Saída |
|---|---|---|
| `t_ember` Pó de Brasa | 4 sucata, 1 cabo | 2 reagente de brasa |
| `t_ward` Sal de Ferro | 4 sucata, 1 engrenagem | 2 reagente de ferro |
| `t_lodestone` Limalha Imantada | 3 sucata, 1 fragmento de éter | 3 reagente imantado |

Com o Alambique, cada transmutação rende +1.

### Aliado e formação

- **Cobalto** (Autômato Vigia): exige descobrir o Autômato Adormecido e `b_bench_modules`. Recrutamento: 1 célula, 2 reagente de ferro, 6 sucata.
- Papéis por posição:

| Membro | Frente | Fundo |
|---|---|---|
| Ferrugem | Caçador: morde inimigos próximos | Coletor: busca achados de mais longe, não luta |
| Cobalto | Guardião: pisa em área curta | Conjurador: setas rúnicas à distância |

- Sinergias:
  - **Ressonância Rúnica**: Ferrugem na frente, Cobalto atrás. Feitiços recarregam 20% mais rápido; a Lança ecoa numa seta do Cobalto.
  - **Muralha de Ferro**: Cobalto na frente, Ferrugem atrás. +4 defesa; Égide absorve 50% a mais.

## 5. Fluxo de jogo

1. **Explorar**: achar o Veio de Éter (Pátio Ferroviário ou Estação); colher fragmentos de éter.
2. **Construir** a Oficina Restaurada, depois a Estação Alquímica.
3. **Transmutar** sucata em reagentes.
4. **Aprender** (K): Iniciação Ferromante, depois Égide, Chamado e Canalização.
5. **Equipar** feitiços nos slots Z, X e C.
6. **Conjurar** com Z/X/C, ou deixar o Auto agir.

Ramo do aliado: achar o **Autômato Adormecido** no ferro-velho, construir a **Bancada de Módulos**, **recrutar Cobalto**, definir a **formação** e ativar a **sinergia**.

### Regra do Auto

O Auto usa só feitiços equipados, com o mesmo gate de custo e recarga do manual (`castProblem` em `src/core/spells.ts`):

- **Égide**: HP abaixo de 50% com inimigo perto, ou golpe telegrafado.
- **Lança**: inimigo dentro do alcance.
- **Chamado**: 3 ou mais achados no alcance, ou prestes a vasculhar uma pilha.
