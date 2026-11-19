# Game Design: Scrapo (navegador)

## Visão

RPG 2D de navegador, visto de cima, em pixel art no estilo 16-bit. O jogador vasculha ferros-velhos de uma colônia industrial abandonada, enfrenta máquinas hostis e recupera peças e relíquias. Na oficina, transforma o que achou em ferramentas, drones e, mais tarde, robôs companheiros, máquinas maiores e exoesqueletos.

O jogo tem dois modos que se complementam:

- **Exploração e combate manual**: abre áreas novas e dá acesso às relíquias dos minibosses.
- **Extração AFK com a aba aberta**: rende materiais de oficina e, às vezes, um achado raro.

Cada achado tem mais de um uso: equipar, desmontar, usar numa montagem ou vender.

## Introdução (exibida no jogo)

> Quando a colônia foi evacuada, as máquinas receberam uma última ordem: manter o pátio funcionando. Décadas depois, os guindastes ainda trabalham, e os robôs de triagem tratam qualquer visitante como sucata fora do lugar. Você chega ao Pátio Zero com uma chave inglesa e um drone quebrado. Sob os destroços do primeiro vagão, alguma coisa ainda pulsa.

## Referências (apenas conceituais)

| Referência | O que tomamos |
|---|---|
| PokéIdle.io | câmera alta, quase a pino; mundo ocupa a tela; atividade automática com a aba aberta |
| Bomb Crypto | escolher uma atividade, ver a equipe trabalhar, voltar e conferir os achados |
| Stardew Valley | pixel art acolhedora, leitura clara dos objetos, ambientes que parecem habitados |
| Chrono Trigger | silhuetas legíveis e expressividade em sprites pequenos |
| Path of Exile | habilidades que mudam com equipamento (relíquias) |

Personagens, sprites, mapas, interface e nomes são originais. Nenhum asset dessas obras é usado.

## Direção visual

- Grade de 16×16 px, câmera ortográfica alta, sem isometria. Zoom sempre inteiro (pixels nítidos); o padrão mostra cerca de 560×300 px de mundo e a roda do mouse ajusta.
- Herói em 24×32 px com a ferramenta como sprite separado (a chave inglesa aparece na mão e gira no golpe). Inimigos comuns em 16×16, chefe em 40×40.
- Cenário de ferro-velho ferroviário: vagões abertos, locomotivas mortas, montanhas de sucata, carros abandonados, pneus, tambores, eletrodomésticos, carcaças de robô, vigas, empilhadeiras, cabos, mato, poças e manchas de óleo. A densidade varia para os caminhos continuarem legíveis.
- Sombras projetadas (cópia escura dos objetos, deslocada) e elipses sob os personagens. Iluminação ambiente por área (Pátio Zero quente, ferro-velho entardecer, dungeon escura com lanterna) e brilho em postes, escotilha e pilhas.
- Sinais distintos:
  - **pilha vasculhável**: monte com brilho piscando;
  - **entrada de dungeon**: escotilha com borda listrada e seta ciano;
  - **inimigo**: olho vermelho; círculo vermelho crescente antes do golpe;
  - **relíquia**: brilho laranja pulsante.
- HUD compacta: vida, créditos, área, objetivo atual, três habilidades com recarga e acesso ao inventário.

## Mundo

- **Pátio Zero** (ponto de partida): oficina, comerciante (Dona Rebite), terminal de extração, saída leste para o ferro-velho. Entrar aqui restaura a vida.
- **Pátio Ferroviário** (ferro-velho): três linhas de trem com composições que formam paredes com brechas (rotas alternativas), um eixo vertical, caminhos de terra, montanhas de sucata, pilhas vasculháveis e robôs patrulhando. O primeiro vagão, perto da entrada, guarda o Núcleo Pulsante.
- **Estação de Triagem Soterrada** (mini-dungeon): corredor, sala de esteiras com robôs, arena do **Guindaste de Arrasto**.

## Exploração

- Pilhas vasculháveis: clique (ou `E`) e espere 0,75 s. Duas rolagens na tabela da área. A pilha esgota e volta depois de 2 minutos.
- Inimigos derrotados largam sucata ou componentes no chão; o herói recolhe ao passar perto.
- Morrer leva de volta ao Pátio Zero com vida cheia. No protótipo, nada se perde.

## Combate

| Ação | Recarga | Efeito |
|---|---|---|
| Chave inglesa | 0,34 s | 10 de dano em arco curto à frente |
| **Pulso Magnético** (`1`) | 5 s | raio 72 px (108 com a Bobina): 6 de dano, puxa e atordoa inimigos **leves**; pesados só hesitam |
| **Arco Elétrico** (`2`) | 3 s | 14 de dano no alvo mais próximo e salta para mais 2 (mais 4 com o Capacitor Antigo) |
| **Investida Hidráulica** (`3` / clique direito) | 2,4 s | arranque curto e invulnerável; rompe a linha magnética do guindaste; atravessar um inimigo em preparação **interrompe** o golpe |

**Inimigos**

- **Robô de triagem** (leve): patrulha, persegue e prepara o golpe por 0,6 s com um círculo vermelho crescente. Só causa dano se você ainda estiver no círculo.
- **Prensador** (pesado): mais lento e mais resistente; prepara o golpe por 0,95 s numa área maior; o Pulso não o arrasta.

**Guindaste de Arrasto** (miniboss), que ensina a ler avisos e usar a Investida:

1. **Ímã**: linha amarela tracejada piscando por 1,1 s, depois puxa o herói por 1,9 s. Chegar perto do guindaste causa 25 de dano. A Investida rompe a linha.
2. **Gancho**: círculo vermelho no ponto onde você estava, 0,9 s de aviso, 20 de dano.
3. A cada três ataques, chama dois robôs de triagem (no máximo 4 vivos).

Na primeira vitória, deixa a **Bobina do Guindaste** garantida e libera a área de extração Estação de Triagem. Nas vitórias seguintes, a Bobina tem 35% de chance; senão, componentes.

## Drone

- Receita **Drone Faísca**: Chassi Avariado (inicial), Núcleo Pulsante (primeiro vagão), Módulo de Garra e 6 sucatas. Ao montar, o drone já sai equipado com a Garra.
- **Módulo de Garra**: faísca de 5 de dano no inimigo mais próximo a cada 1,1 s.
- **Módulo Magnético** (Bobina + 2 cabos + 1 engrenagem): a cada 3,5 s, um pulso que puxa e atordoa inimigos leves e atrai drops. Na extração, dobra a chance de raros. A troca aparece em combate (aura ciano, pulsos visíveis).
- **Compartimento de Carga** (receita liberada pelo projeto da comerciante): +6 de carga.

## Extração AFK

- Liberada após montar o drone. Inicia-se no terminal do Pátio Zero.
- Áreas: **Borda do Pátio Ferroviário** (ciclo de 6 s) e **Estação de Triagem Soterrada** (ciclo de 8 s, liberada ao derrotar o Guindaste; mais componentes e raros).
- Cada ciclo rola uma vez na tabela da área. A carga do drone começa em 10 unidades; ao encher, a extração termina e mostra o resultado.
- A tela de extração mostra o drone indo à pilha, trabalhando e voltando à caçamba, além do estado, carga, progresso do ciclo e achados.
- **Encerrar e recolher** a qualquer momento: ciclos concluídos ficam, o ciclo em andamento se perde.
- **Retomar controle** (botão ou WASD): encerra e entrega o acumulado.
- Funciona com a aba em segundo plano; fechar a aba encerra a sessão e guarda os ciclos concluídos antes do fechamento. Não há produção offline. Uma extração por vez. Cada resultado só pode ser recolhido uma vez.

## Loot e itens

| Classe | Itens | Uso principal |
|---|---|---|
| Sucata comum | Sucata | base de toda receita; vende a 1 cr |
| Componentes | Engrenagem, Cabo de Cobre, Servomotor, Célula de Carga | receitas; desmontam em sucata |
| Peças | Chassi de Drone Avariado, Núcleo Pulsante | montagem do primeiro drone |
| Módulos e melhorias | Garra, Magnético, Compartimento de Carga | instalados no drone |
| Relíquias | Bobina do Guindaste, Capacitor Antigo | equipadas, alteram habilidades; ou viram matéria-prima |

O inventário mostra os usos de cada item: equipar, montar, desmontar e vender.

## Raridade

Toda a interface usa a mesma cor por tier: borda do slot e da célula da mochila, nome no detalhe, etiqueta, linha do mercado e brilho do item caído no chão. A fonte da verdade é `RARITY` / `rarityOf` em `src/data/items.ts`.

| Tier | Cor | Itens |
|---|---|---|
| Comum | cinza `#b8bcc4` | Sucata, Engrenagem, Cabo de Cobre, Chave Inglesa Gasta |
| Incomum | verde `#8fd16a` | Servomotor, Célula de Carga, peças e módulos do drone, Chave Inglesa Reforçada, Boné, Jaqueta, Luvas, Botas |
| Raro | azul `#5fa8e8` | Pé-de-cabra Hidráulico, Parafuso da Sorte |
| Épico | roxo `#b48ae6` | Capacitor Antigo |
| Relíquia | laranja `#f6b24a` | Bobina do Guindaste |

## Ambiente e escala

- O herói (24×32 px, cerca de 1,75 m) é a régua. Objetos são desenhados em 3/4, com topo e face frontal, para ter altura ao lado dele. A colisão continua no tile da base.
- **Sucata coletável**, toda desmontável uma vez a cada ~3 min, marcada por um brilho e destacada ao passar o mouse. Inclui:
  - montes de sucata (várias variantes, encavalados para formar montanhas);
  - caixotes, tambores, conjuntos de tambores, pneus empilhados, geladeiras e caixas de carga;
  - motores, carcaças de robô, empilhadeiras, canos, vigas e braços de guindaste;
  - carros (2×2 tiles), vagões e locomotivas (3 tiles, quase o dobro da altura do herói).
- **Sucata solta**: ~30 itens no chão do ferro-velho por visita; basta passar por cima.
- **Vegetação**: árvores frondosas, pinheiros e árvores secas nas manchas de grama (nunca colados aos caminhos), arbustos com frutinhas e tufos de mato. Tudo balança de leve.
- **Luz**: ambiente quente no Pátio Zero, entardecer no ferro-velho, escuro com lanterna na dungeon; postes, faróis das locomotivas, escotilha e pilhas emitem brilho.

## Comércio

- Moeda interna: **créditos (cr)**. Começa com 10.
- A comerciante compra tudo que tem preço (o Núcleo Pulsante não) e vende Cabo (14 cr), Servomotor (24 cr) e o Projeto do Compartimento de Carga (40 cr, compra única).
- Fora desta fase: mercado entre jogadores, cripto, NFT, depósitos, saques e dinheiro real.
