# Scrapo web — alpha

Branch `feat/alpha` (base `f024651`). Registro do que entrou no alpha, como foi validado e o que ficou pendente.

## Como rodar e validar

```bash
npm install
npm run dev            # http://localhost:5180
npx tsc --noEmit       # typecheck
npm test               # vitest, 27 testes de regras puras
npm run build          # tsc + vite build
npm run e2e            # Playwright: fluxo completo, QWER, save v1 (servidor próprio na porta 5190, sem HMR)
SCRAPO_AUTO_SOAK=1 npx playwright test e2e/auto.spec.ts   # 3 sessões de Auto de 5 min (≈16 min)
```

O E2E usa o Chrome instalado (`channel: 'chrome'`), cada teste tem `localStorage` isolado, e os resultados e capturas de falha ficam em `.snapshots/e2e-results/` (fora do git). As sessões de Auto gravam um relatório por linha em `.snapshots/auto-sessions.jsonl`.

## O que entrou

| Área | Mudança | Commit |
|---|---|---|
| Base | Estado jogável salvo antes do alpha | `f024651` |
| Herói e Ferrugem | Arte de referência do usuário convertida em pixel art (`tools/pixelize-ref.py`) e assada em spritesheets (`tools/bake-sprites.py`): herói com repouso, caminhada, ataque, coleta, dano, esquiva e conjuração (15 quadros); Ferrugem com repouso, corrida, mordida e busca (9 quadros). Dano do golpe e da mordida cai no quadro de impacto; a batida da coleta acompanha a faísca. | `3167dc7` |
| Auto | Sai de travas (ordem parada 1,5 s → descarta e põe o alvo de castigo por 20 s); do Pátio vai sozinho ao ferro-velho; confirma modais de história após 4 s; esquiva golpes telegrafados, recua com vida baixa; usa as mesmas habilidades e recargas do manual; qualquer entrada manual assume na hora. Contadores de QA em `session.autoLog`. | `bbdd8a3` |
| HUD | R virou **Sobrecarga** (apagado sem drone); cada botão do rodapé tem ícone de habilidade em pixel art; Q/W/E/R não disparam mais com 1–4 (que trocam ferramenta). | `bbdd8a3` |
| Inimigos | Triador e prensa redesenhados; novos: faiscador (investida curta), magnetron (projétil esquivável após linha de mira), golem de sucata (pancada no chão com anel largo); quebram em sucata ao morrer. | `f015e4f` |
| Ambiente | Pedras com musgo, troncos, cogumelos, flores, cercas vivas, pisos refeitos, barra de vida com medalhão (entregue antes do alpha, na base). | `f024651` |
| Ícones | 21 ícones de itens redesenhados no estilo da referência 08; contador de créditos pulsa ao vender. | registro final |
| Auto (2ª rodada) | Castigo para inimigos inalcançáveis; sai de mapa esgotado. | registro final |
| Docs | README documenta T, Auto e Ferrugem; este arquivo. | `bbdd8a3` e registro final |

Arte externa: nenhum pack foi importado. As referências do usuário (`assets-src/ref/`) e a arte própria em código cobriram o alpha sem misturar estilos; não há créditos de terceiros a registrar.

## Capturas

| Antes (herói pintado em código, 24×32) | Depois: quadros assados (herói 15, Ferrugem 9) | Depois: no jogo, zoom 2 |
|---|---|---|
| ![antes](alpha/hero-antes.png) | ![quadros](alpha/hero-ferrugem-quadros.png) | ![no jogo](alpha/hero-no-jogo.png) |

Sequência de animação conferida por amostragem dos quadros em execução: `hero-attack 6→7→8`, `hero-cast 13→14`, `hero-dash 12`, de volta a `hero-idle 0`; escala restaurada a 0,5 depois das animações.

## Validação

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | limpo |
| `npm test` | 27 passaram |
| `npm run build` | ok |
| E2E fluxo completo (save novo): explorar → vasculhar o 1º vagão → coletar com Auto → equipar ferramenta → montar módulo e drone → iniciar extração → fechar a aba → reabrir → recolher uma vez → recarregar sem recolher de novo → vender | passou (≈40 s) |
| E2E Q/W/E/R com recargas na masmorra | passou |
| E2E save versão 1 de build anterior | passou (migra para v2, mantém créditos e itens) |
| Console durante os E2E | sem erros |
| Auto, 1 min por sessão (fumaça) | 3/3; 0 travas, 0 mortes; s1 72 itens, s2 4 abates e 17 esquivas, s3 7 abates e 3 Sobrecargas |
| Auto, 5 min por sessão | 3/3, 0 travas, 0 mortes (tabela abaixo) |

### Sessões de Auto (5 min)

Rodada final (`SCRAPO_AUTO_SOAK=1 npx playwright test e2e/auto.spec.ts`, 3 passaram em 15,2 min). "Trava" = herói parado 30 s+ sem vasculhar, sem trocar de mapa e sem modal.

| Sessão | Mapas | Itens | Abates | Esquivas | Habilidades (Pulso/Arco/Investida/Sobrecarga) | Recuos | Destravas | Vida mín. | Mortes | Travas | Erros de console |
|---|---|---|---|---|---|---|---|---|---|---|---|
| s1 ferro-velho, sem drone | yard | 382 | 7 | 24 | 0 / 10 / 24 / 0 | 0 | 3 | 86 | 0 | 0 | 0 |
| s2 masmorra, sem drone | dungeon → yard | 390 | 14 | 19 | 4 / 16 / 20 / 0 | 0 | 0 | 12 | 0 | 0 | 0 |
| s3 masmorra, com drone | dungeon → yard | 446 | 14 | 13 | 2 / 14 / 14 / 4 | 4 | 1 | 1 | 0 | 0 | 0 |

Rodada anterior: s3 teve 2 travas (masmorra esgotada sem plano B e perseguição de alvo inalcançável). Correção: inimigos inalcançáveis ficam 15 s de castigo, e sem trabalho no mapa o Auto segue para o outro mapa. A vida mínima de 1 e 12 mostra que o risco de morrer continua real.

## Pendências

1. **Estilo do herói**: o usuário achou o visual infantil para o ambiente. Caminho combinado: nova referência com proporção adulta e paleta envelhecida (prompt no histórico); a conversão é automática pelos dois scripts acima.
2. Herói só tem vista frontal (espelhada para os lados); costas e perfil dependem de uma folha de animação gerada com o mesmo personagem.
3. A extração AFK conta ciclos só com a aba aberta; ao fechar, guarda os ciclos concluídos (decisão de design original, coberta pelo E2E).
4. Inimigos novos são pequenos no zoom 2; avaliar escala depois de o usuário jogar.
5. Em espera neste alpha: Ferromancia (sessão própria em `feat/ferromancia`), Kick e backend.
