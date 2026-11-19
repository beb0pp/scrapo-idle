# Design de feitiços — padrão visual

Padrão aprovado para feitiços, ícones e efeitos da Ferromancia. Todo feitiço novo segue estas regras. Tudo é pintado por código, pixel a pixel. Nada vem de imagem externa, e as referências de estilo estão em [CREDITOS.md](./CREDITOS.md).

## 1. Escola e cor

Cada feitiço tem **uma família de cor**, com cinco tons: fundo, contorno (`ink`), médio (`mid`), destaque (`hi`) e branco. A escola decide o círculo rúnico, e a cor identifica o feitiço.

| Feitiço | Escola | Cor (`mid` / `hi`) | Círculo |
|---|---|---|---|
| Lança de Brasa | Ataque | `#f08a3a` / `#ffd27a` | `rune_ember` (estrela) |
| Égide de Ferro | Defesa | `#5fd0d8` / `#b8f4f6` | `rune_ward` (hexagrama) |
| Chamado Imantado | Extração | `#b48ae6` / `#e8d8ff` | `rune_lode` (quadrados) |
| Pressa Rúnica | Auxílio | `#e0b33a` / `#fff2b0` | `rune_ward_w` tingido |
| Rede Magnética | Auxílio | `#d878e0` / `#f8c8f4` | `rune_lode_w` tingido |
| Colheita em Lote | Auxílio | `#9fd86a` / `#e8ffc8` | `rune_ember_w` tingido |

- Os feitiços de auxílio reaproveitam a geometria de um círculo existente. Usam a cópia cinza (`*_w`) com `tint`, sem pintar círculo novo.
- Uma cor nova não pode repetir o matiz de outro feitiço.
- Onde a cor fica no código:
  - pintura do ícone: `ICON_PAL` em `src/art/ferroArt.ts`;
  - efeitos no mundo: `COLORS` em `src/game/spellfx.ts`;
  - interface: `--sh` / `--sg` em `src/ui/ferro.css`.

## 2. Ícone (16×16, estilo luminoso)

Função `luminous()` em `src/art/ferroArt.ts`.

1. **Fundo escuro** com uma poça de brilho atrás da arte. São três faixas radiais, com uma transição em xadrez entre elas.
2. **Silhueta clara**, desenhada como uma função `Shape (x, y) → 0..4`:
   - 0 vazio, 2 médio, 3 destaque, 4 branco;
   - o branco fica só no ponto mais quente: a ponta da lança, os polos do ímã, a runa central.
3. **Contorno de 1 px** em `ink` em volta da silhueta.
4. **Faíscas** opcionais, com no máximo 3 pixels soltos.
5. **Uma leitura só:** um objeto, sem texto e sem moldura dentro do ícone.

Na interface, o ícone fica num quadro com borda de 1 px na cor `--sh` e brilho `--sg`, tanto por dentro como por fora (`img.fe-spell-ico`, `img.fe-bico`, `img.spell-ico`). Ao criar um feitiço, acrescente a linha dele no bloco de cores das classes `.sp-<id>` em `ferro.css`.

## 3. Animação do lançamento

Toda conjuração segue o mesmo ritmo, com os tempos em `spellfx.ts`:

| Fase | Tempo | O que aparece |
|---|---|---|
| Preparo | `PREP_MS` 180 ms | O herói comprime e estica (squash/stretch) e uma faísca pulsa na mão. |
| Círculo | `CIRCLE_MS` 220 ms | O círculo rúnico abre com `Back.easeOut` sobre uma poça de luz e termina num flash. |
| Viagem | `TRAVEL_MS` 140 ms | Só nos projéteis. Lança com rastro (afterimage) e brasas caindo. |
| Impacto | `IMPACT_DELAY[id]` | Explosão tingida, anel, partículas e marca no chão quando cabe. |

- O efeito de jogo só é aplicado em `IMPACT_DELAY`. A animação e a regra precisam bater.
- Feitiços de auxílio usam uma aura (`spellAura`) que acompanha o herói enquanto o buff dura e some em `AURA_FADE_MS`.
- Feitiços em área disparam alvo a alvo, com `HARVEST_STAGGER_MS` de intervalo, e não todos de uma vez.

## 4. Regras de textura

- **Círculos rúnicos:** 96×96 px, redondos, 4 quadros. Cada quadro gira uma casa da faixa de runas, e o quadro 4 é igual ao 0, para o loop não ter emenda.
- **Perspectiva:** no chão, o círculo é achatado com `scaleY = GROUND_FLAT` (0,5) para seguir o plano 3/4.
- **Efeitos brancos e tingíveis:** `impact_burst`, `swirl`, `spike_burst` e `pull_arrows` são pintados em cinza e branco e recebem cor por `tint`. Prefira tingir a pintar uma textura nova.
- **Mistura:** use `ADD` só para brilho (flash, poça de luz). Círculos e silhuetas usam mistura normal para não estourar a cor.
- **Paleta do mundo:** o metal e a madeira vêm das constantes de `ferroArt.ts` (`IRON`, `STEEL`, `COPPER`, `RUST`, `WOOD`). Não invente tons soltos.

## 5. Checklist de um feitiço novo

1. Defina o feitiço e o nó da árvore em `src/data/ferromancy.ts`.
2. Escolha a cor (seção 1) e acrescente-a em `ICON_PAL`, `COLORS` e `.sp-<id>`.
3. Desenhe o `Shape` do ícone (seção 2) e confira-o com zoom.
4. Monte o `play<Nome>` em `spellfx.ts` com o ritmo da seção 3, reaproveitando `runeCircle`, `burst`, `ring`, `motes` e `swirl`.
5. Escreva um teste E2E que conjure o feitiço e um teste unitário da regra em `src/core`.
