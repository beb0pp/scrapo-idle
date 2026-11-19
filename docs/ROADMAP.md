# Roadmap

## v0.1: primeira versão jogável (esta rodada)

### Entregue

- Tela inicial com entrada direta, introdução e controles. Continuar ou apagar progresso.
- **Pátio Zero** com oficina, comerciante, terminal de extração e saída para o ferro-velho.
- **Pátio Ferroviário** (72×48 tiles): três linhas de trem com brechas (rotas alternativas), montanhas de sucata, carros, locomotivas, pilhas vasculháveis, robôs de triagem e prensadores.
- **Estação de Triagem Soterrada** com o **Guindaste de Arrasto** (ímã com aviso, gancho com aviso, reforços) e a Bobina como recompensa.
- Controle por mouse com pathfinding (andar, atacar, usar), clique direito para a Investida e teclado como alternativa.
- Três habilidades: Pulso Magnético, Arco Elétrico, Investida Hidráulica. Interrupção de golpes pela Investida.
- Inventário com usos múltiplos (equipar, montar, desmontar, vender) e relíquias que alteram habilidades.
- Drone montável (chassi + núcleo + módulo), que luta ao seu lado. Módulo Magnético alternativo a partir da Bobina.
- Extração AFK com relógio explícito: progresso em segundo plano, encerrar e recolher, retomar controle, fim por carga cheia, aba fechada guarda ciclos concluídos, coleta única.
- Comércio com NPC: venda de excedentes, compra de componentes e do projeto do Compartimento de Carga.
- Save local versionado e validado.
- Arte original gerada por código: tileset 16×16 com 54 tiles, herói 24×32 com ferramenta visível, sombras projetadas, iluminação por área, zoom inteiro ajustável pela roda do mouse.
- 24 testes unitários sobre regras de AFK, save, oficina, comércio e pathfinding.

### Critérios de conclusão da v0.1

- [x] Build de produção e typecheck sem erros; testes passando.
- [x] Movimento e colisão; transição Pátio Zero ⇄ ferro-velho ⇄ dungeon.
- [x] Combate: avisos antes do dano, Pulso puxa leves, Arco salta, drops recolhidos.
- [x] Primeiro vagão entrega o Núcleo Pulsante.
- [ ] Ciclo completo no navegador: montar e equipar o drone na oficina; extração com troca de aba; recarregar; recolher uma única vez; vender; Bobina → Módulo Magnético. As regras estão cobertas por testes unitários; falta a passada ponta a ponta na interface.

## Próximas fases

### 1. Variedade jogável

- Áreas novas com materiais e ameaças próprias: **Desmanche Inundado** (água, choque, cabos) e **Fábrica Abandonada** (esteiras ativas, prensas).
- Uma mini-dungeon e um miniboss por área, cada um com relíquia que muda uma habilidade.
- Ferramentas especializadas (maçarico, ímã de mão) e companheiros terrestres, quando cada um ampliar as escolhas de build.
- Mais drones e módulos; segundo slot de módulo.
- Arte: animações de ataque do herói, mais variações de tiles e de sucata. Avaliar pacotes de assets compatíveis com a licença escolhida.

### 2. Persistência online

- Contas e progresso no servidor (C# + ASP.NET Core + PostgreSQL; detalhes em ARCHITECTURE.md).
- Servidor com autoridade sobre inventário, moeda, fabricação e recompensas negociáveis.
- AFK validada no servidor por heartbeat; sessões desconectadas encerradas no último heartbeat.

### 3. Mercado entre jogadores

- Listagem, compra, cancelamento e histórico em moeda interna, com reserva do item e transferência atômica.
- Começar pelos componentes com uso comprovado nas receitas. Ordens de compra quando o volume justificar.

### Proposta em discussão: Ferromancia (tecnologia + magia)

Éter como energia da colônia, Círculo de Alquimia para encantar ferramentas, runas com soquetes e sinergias, variantes rúnicas das habilidades e, depois, um time de companheiros em expedições AFK por turnos. Detalhes e perguntas em [PROPOSTA_TECNOMAGIA.md](PROPOSTA_TECNOMAGIA.md).

### 4. Integração com streaming (Kick)

Referência de modelo: jogos idle que dão vantagens a quem transmite e a quem assiste.

- Vincular a conta do jogo à conta Kick por OAuth: o jogador autoriza, o servidor guarda só o identificador.
- **Espectador**: pontos por tempo assistindo um streamer parceiro, trocáveis por bônus no jogo (ciclo de extração mais rápido por algumas horas, uma caixa de sucata, cosméticos). Nada que vire moeda negociável no mercado.
- **Streamer parceiro**: bônus próprios enquanto está ao vivo jogando, eventos para o chat (ex.: "chuva de sucata" que todos os espectadores vinculados recebem) e código de parceiro.
- Requer a fase de persistência online: pontos e resgates ficam no servidor, com limite diário, verificação de que o stream está ao vivo pela API da Kick, e registro de cada resgate para evitar abuso (contas falsas, abas abertas sem ninguém assistindo).
- Antes de implementar: confirmar o programa de parceria e os termos da API de desenvolvedor da Kick, e o que eles permitem recompensar.

### 5. Comunidade

- Discord para teste fechado: canais de feedback, bugs e builds.
- Clipes para X/Twitter mostrando o ciclo real: achar uma peça, montar o drone, voltar ao mapa com uma habilidade nova.
