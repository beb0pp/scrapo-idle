# Proposta: Ferromancia (tecnologia + magia)

Status: nome decidido (**Ferromancia**). Sistemas ainda não implementados.

Ferromancia **não é uma classe**: é uma camada que qualquer peça pode receber. Ferramentas, equipamentos, módulos do drone e, no futuro, companheiros podem ser encantados. O jogador mistura tecnologia e magia na mesma build.

## Estrutura de dados (para liberar a magia sem refazer o jogo)

Hoje o inventário guarda pilhas por id (`inventory: { gear: 3 }`). Isso serve para materiais, mas uma ferramenta encantada é única. A estrutura planejada separa as duas coisas:

```ts
// Materiais continuam empilháveis por id.
inventory: ItemBag;                    // { scrap: 40, gear: 3, ether_shard: 2 }

// Peças equipáveis viram instâncias únicas.
gear: Record<GearUid, GearInstance>;
interface GearInstance {
  uid: string;                         // estável, gerado no drop/montagem
  base: ItemId;                        // 'tool_wrench_reinforced'
  rarity: Rarity;                      // pode subir via Ferromancia
  sockets: (RuneId | null)[];          // 1 a 3 conforme a raridade
  enchant?: { essence: EssenceId; tier: 1 | 2 | 3 };
  level?: number;                      // reservado para companheiros/itens que evoluem
}
equipped: Record<EquipSlot, GearUid | null>;

// Catálogos com IDs estáveis (data/):
RUNES: Record<RuneId, { name; element: EssenceId; effect: RuneEffect }>;
ESSENCES: Record<EssenceId, { name; color; recipe: ItemBag }>;
SKILL_VARIANTS: Record<SkillId, Partial<Record<EssenceId, SkillVariant>>>;
```

- **Habilidades**: cada habilidade (Q W E R) lê as runas da ferramenta equipada e escolhe a variante (`SKILL_VARIANTS[skill][element]`). Sem runa, usa a versão atual. Assim a magia entra sem botões novos.
- **Atributos**: `playerStats()` passa a somar base + raridade + encantamento + runas. É o mesmo ponto central de hoje, então combate, extração e defesa já reagem.
- **Desbloqueio**: a flag `ferromancy_unlocked` libera o Círculo depois de um marco da história (ex.: o primeiro Fragmento de Éter tirado do Núcleo Pulsante). Antes disso a UI esconde soquetes e essências, para não sobrecarregar o início.
- **Save**: vira versão 3, com migração que converte cada ferramenta/equipamento empilhado em uma `GearInstance` sem soquetes preenchidos.
- **Mercado futuro**: instâncias únicas são exatamente o que o servidor precisa para listar, reservar e transferir um item específico.

## Ideia

O Scrapo deixa de ser só ferro-velho e vira **sucata com magia**: ferramentas montadas na oficina recebem runas e essências num círculo de alquimia, e ganham efeitos mágicos. Referência de tom: a fusão de tecnologia e magia que o público de RPG já conhece de outros jogos (ex.: o "Hextech" de League of Legends, que é marca da Riot e por isso **não** usamos o nome, a estética nem os termos). Nome de trabalho para o nosso sistema: **Ferromancia** (alternativas: Arcanotecnia, Alquimia de Sucata).

## Como encaixa na história

A colônia não rodava só a eletricidade. As máquinas eram movidas por **Éter**, uma energia cristalizada extraída do subsolo. Quando a colônia foi evacuada, o Éter continuou correndo pelos cabos e se acumulou nas máquinas abandonadas. Por isso elas ainda obedecem a ordens antigas, e por isso o Núcleo Pulsante "ainda pulsa".

- Os robôs de triagem têm olhos vermelhos porque são movidos a Éter contaminado.
- Cristais de Éter crescem entre a sucata em áreas mais profundas.
- Os ferromantes eram os técnicos da colônia que sabiam gravar runas em peças. O jogador aprende o ofício aos poucos.

## Sistemas novos

### 1. Éter e Essências (recurso)

- **Fragmento de Éter**: drop raro de pilhas, destroços, extração AFK e inimigos. É a moeda mágica de montagem.
- **Essências** (uma por elemento), destiladas no círculo a partir de Éter e componentes:
  - Fogo, de Célula de Carga + Éter;
  - Raio, de Cabo + Éter;
  - Ímã, de Bobina ou Servo + Éter;
  - Gelo, de um líquido refrigerante achado em geladeiras;
  - Vida, de seiva de árvores do ferro-velho.

### 2. Círculo de Alquimia (estação no Pátio Zero)

Um círculo desenhado no chão, ao lado da oficina, com glifos que acendem. O jogador coloca:

- **uma peça base** (ferramenta, equipamento ou módulo de drone),
- **uma runa** (define o efeito),
- **essência + Éter** (o custo; quantidade cresce com a raridade).

Resultado: a peça ganha um **encantamento** visível no nome, na cor e no brilho do ícone (ex.: "Chave Inglesa Reforçada **Flamejante**"). Ferromancia aplica a qualquer peça, não só a ferramentas. Pode falhar parcialmente em peças raras (gera "Sucata Instável", que serve para outras receitas), para dar tensão sem punir demais.

### 3. Runas e soquetes (inspirado em Path of Exile)

- Ferramentas e equipamentos têm **1 a 3 soquetes** conforme a raridade (Comum 1, Raro 2, Relíquia 3).
- Cada soquete recebe uma runa. Runas combinadas criam sinergias:
  - Raio + Ímã: o Arco Elétrico puxa os alvos.
  - Fogo + Pulso: o Pulso deixa o chão em chamas por 2 s.
  - Gelo + Investida: a Investida congela quem você atravessa.
  - Vida + qualquer: cura pequena ao acertar.
- Runas são removíveis no círculo (com custo), para incentivar experimentar builds.

### 4. Habilidades viram tecnomagia

As 4 habilidades atuais passam a ter versão rúnica conforme a runa equipada na ferramenta. A tecla é a mesma, o efeito muda. Isso entrega o "habilidades que mudam com o equipamento" do brief original sem multiplicar botões.

### 5. Visual

- Glifos ciano e violeta sobre metal enferrujado: a paleta atual ganha um roxo-éter (`#b48ae6`) e um ciano mais forte.
- Círculos de alquimia no chão, que acendem em sequência ao montar.
- Itens encantados com brilho pulsante na cor da essência.
- Cristais de Éter como novo tipo de prop coletável nas áreas profundas.

## Time que evolui sozinho (referência idle de Steam)

Você citou um jogo de Steam em que bonequinhos ficam no monitor batalhando sozinhos, por turnos, evoluindo para sempre (me passe o nome quando lembrar, para eu estudar). No Scrapo isso vira:

- **Companheiros**: o Drone Faísca é o primeiro. Depois vêm robôs terrestres reconstruídos e personagens recrutáveis (outros sucateiros e ferromantes).
- **Expedições AFK com equipe**: em vez de um drone extraindo, o jogador manda um **time de até 4** para uma área. Eles combatem e coletam sozinhos (resolução por turnos simulada no relógio, como a AFK atual, que já é determinística por sessão + tempo), sobem de nível e trazem itens raros.
- **Progressão permanente**: cada companheiro tem nível, equipamento e runas próprios, e o time "fica para sempre".
- **Modo janela pequena** (futuro): uma vista compacta do time trabalhando, para deixar num canto do monitor.

## O que muda no que já existe

| Hoje | Com Ferromancia |
|---|---|
| Oficina monta peças | Oficina monta, **Círculo** encanta |
| Raridade só muda cor e atributos | Raridade também define soquetes |
| 4 habilidades fixas | 4 habilidades com variante rúnica |
| AFK com um drone | AFK com time de companheiros (fase posterior) |
| Núcleo Pulsante é item de missão | Vira a primeira fonte de Éter e o gancho da história |

## Fases sugeridas

1. **Base mágica**: Éter como drop, 3 essências (Raio, Fogo, Ímã), Círculo de Alquimia com 1 soquete por ferramenta e 3 runas. Ajustar a introdução da história para apresentar o Éter.
2. **Builds**: soquetes por raridade, combinações de runas, variantes rúnicas das habilidades, Gelo e Vida.
3. **Companheiros e time**: recrutar, equipar e mandar o time em expedições AFK por turnos.
4. **Área mágica**: uma região nova (ex.: a refinaria de Éter da colônia) com cristais, inimigos encantados e um miniboss ferromante.

## Perguntas em aberto

1. ~~Nome do sistema~~: **Ferromancia** (decidido).
2. Encantar pode falhar (com algum retorno), ou é sempre garantido?
3. O time AFK resolve por turnos visíveis (ver cada ataque) ou só mostra o resultado e os destaques?
