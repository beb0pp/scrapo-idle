# Relatório: alpha da Ferromancia

Branch `feat/ferromancia`, worktree `C:\Projetos\Games\scrapo-ferromancia`. Base: `f024651`. Sem push, merge na base ou deploy.

## Resultado

| Gate | Resultado |
|---|---|
| Testes unitários (Vitest) | 51/51 |
| Typecheck (`tsc --noEmit`) | limpo |
| Build (`vite build`) | ok |
| E2E Playwright (`npm run e2e`, 7 cenários, saves isolados) | 7/7, também sobre o merge com `feat/alpha` |
| gitleaks no working tree | sem vazamentos |

## Entregas por item do pedido

1. **Branch e worktree próprios** a partir do primeiro commit validado. Módulos novos isolados; ganchos em arquivos compartilhados limitados a uma linha.
2. **Pesquisa** em `docs/PROGRESSAO.md` (7 jogos, links e o que foi adaptado).
3. **Arte** original, pintada por código na paleta do jogo (`src/art/ferroArt.ts`). Nenhum pacote de terceiros importado. Créditos, pacotes avaliados e referências em `docs/CREDITOS.md`.
4. **Duas árvores por dados** (`src/data/ferromancy.ts`): construção (oficina → bancadas/módulos → drone e estação alquímica → alambique) e habilidades (combate, extração, magia). Nó mostra custo, requisitos, efeito e estado. Grafo sem ciclos (teste), consumo único, save v1/v2 migrado para v3.
5. **Sucata → reagentes** e 3 feitiços (Z/X/C; QWER, T e avisos de perigo intactos): Lança de Brasa (ataque), Égide de Ferro (defesa), Chamado Imantado (extração). Animação em 5 fases. O Auto usa só feitiços equipados, com o mesmo portão de custo e recarga do manual.
6. **Aliado Cobalto** (autômato adormecido achado no ferro-velho): recrutamento, formação frente/retaguarda, papéis (Guardião, Conjurador; Ferrugem Caçador ou Coletor), sinergias Ressonância Rúnica e Muralha de Ferro, persistência. Veios de Éter ligam a exploração ao reagente.
7. **E2E** em `e2e/ferromancia/`, config `playwright.ferro.config.ts`. Capturas dos feitiços em `docs/capturas/` (`ember|ward|lodestone` × `inicio|pico`).

## Commits

| Hash | Conteúdo |
|---|---|
| `f86358f` | dados, árvores, feitiços, equipe, save v3 |
| `bc269a5` | feitiços animados, Cobalto, veios, painel K, ganchos de cena |
| `43dee5a` | E2E, CI com gitleaks, docs, capturas |
| `532a597` | merge de `feat/alpha` (integração em commit separado) |

## Pontos de integração e colisões

Arquivos compartilhados com a sessão de polimento (`feat/alpha`): `package.json`, `package-lock.json`, `src/art/sprites.ts`, `src/scenes/BootScene.ts`, `src/scenes/WorldScene.ts`. Todos resolvidos no merge `532a597`:
- `sprites.ts`: arte de ícones do alpha mantida; `ICON_ART` virou `Partial` (ícones dos reagentes vêm de `ferroArt.ts`).
- `BootScene.ts`: os dois construtores de arte.
- `WorldScene.ts`: confirmação automática de modal do alpha mantida; `ferro.autoCast` logo depois; multiplicador de recarga da Investida junto do log do Auto.
- Dev hook `__scrapo` em `main.ts` ganhou `ferro()`; o E2E depende dele.

Pendente: a "próxima leva" do alpha (autoUnstick, teclas 1–4, `playwright.config`, `e2e/`) ainda não foi commitada. Quando houver hash, repetir o merge. O alpha é dono de `playwright.config.ts`; os specs da Ferromancia ficam só em `e2e/ferromancia/`.

## Limitações conhecidas

- Servos Calibrados (+30%) valem para o ataque automático do drone, não para a Sobrecarga.
- O E2E lê campos internos (`ferro().veins`, `.sleeper`, `.ally`, `world().enemies`); renomeá-los quebra os testes. O adaptador `ferroApi` também lê membros privados da `WorldScene` por cast; `tsc` não pega renomeação.
- Licenças de 6 dos 8 pacotes avaliados não foram verificadas na fonte; por isso nada foi importado.
- Painel e HUD foram checados por E2E e captura, sem revisão visual em outras resoluções.
- O gate de commit do `exonous` não reconheceu o token pelo Bash neste worktree; os commits foram feitos pelo PowerShell.
