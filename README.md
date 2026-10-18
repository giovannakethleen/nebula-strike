# NEBULA STRIKE — protótipo inicial

Protótipo de Space Shooter com Angular standalone + Phaser 3. O motor do jogo roda no navegador; nesta etapa não existe backend nem ranking global.

## Requisitos
- Node.js 20.19+ ou 22.12+
- npm

## Executar localmente
Abra um terminal na pasta do projeto e execute:

```bash
npm install
npm start
```

Acesse `http://localhost:4300`.

## Controles
- **WASD / setas:** movimentar
- **Espaço:** disparar continuamente
- **Esc:** pausar/retomar

## Funcionalidades desta base
- Tela inicial e identidade visual inicial
- Cena Phaser com arena 4:3, nave, estrelas e inimigos de quatro tipos
- Movimento, disparos, colisões, dano, vidas extras coletadas automaticamente ao passar pela altura da nave e limite de cinco vidas
- Ondas progressivas e pontuação
- Primeira onda balanceada com menos inimigos, menor velocidade e intervalo maior entre aparições
- Inimigos que escapam pela parte inferior da arena não removem vidas
- Disparos inimigos seguem em linha reta e desaparecem ao sair da arena ou após quatro segundos
- Uma nave jogável com atributos fixos
- Game Over e recorde pessoal salvo no navegador
- Controles, recorde e ajuste de volume na página inicial, com layout responsivo

## Próximas etapas
1. Testar e ajustar o protótipo local.
2. Corrigir/balancear mecânicas e adicionar power-ups e chefes.
3. Criar API Laravel (`POST /api/scores`, `GET /api/scores`) e migrations MySQL.
4. Conectar o ranking global ao Angular.
5. Adicionar testes, áudio e preparar deploy.

## Observações
- O recorde pessoal usa `localStorage`; o ranking global ainda não foi implementado.
- A pontuação é calculada no cliente e pode ser manipulada. Um ranking público precisará de validações e rate limiting no backend.
- A compilação e os testes devem ser executados no ambiente local após `npm install`.
