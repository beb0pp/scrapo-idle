# UI/UX — primeira entrega

## Decisões

O mundo permanece a superfície principal. A faixa superior é fixa: região à esquerda e vida/créditos à direita. A faixa inferior fixa contém Mochila (`I`), Q/W/E/R e Mercado. Achados recentes ficam no canto direito, limitados a quatro linhas e a sessão mantém no máximo 12 entradas. A cena de Extração exibe cartão de estado, carga, ciclo, achados e as ações de encerrar/recolher ou retomar controle.

Mochila abre sobre o cenário sem parar a extração. Personagem fica à esquerda, itens em grade de cinco colunas no centro e detalhes à direita; o rodapé sempre mostra o estado da extração. Slots vazios têm contorno tracejado, ocupados têm ícone e selecionados têm ciano. Equipar é a ação principal; a troca é atômica e é bloqueada se os 30 espaços distintos da mochila estiverem cheios. No estreito, os blocos passam para uma coluna: Personagem, Itens, detalhes.

O Mercado é leitura/compra do NPC nesta versão; anuncia explicitamente que o mercado entre jogadores virá depois. O mapa regional é documentado para a próxima ligação de WorldScene: marcadores de posição, pontos de extração e descobertas; não há ação “ir” enquanto não existe fluxo de navegação.

Dimensões iniciais ajustáveis: cartão lateral 320 px, grade 5×80 px, painel máximo 1180 px, HUD inferior 64 px. Papel/textura e contornos escuros são discretos e usam os tokens âmbar, ciano, ferrugem e tinta existentes.

## Wireframes

```text
1920×1080
┌ Região ───────────────── créditos/config ┐
│                 CENÁRIO / personagem      │ ┌ minimapa ┐
│                                            │ ├ extração ┤
│                                            │ ├ achados ─┤
├ Mochila ─ Q W E R ───────────────── Mercado ┤
```

```text
390×844
┌ Região · créditos ┐
│     cenário        │
│ status extração    │
│ achados (painel)   │
├ I · Q W E R · $ ──┤

Mochila: [Personagem] [Itens 4 colunas] [Detalhe]
```

## Estados e atalhos

- Ativa: “Extraindo”, barras de carga/ciclo, encerrar ou retomar controle.
- Encerrada: “Recolher”; não pode ser recolhida duas vezes.
- Bloqueada: botão desativado no Terminal.
- `I`: Mochila; `Esc`: fecha; Q/W/E/R e mouse preservados; 1–5 são reservados para referências de ferramentas/consumíveis quando a hotbar for expandida.

## Integração com WorldScene

Após conceder loot de pilha/drop, o lead deve chamar, depois de `session.mutate(...)`:

```ts
session.recordFinds(loot, 'Pilha de sucata');
```

Na criação/troca de mapa, após construir o `blocked` em ordem de linhas:

```ts
setMinimap({
  mapId,
  name: areaName,
  widthTiles: map.width,
  heightTiles: map.height,
  blocked,
  markers: [{ kind: 'entrance', x: spawnX, y: spawnY, label: 'Entrada' }],
});
```

Durante `update`, no máximo uma chamada a cada mudança de tile:

```ts
setMinimapPlayer(Math.floor(player.x / 16), Math.floor(player.y / 16));
```

Para abrir a Mochila via interação: `openPanel('inventory')`. Para Mercado/Terminal existentes, mantenha `openPanel('vendor')` e `openPanel('terminal')`.
