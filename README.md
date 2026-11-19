# Scrapo (versão navegador)

RPG 2D de ação e extração AFK, visto de cima, com pixel art em estilo 16-bit. Você explora ferros-velhos de uma colônia industrial abandonada, vasculha montanhas de sucata, luta contra máquinas que ainda seguem ordens antigas e monta drones na oficina. Com a aba aberta, o drone pode fazer extrações sozinho.

Este repositório é a **versão idle de navegador**. O Scrapo 3D em Unity continua no repositório separado `C:\Projetos\Games\SCRAPO` (`beb0pp/scrapo`). Os dois não compartilham código nem assets.

## Rodar

Requer Node 20+ (testado com Node 24).

```bash
npm install
npm run dev        # http://localhost:5180
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm test` | testes unitários (regras de AFK, save, oficina, comércio, pathfinding) |
| `npm run build` | typecheck + build de produção em `dist/` |
| `npm run preview` | serve o build em http://localhost:5181 |
| `npm run maps` | gera o tileset PNG e os mapas Tiled que ainda não existem (`-- --force` sobrescreve) |

Não precisa de servidor nem de banco. O progresso fica no `localStorage` do navegador.

## Controles

| Entrada | Ação |
|---|---|
| Clique esquerdo no chão | andar até lá (contorna obstáculos); segurar e arrastar mantém andando |
| Clique esquerdo num inimigo | persegue e ataca com a chave inglesa |
| Clique esquerdo em pilha, destroço, oficina, comerciante, terminal ou placa | vai até lá e usa (desmontar anima a chave batendo) |
| Clique direito | Investida Hidráulica na direção do cursor |
| `Q` / `W` / `E` / `R` | Pulso Magnético / Arco Elétrico / Investida Hidráulica / Sobrecarga (o módulo do drone dispara com força total; fica apagado até montar o drone) |
| `T` ou botão **Auto** | liga/desliga o modo automático |
| `1`–`5` | troca a ferramenta equipada (hotbar) |
| `F` | interagir com o que está perto · `Espaço` golpe da chave |
| `I` | Mochila (janela à direita) · `Esc` fecha painéis |
| Roda do mouse | zoom (passos inteiros, fica salvo) · setas também movem |

## Modo automático e Ferrugem

- **Auto (`T`)**: o sucateiro desmonta a sucata alcançável mais próxima, recolhe o que cai e enfrenta inimigos por perto. Usa as mesmas habilidades e recargas do controle manual (Pulso com 2+ inimigos, Arco no alvo, Sobrecarga com drone), esquiva com a Investida quando um inimigo carrega um golpe (círculo vermelho) e recua com menos de 35% de vida. A vida regenera devagar após 4 s sem dano. Ainda dá para morrer.
- Qualquer clique ou tecla assume o controle na hora; o Auto volta sozinho 3 s depois da última ação manual.
- **Ferrugem**, o cão-robô, acompanha você desde o início: morde inimigos perto do herói e busca sucata caída para a mochila.

## Roteiro rápido de teste (≈10 min)

1. **Jogar**, ler a introdução, **Começar**. Você está no Pátio Zero.
2. Siga a seta à direita (leste) até o **Pátio Ferroviário**. Clique na pilha brilhante logo abaixo do primeiro vagão: você recebe o **Núcleo Pulsante**.
3. Vasculhe mais pilhas e derrube robôs de triagem até ter **2 engrenagens, 1 cabo e 10 sucatas**. Observe o círculo vermelho antes de cada golpe inimigo.
4. Volte ao Pátio Zero, clique na **bancada da oficina**: monte o **Módulo de Garra** e depois o **Drone Faísca**. O drone passa a te seguir e dar faíscas nos inimigos.
5. Clique no **terminal** do centro → **Iniciar** na Borda do Pátio Ferroviário. Veja o drone trabalhar, troque de aba por um minuto e volte: o progresso segue o relógio.
6. Recarregue a página no meio da extração: os ciclos concluídos aparecem para **Recolher**. Recolha e recarregue de novo: não dá para recolher outra vez.
7. Clique na **comerciante** (Dona Rebite) e venda o excedente.
8. No nordeste do ferro-velho, desça pela escotilha até a **Estação de Triagem Soterrada**. O **Guindaste de Arrasto** pisca uma linha amarela antes de puxar: use a **Investida** (`E` ou clique direito) para romper o ímã.
9. Pegue a **Bobina do Guindaste**. Na oficina, monte o **Módulo Magnético** e instale no drone. Na próxima saída o drone emite pulsos que puxam e atordoam robôs leves.

## Documentação

- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md): visão, regras de jogo, direção visual
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): código, cenas, mapas, dados, persistência, AFK, backend futuro
- [docs/ROADMAP.md](docs/ROADMAP.md): o que está jogável e as próximas fases
