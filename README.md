# Gatinho Pomodoro

Pomodoro gamificado: cuide do gatinho enquanto foca. Abra `index.html` no **Chrome ou Edge 116+**.
O botão **📌 Fixar** coloca o app numa janela pequena que fica acima das outras.

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `js/config.js` | **Todas as regras**: taxas, limites, pontos, textos, presets. Comece por aqui. |
| `js/random.js` | Sorteios (`between`, `pick`). |
| `js/html.js` | Escape de texto e ícones SVG. |
| `js/life.js` | Nome, idade, fase da vida, personalidade e regras de dia/noite. |
| `js/pet.js` | Gatinho: barras, pontuação, morte/reviver + salvamento (localStorage). |
| `js/pomodoro.js` | Timer (iniciar, pausar, cancelar, terminar). |
| `js/profile.js` | Progresso permanente: moedas, histórico, meta, sequência, combo, contadores. |
| `data/achievements.js` | **Lista de conquistas** (basta adicionar itens). |
| `js/achievements.js` | Motor que desbloqueia conquistas. |
| `js/panels/` | Janelinhas: gerenciador + um arquivo por painel. |
| `data/items.js` | **Catálogo da loja**: cores e roupinhas (basta adicionar itens). |
| `js/wardrobe.js` | Aplica cor e roupinhas no SVG do gatinho. |
| `data/rare-events.js` | **Eventos raros** (presente, loucura, ciúmes...): basta adicionar itens. |
| `js/setup.js` | Tela de escolha de gênero e nome (primeiro uso e ao reviver). |
| `js/music/` | Música: leitura de links/busca (`youtube.js`), player (`player.js`), tela (`music-view.js`). |
| `electron/` | App de desktop: janela no topo, servidor local, busca de músicas e migração do save. |
| `js/ambient.js` | Ambiente: dia/noite (manual, rápido ou horário local), sono e luz. |
| `js/scenery.js` | Cenário em SVG: parede, chão, janela com paisagem, móveis, sujeirinhas e limites. |
| `js/scene-strip.js` | Tira de cenários abaixo do palco (quadradinhos e setinhas). |
| `js/furniture-editor.js` | Editor de móveis no palco (selecionar, arrastar, transformer de tamanho fixo). |
| `js/care.js` | Um cuidado completo: confere o suprimento, aplica, gasta a dose e paga as moedas. |
| `js/missions.js`, `data/missions.js` | Missões do dia (lista editável) e o motor que as confere. |
| `data/habits.js` | Hábitos sugeridos na pausa (lista editável). |
| `js/sound.js` | Sons sintetizados (sininho de conquista, moedas, miado, ronronar, fim do timer). |
| `js/notify.js`, `js/backup.js` | Notificações do sistema e backup (exportar/importar) do progresso. |
| `js/updates.js`, `js/panels/update-panel.js` | Botão 🔄 de atualização: consulta o GitHub, compara versões e escolhe o arquivo certo. |
| `electron/app-info.js` | Como o app está rodando (instalado, portátil, AppImage ou código-fonte) e onde ficam os dados. |
| `scripts/set-version.js` | Muda a versão em todos os lugares: `pnpm version:set 1.2.3`. |
| `.github/workflows/release.yml` | Gera os instaladores e portáteis e publica na Release do GitHub quando você cria uma tag `v*`. |
| `build/` | Ícone do app (`icon.png` e o desenho-fonte `icon.svg`). |
| `js/animator.js` | Escolhe qual cena do gatinho tocar. |
| `js/ui.js` | Desenha o estado na tela e repassa cliques. Sem regras de jogo. |
| `js/floating-window.js` | Janela flutuante (Document Picture-in-Picture). |
| `js/main.js` | Liga tudo e roda o relógio de 1 segundo. |
| `css/app.css` | Layout e tema (claro/escuro). |
| `css/cat.css` | Animações do gatinho: uma cena = uma classe `s-<nome>` com `@keyframes` próprios. |

## Como o jogo funciona

- 4 barras (fome, sede, diversão, carinho) descem com o tempo e por eventos aleatórios.
- Abaixo de 40 o gatinho pede ajuda; abaixo de 15 fica bravo; em 0 ele morre e a pontuação zera (o recorde fica).
- Cuidados dão pontos (x2 se ele realmente precisava). Foco concluído dá 2 pontos por minuto.
- Com foco rodando e nenhuma necessidade, o gatinho dorme.

## Como adicionar uma nova animação

1. Crie `.s-nome { ... }` e seus `@keyframes` em `css/cat.css`.
2. Use a cena em `status()` (`main.js`) ou numa ação em `CONFIG.actions`.

## Janela sempre no topo

**Opção 1 – App de desktop (recomendado no Linux).** Requer Node.js:

    npm install
    npm start

Abre uma janela pequena sempre acima das outras. Se der erro de *sandbox* (comum no Ubuntu 24+),
rode `npx electron . --no-sandbox`.

**Opção 2 – Pelo navegador.** O botão 📌 Fixar usa uma janela flutuante do Chrome/Edge, mas no Linux
o "sempre no topo" depende do gerenciador de janelas. Se ela não ficar no topo, force pelo sistema:
- GNOME: `Alt+Espaço` na janela → *Sempre no topo*.
- KDE: `Alt+F3` → *Mais ações* → *Manter acima das outras*.
- X11 (qualquer): `wmctrl -r :SELECT: -b add,above` e clique na janela.

## Eventos aleatórios (independem do timer)

- **Eventos de necessidade:** a cada 8 a 20 minutos (sorteado a cada vez, média ~14 min) uma barra boa cai para 30–39 e o gatinho pede ajuda. Nunca é a mesma necessidade duas vezes seguidas e nunca deixa ele bravo de repente.
- **Gracinhas:** a cada 45 a 150 segundos, se estiver tudo bem, ele lambe a patinha, dorme um pouco ou brinca com a bolinha.
- **Tempo parado:** se o app ficar fechado ou o computador suspenso, as barras descem (no máximo 30 min) sem eventos e sem matar o gatinho.
- Ajuste tudo em `js/config.js` (`randomEvent`, `idleFlavor`, `needs[].minutesToEmpty`).

## Testes

    node tests/simulate.js   # eventos aleatórios e tempos das barras
    node tests/progress.js   # moedas, meta, sequência, combo, conquistas e loja
    node tests/life.js       # fases da vida, doença, higiene, gênero e eventos raros
    node tests/music.js      # links do YouTube, busca, extração de resultados e servidor local
    node tests/electron.js   # agente do navegador, links permitidos, cópia do save, tipo de instalação e dados portáteis
    node tests/updates.js    # leitura do repositório, versões, arquivo certo e consulta ao GitHub (simulada)
    node tests/build.js      # configuração de build, ícone, versão e fluxo de release
    node tests/ambient.js    # ambiente, energia, dificuldade, suprimentos, móveis e missões
    node tests/economy.js    # simula 100 h de jogo e confere se a economia é estável
    node tests/scenery.js    # cenário, sujeirinhas, móveis, arquivos do app e a bochecha
    node tests/extras.js     # sons (incluindo o da conquista), backup e notificações
    node tests/page-*.js     # página inteira (requer: pnpm add -D jsdom); page-world cobre os recursos mais novos

Simula centenas de horas e confere intervalos, distribuição dos eventos e estabilidade dos tempos.

## Avisos no terminal (Electron)

`libva error`, `GetVSyncParametersIfAvailable` e "Automatic fallback to software WebGL has been deprecated" vêm do driver de vídeo (ex.: nouveau) e do player do YouTube rodando sem GPU. São inofensivos.
Para iniciar: `pnpm start` (ou `pnpm dev`).

**Wayland (KDE/GNOME):** o "sempre no topo" só funciona em janelas X11. Desde o Electron 38, numa sessão Wayland ele escolhe Wayland sozinho, então o `start` já passa `--ozone-platform=x11` na linha de comando (e, se o app for aberto de outro jeito, ele se reabre sozinho com esse pedido). Sem isso a janela pode abrir em branco com o erro `XGetWindowAttributes failed for window 1`.

**pnpm 11 ou mais novo:** a liberação do script do Electron fica em `pnpm-workspace.yaml` (`allowBuilds`); o campo `pnpm` do `package.json` não é mais lido.
O app desliga a aceleração por GPU por padrão (usa menos memória e some com os avisos). Para ligar: `GATINHO_GPU=1 pnpm start`.

## Janelinhas (painéis)

A barra de ícones do topo abre/fecha painéis dentro da mesma janela (só um por vez, sem janelas soltas na tela).
Clique no ícone de novo, no ✕ ou aperte Esc para fechar. Para criar um painel novo, veja o comentário no topo de `js/panels/panel-manager.js`.

## Progresso permanente

- **Pontos ⭐** são da vida atual do gatinho (zeram se ele morrer). **Moedas 🪙** são permanentes.
- Moedas: 1 por minuto de foco, 3 por cuidado (6 se ele precisava), 20 por meta diária, bônus de sequência (3, 7 e 30 dias) e recompensa das conquistas.
- Combo: focos seguidos sem cancelar (zera após 2 h sem concluir) dão pontos extras.
- Tudo é ajustável em `CONFIG.progress` (`js/config.js`).

## Como criar uma conquista nova

Adicione um item em `data/achievements.js` (veja o comentário no topo do arquivo). Não precisa mexer em código.

## Roteiro

Feito (resumo): painéis, histórico, metas, sequência, combo, moedas, conquistas, loja (cores, roupinhas, temas, cenários, móveis, suprimentos),
inventário, vida do gatinho (nome, gênero, fases, personalidade, doença, higiene), eventos aleatórios e raros, música, ambiente
(dia/noite, luz, cansaço), cenário com janela, móveis com transformer, sujeirinhas, café na pausa, missões, hábitos, dificuldade, sons,
notificações e backup.

Próximos (ideias):
- [ ] **World Ranking** de verdade (o botão e o painel já existem, "em breve"): precisa de um servidor e de contas.
- [ ] Mais conquistas, itens, cenários e móveis (basta adicionar em `data/`).
- [ ] Mais animações (o gatinho interagindo com os móveis).

## Loja, inventário e skins

- 🛍️ **Loja** e 📦 **Inventário** abrem só na parte de baixo da janela, para você ver o gatinho enquanto escolhe.
- Itens têm 4 encaixes: cor do pelo (sempre uma equipada), chapéu, rosto e pescoço (podem ser combinados).
- Para criar um item novo, adicione um objeto em `data/items.js` (o comentário no topo explica os campos).
  Para um novo encaixe (ex.: "costas"), adicione em `SLOTS` e crie um `<g id="slot-costas">` no SVG do `index.html`.
- A cor do pelo usa as variáveis CSS `--coat` e `--ear` (ver `css/cat.css`), por isso todas as animações funcionam com qualquer cor.

## Vida do gatinho

- **Nome e fases:** filhote (0–6 dias, menor e gasta 15% mais rápido), adulto (7–59) e idoso (60+). Idade em dias reais.
- **Personalidade:** sorteada a cada vida (preguiçoso, brincalhão, dengoso, comilão, fresquinho) e muda o ritmo de uma barra.
- **Reviver = nasce um filhote novo** (mesmo nome); o anterior vai para o cemitério, no painel 🐾 Gatinho.
- **Dia e noite** (21h–6h, em `CONFIG.life.night`): o cenário escurece, as barras descem mais devagar e, sem timer rodando, ele dorme.
- **Higiene:** quinta necessidade (🧹 Limpar). Higiene baixa aumenta 3x a chance de doença.
- **Doença:** chega por evento aleatório, deixa o gatinho verdinho e acelera as barras. O botão 💊 Remédio aparece só nessa hora; sem remédio por 40 min ele não resiste.
- **Eventos raros** (a cada 25–70 min): presente com moedas, loucura de gato, ciúmes e soneca. Veja `data/rare-events.js`.

## Temas da janela e Cenários

Na loja há duas abas diferentes:

- **Temas** pintam a **janela inteira**: botões, painéis, textos, barras de rolagem, campos e também o palco onde o gatinho fica.
  Opções: Padrão (segue o claro/escuro do sistema), Oceano, Floresta, Pôr do sol, Sakura, Meia-noite e Café.
  No app de desktop o Electron também pinta o fundo da janela. A barra de título é do sistema (KDE, GNOME...) e o app não consegue pintá-la.
- **Cenários** trocam só o **fundo do gatinho** (parede, chão e enfeites): Quarto (padrão, acompanha o tema), Jardim, Praia, Entardecer, Neve e Espaço.
  Cada cenário tem versão de dia e de noite, que muda sozinha.

Quando o palco fica escuro, os textos clareiam e o gatinho ganha um contorno claro para não sumir.
Para criar um tema ou cenário novo, adicione um item `slot: 'theme'` ou `slot: 'scene'` em `data/items.js` (o comentário no topo explica os campos).

## Escolha do felino (gênero e nome)

No primeiro uso (e ao reviver) aparece uma tela para escolher **macho ou fêmea** e o nome (🎲 sugere um). Até confirmar, o tempo não passa para o gatinho.
Os textos concordam com o gênero (ele/ela, o/a): em `data/` e `js/config.js` use `{Ele}`, `{o}`, `{gatinho}`, `{um}`... (veja `Life.speak` em `js/life.js`).

## Música (🎵)

- Digite o **nome da música** para buscar, ou cole o **link de uma música ou de uma playlist** do YouTube.
- Fechar o painel não para a música: ela continua e a barrinha no topo do palco tem ⏯ e ⏭.
- **Precisa do app de desktop** (`pnpm start`): o YouTube não toca em páginas abertas direto do disco. Por isso o app serve o jogo em `http://127.0.0.1:47633`.
  No navegador, sirva a pasta (`npx serve`) e use a busca por chave da API (abaixo) ou cole links.
- **Busca pelo nome:** no app de desktop ela lê a página de resultados do YouTube (sem chave, mas depende do formato da página e pode parar de funcionar se o YouTube mudar). Alternativa oficial e estável: crie uma chave da *YouTube Data API v3* e cole no painel (a cota gratuita dá ~100 buscas por dia).
- O vídeo só fica visível enquanto o painel está aberto; o som continua depois. O YouTube recomenda manter o player visível; se preferir, dá para deixá-lo sempre à mostra.
- Na janela flutuante do navegador (📌) o vídeo fica oculto e só os controles funcionam.

### Se o vídeo mostrar "Ocorreu um erro"

1. Rode `pnpm install` de novo: o app agora pede o **Electron 44** (Chromium 152). Versões antigas, como a 33, usam um Chromium de 2024 que o YouTube pode recusar.
2. O app já se apresenta ao YouTube como um navegador comum (sem "Electron" na identificação).
3. O painel mostra o erro e o código dele (ex.: `código 150` = o dono do vídeo não permite tocar fora do YouTube; `153` = o YouTube recusou a origem). Se o vídeo não começar em 12 s, aparece um aviso.
4. O botão **↗ Abrir no YouTube** abre a música atual no navegador do sistema.
5. Se vários vídeos falharem, tente a música pelo link (colar o link) ou outra versão; alguns vídeos são bloqueados para tocar fora do YouTube.

### Seu progresso ao atualizar

Além do navegador interno, o app agora guarda uma **cópia do progresso em arquivo** (`save-mirror.json`, na pasta de dados do app). Se o endereço do app mudar de novo, o progresso volta sozinho.

Como o app passou a abrir por `http://127.0.0.1`, o navegador interno enxerga um "endereço novo". Na primeira abertura o app traz o progresso salvo antes automaticamente.
Se algo não aparecer, o save antigo fica guardado em `legacy-save.json` na pasta de dados do app.

## Economia (estável, testada por simulação)

- **Renda:** 1 moeda por minuto de foco; 3 por cuidado grátis (6 se ele precisava); 20 pela meta do dia; bônus de sequência; missões do dia (6 a 12 cada, +10 se fizer as 3); conquistas.
- **Suprimentos (gastam moedas):** ração em pacote de 6 por 12 🪙, garrafão de água de 6 por 6 🪙, remédio por 15 🪙. Ração, água e remédio **não rendem moedas** (já custam).
- **A água vem do trabalho:** cada 20 min de foco concluído enchem 1 dose. Quem não foca precisa comprar garrafão; quem foca quase não gasta.
- **Em 100 h de jogador atento:** ~88 🪙/h de renda; ~18% vão para suprimentos; sobram ~72 🪙/h para a loja; comprar todo o catálogo de enfeites leva ~40 h. Rode `node tests/economy.js`.
- Tudo ajustável em `js/config.js` (`supplies`, `progress`, `difficulty`) e `data/items.js` (preços).

## Ambiente: dia, noite, luz e cansaço (painel 🌙)

- **Ciclo:** *Manual* (você escolhe dia ou noite), *Rápido* (um dia inteiro em 20, 40 ou 90 min) ou *Horário local* (noite das 21h às 6h).
- **Durante a noite:** *Dorme a noite inteira* (escuro, sem eventos aleatórios; o 💡 no palco acende e apaga a luz) ou *Fica ativo* (os eventos continuam).
- **Cansaço (barra 🔋):** só existe nos ciclos Rápido e Local. De dia a energia gasta (~55 por dia); dormindo no escuro ela volta; com a luz acesa o gatinho fica **cansado** (animação própria) e cansa mais rápido; a pausa do pomodoro descansa (+2/min). Abaixo de 40 ele fica com cara de cansado; abaixo de 15 não brinca e as barras descem 15% mais rápido.
- A janela do cenário mostra o dia ou a noite lá fora, seguindo o ciclo.

## Cenários e móveis

- **Cenários** (loja → Cenários): Quarto (padrão, acompanha o tema), Jardim, Praia, Entardecer, Neve e Espaço, cada um com sua paisagem na janela.
  Os que você tem aparecem como quadradinhos abaixo do palco; clique para trocar (setinhas ◀ ▶ quando houver muitos).
- **Móveis** (loja → Móveis; 11 peças): no inventário, *Colocar* liga a edição: clique no móvel e arraste; as setas ajustam (Shift = 16), Delete guarda, Esc termina.
  O tamanho é **fixo** (o transformer mostra os cantos travados 🔒). Cada cenário tem seus próprios móveis.
- **Sujeirinhas:** conforme a higiene cai (abaixo de 60, 45, 30 e 15) aparecem até 4 no chão; limpar a caixinha as tira.

## Missões, hábitos, configurações

- **Missões (🎯):** 3 por dia, sorteadas de `data/missions.js`. **Hábitos:** na pausa aparece um (beber água, alongar...); "Fiz!" rende 3 🪙 e descansa o gatinho.
- **Pausa = café:** durante a pausa o gatinho toma café.
- **Configurações (⚙):** sons e volume, notificações do sistema, dificuldade (Relaxado: não morre; Normal; Difícil: mais pontos e moedas) e **backup** (exportar/importar o progresso).
- **Sons:** cada conquista toca um sininho (arpejo dó-mi-sol-dó); também há som de moeda, miado, ronronar e fim do timer.
- **World Ranking (🌍):** botão reservado para uma atualização futura.

## Atualizações (botão 🔄 no cabeçalho)

O botão abre o painel **Atualizações**: versão instalada, repositório do GitHub, "Verificar agora" e, se houver versão nova, as notas dela e o caminho para atualizar.

1. **Aponte para o seu repositório** (uma vez): no painel, cole `usuario/repositorio` ou o endereço do GitHub; ou troque `SEU-USUARIO` em `repository` e `homepage` do `package.json`. O repositório precisa ser **público**.
2. **De onde vem a versão nova:** da última *Release* do repositório (é de lá que saem os instaladores). Sem releases, lê a versão do `package.json` da branch principal.
3. **Como atualiza**, conforme o tipo de instalação (aparece no painel):
   - **Instalado ou portátil** (Windows `.exe`, AppImage, `.deb`, `.rpm`): "Baixar ..." abre no navegador o arquivo certo para o seu sistema; instale por cima (o progresso é mantido).
   - **Código-fonte** (`pnpm start`): se a pasta é um repositório git, "Atualizar agora" roda `git pull --ff-only` (nunca sobrescreve o que você mudou) e oferece reiniciar. Se mudaram as dependências, rode `pnpm install`.
4. **Automático:** uma consulta por dia ao abrir o app (dá para desligar). Quando há versão nova aparece um **!** no 🔄. O GitHub aceita 60 consultas por hora por internet; se estourar, o app lê o `package.json` pelo `raw.githubusercontent.com`.

## Gerar o instalador e a versão portátil

Pré-requisito: `pnpm install` (o `electron-builder` já é dependência). Os arquivos saem em `dist/`.

| Comando | O que gera |
|---|---|
| `pnpm dist:linux:portable` | `GatinhoPomodoro-x.y.z-linux-x86_64.AppImage` (portátil: um arquivo só) |
| `pnpm dist:linux:installer` | `...-linux-amd64.deb` e `...-linux-x86_64.rpm` (instaladores) |
| `pnpm dist:linux` | os três acima |
| `pnpm dist:win:installer` | `GatinhoPomodoro-x.y.z-win-x64-Setup.exe` (instalador, com escolha de pasta) |
| `pnpm dist:win:portable` | `GatinhoPomodoro-x.y.z-win-x64-Portable.exe` (portátil) |
| `pnpm dist:win` | os dois do Windows |
| `pnpm pack` | só a pasta descompactada (teste rápido, sem instalador) |

- **Windows:** gere no próprio Windows, ou deixe o GitHub fazer (abaixo). Gerar o `.exe` no Linux exige o Wine.
- **`.rpm`:** precisa do pacote `rpm`/`rpm-build` instalado (`sudo dnf install rpm-build`).
- **Versão portátil:** guarda tudo (progresso, configurações) na pasta `gatinho-data`, **ao lado do arquivo**. Se você já jogava instalado, o progresso é copiado na primeira vez. Para levar para outro computador, copie o arquivo e a pasta.
- **Instalado ou código-fonte:** os dados ficam na pasta do sistema (`~/.config/gatinho-pomodoro` no Linux, `%APPDATA%\gatinho-pomodoro` no Windows), a mesma nos dois.
- Os instaladores **não são assinados**: o Windows pode mostrar "Windows protegeu seu PC" (clique em *Mais informações* → *Executar assim mesmo*).
- **AppImage:** precisa de FUSE (`sudo dnf install fuse` / `libfuse2`) ou rode com `--appimage-extract-and-run`. Em sistemas que restringem namespaces (Ubuntu 24.04), o AppImage pode exigir `--no-sandbox`.

### Publicar uma versão nova (e o botão 🔄 passa a avisar)

```
pnpm version:set 1.1.0                      # muda package.json e js/config.js juntos
git add -A && git commit -m "v1.1.0"
git tag v1.1.0 && git push --follow-tags    # o GitHub gera tudo e cria a Release sozinho
```

O fluxo `.github/workflows/release.yml` monta o Linux e o Windows em máquinas do GitHub e anexa os arquivos à Release. Ele só roda em tags `v*`, e confere que a tag é igual à versão do `package.json`.
