/**
 * Textos com {o} {ele} {gatinho}... mudam conforme o gênero escolhido (ver Gatinho.Life.speak).
 *
 * Todas as regras do jogo ficam aqui.
 * Para ajustar dificuldade, pontos, textos ou tempos, edite só este arquivo.
 */
window.Gatinho = window.Gatinho || {};

Gatinho.CONFIG = {
  storageKey: 'gatinho-pomodoro:v1',
  version: '1.0.0', // igual ao "version" do package.json ("pnpm version:set 1.2.3" muda os dois; um teste confere)
  defaultCoat: 'coat_cream', // cor inicial (grátis); ver data/items.js
  defaultTheme: 'theme_default', // tema da janela inicial (grátis, segue o claro/escuro do sistema)
  defaultScene: 'scene_room',    // cenário inicial (grátis, acompanha as cores do tema)
  music: { startTimeoutMs: 12000 }, // sem tocar depois desse tempo, o app avisa que o YouTube não iniciou

  /**
   * Necessidades do gatinho (barras de 0 a 100).
   * minutesToEmpty: minutos para a barra ir de 100 a 0 sem nenhum cuidado.
   * scene: animação mostrada quando essa necessidade está baixa.
   * event: texto do evento aleatório que derruba essa barra.
   */
  needs: {
    hunger:    { icon: '🍗', label: 'Fome',     minutesToEmpty: 60, scene: 'hungry', message: 'Miau… estou com fome!',        event: 'Correu pela casa e ficou com fome!' },
    thirst:    { icon: '💧', label: 'Sede',     minutesToEmpty: 45, scene: 'thirst', message: 'Estou com muita sede…',        event: 'Fez calor e ele ficou com sede!' },
    fun:       { icon: '🎾', label: 'Diversão', minutesToEmpty: 90, scene: 'bored',  message: 'Vamos brincar?',               event: 'O gatinho está entediado!' },
    affection: { icon: '💗', label: 'Carinho',  minutesToEmpty: 75, scene: 'sad',    message: 'Estou me sentindo sozinho…',   event: '{Ele} sentiu saudade de você!' },
    hygiene:   { icon: '🧹', label: 'Higiene',  minutesToEmpty: 80, scene: 'dirty',  message: 'A caixinha está suja…',        event: 'Fez a maior bagunça na caixinha!' },
  },

  needThreshold: 40,   // abaixo disso o gatinho pede ajuda
  angryThreshold: 15,  // abaixo disso ele fica bravo (em 0 ele morre)
  refuseAbove: 70,     // acima disso ele recusa o cuidado (evita farmar pontos)
  angryMessage: 'GRRR! Cuida de mim!',

  /**
   * Cuidados. gain: quanto a barra sobe. points: pontos base.
   * scene/ms: animação e duração enquanto ele recebe o cuidado.
   */
  actions: {
    feed:  { icon: '🍗', label: 'Ração',   need: 'hunger',    gain: 45, points: 10, scene: 'eat',   ms: 6000, refuse: 'Estou sem fome, obrigado!', supply: 'food', coins: 0 },
    water: { icon: '💧', label: 'Água',    need: 'thirst',    gain: 50, points: 8,  scene: 'drink', ms: 6000, refuse: 'Não quero água agora.', supply: 'water', coins: 0 },
    play:  { icon: '🎾', label: 'Brincar', need: 'fun',       gain: 45, points: 12, scene: 'ball',  ms: 6000, refuse: 'Cansei de brincar por agora.', minEnergy: 25 },
    pet:   { icon: '🤲', label: 'Carinho', need: 'affection', gain: 40, points: 6,  scene: 'pet',   ms: 4000, refuse: 'Já recebi carinho de sobra!' },
    clean: { icon: '🧹', label: 'Limpar',  need: 'hygiene',   gain: 60, points: 8,  scene: 'clean', ms: 5000, refuse: 'Está tudo limpinho!' },
    // Só aparece quando o gatinho está doente (não usa barra: cura a doença).
    medicine: { icon: '💊', label: 'Remédio', need: null, onlyWhenSick: true, points: 15, scene: 'drink', ms: 5000, refuse: '{Ele} não está doente.', supply: 'medicine', coins: 0 },
  },
  urgentMultiplier: 2,       // pontos x2 quando a necessidade já estava ativa

  focusPointsPerMinute: 2,   // pontos por minuto de foco concluído

  /** Progresso permanente (não zera quando o gatinho morre): moedas, metas, sequência, combo. */
  progress: {
    dailyGoalMinutes: 100,        // meta diária padrão (editável no painel Histórico)
    coinsPerFocusMinute: 1,
    coinsPerCare: 3,              // moedas por cuidado
    urgentCareBonus: 3,           // moedas extras se ele realmente precisava
    dailyGoalCoins: 20,           // bônus ao bater a meta do dia
    streakBonus: { 3: 15, 7: 40, 30: 150 }, // bônus extra ao chegar a X dias seguidos
    comboWindowMinutes: 120,      // passou disso sem concluir um foco, o combo zera
    comboPointsPerStep: 5,        // pontos extras por foco seguido (a partir do 2º)
    maxComboSteps: 5,
    maxSessionsStored: 1000,
    habitCoins: 3,                // moedas por cuidar de você na pausa (beber água, alongar...)
  },
  maxMinutes: 180,
  presets: [
    { label: '15',      minutes: 15, mode: 'focus' },
    { label: '25',      minutes: 25, mode: 'focus' },
    { label: '50',      minutes: 50, mode: 'focus' },
    { label: '☕ 5',    minutes: 5,  mode: 'break' },
  ],

  /**
   * Eventos aleatórios (independem do timer): a cada intervalo sorteado entre minSeconds e maxSeconds,
   * uma barra que estava boa (>= needThreshold + minDrop) cai para um valor entre floor e needThreshold - 1.
   * Assim o evento sempre vira um pedido de ajuda, mas nunca deixa o gatinho bravo de repente.
   */
  randomEvent: { minSeconds: 480, maxSeconds: 1200, minDrop: 15, floor: 30 },
  /** Gracinhas aleatórias quando está tudo bem (com ou sem timer rodando). */
  idleFlavor: {
    minSeconds: 45,
    maxSeconds: 150,
    scenes: [
      { scene: 'lick',  ms: 5000 },
      { scene: 'sleep', ms: 8000 },
      { scene: 'ball',  ms: 6000 },
    ],
  },

  /** Identidade do gatinho: nome, fases da vida e personalidade (cada vida sorteia uma). */
  life: {
    names: { // sugestões do botão 🎲
      m: ['Mingau', 'Nino', 'Tigre', 'Bolinha', 'Biscoito', 'Simba', 'Thor', 'Garfield'],
      f: ['Pipoca', 'Mel', 'Luna', 'Fofura', 'Pituca', 'Mia', 'Nina', 'Princesa'],
    },
    maxNameLength: 14,
    stages: [ // fromDays = idade mínima (dias reais); scale = tamanho; decay = ritmo das barras
      { id: 'kitten', label: 'Filhote', fromDays: 0,  scale: 0.82, decay: 1.15 },
      { id: 'adult',  label: 'Adulto',  fromDays: 7,  scale: 1,    decay: 1 },
      { id: 'senior', label: 'Idoso',   fromDays: 60, scale: 1,    decay: 1.1 },
    ],
    personalities: { // decay: multiplicador de cada barra (1 = normal)
      lazy:    { label: 'Preguiçoso', desc: 'Enjoa de brincar devagar.',   decay: { fun: 0.7, hunger: 1.1 } },
      playful: { label: 'Brincalhão', desc: 'Vive pedindo brincadeira.',   decay: { fun: 1.4 } },
      clingy:  { label: 'Dengoso',    desc: 'Precisa de muito carinho.',   decay: { affection: 1.4 } },
      glutton: { label: 'Comilão',    desc: 'Está sempre com fome.',       decay: { hunger: 1.3 } },
      fresh:   { label: 'Fresquinho', desc: 'Não tolera sujeira.',         decay: { hygiene: 1.4 } },
    },
    night: { startHour: 21, endHour: 6, decay: 0.7 }, // à noite ele dorme e as barras descem mais devagar
  },

  /** Doença: chega por evento aleatório (mais provável com a higiene baixa) e some com remédio. */
  illness: {
    chancePerEvent: 0.15,
    neglectedMultiplier: 3, // x3 se a higiene está baixa
    decayMultiplier: 1.4,   // doente, as barras descem mais rápido
    deathMinutes: 40,       // sem remédio por esse tempo, ele não resiste
    message: '{O} {gatinho} pegou um resfriado! Dê o remédio 💊',
  },

  /** Eventos raros (data/rare-events.js): a cada intervalo sorteado acontece um. */
  rareEvent: { minSeconds: 1500, maxSeconds: 4200 },

  /**
   * Suprimentos (consumíveis): ração e remédio são comprados na loja; a água vem do trabalho (foco concluído)
   * ou de garrafões comprados. Cada "dar ração/água/remédio" gasta 1 dose. As ações que gastam suprimento
   * não rendem moedas (coins: 0), para a conta fechar.
   */
  supplies: {
    start: { food: 6, water: 6, medicine: 1 },
    cap: { food: 30, water: 10, medicine: 5 },
    waterPerFocusMinute: 0.05, // 1 dose de água a cada 20 min de foco
    labels: { food: 'ração', water: 'água', medicine: 'remédio' },
    empty: {
      food: 'Acabou a ração! Compre na loja 🛍️',
      water: 'Acabou a água! Conclua um foco ou compre um garrafão 🛍️',
      medicine: 'Sem remédio! Compre na loja 🛍️',
    },
  },

  /** Energia (barra de cansaço): só existe quando há ciclo de dia e noite (rápido ou horário local). */
  energy: {
    dayLoss: 55,              // pontos perdidos ao longo de um dia inteiro acordado
    sleepFraction: 0.6,       // dormindo, recupera tudo em 60% da noite
    lightOnFactor: 1.5,       // dormindo mas com a luz acesa: cansa 1,5x mais rápido e não recupera
    activeNightRecovery: 0.5, // ativo à noite: descansa à metade da velocidade do sono
    breakRecoverPerMin: 2,    // pausa do pomodoro: +2 por minuto (5 min = +10)
    tiredBelow: 40,           // abaixo disso: cara de cansado
    exhaustedBelow: 15,       // abaixo disso: exausto (não brinca e as barras descem mais rápido)
    exhaustedDecay: 1.15,
  },

  /** Ambiente: ciclo de dia e noite (padrões; o jogador muda no painel Ambiente). */
  ambient: {
    fastDayFraction: 0.62,    // no ciclo rápido, 62% do tempo é dia
    fastOptions: [20, 40, 90], // duração de um dia inteiro (min) no ciclo rápido
    defaults: { cycle: 'local', fastMinutes: 40, nightMode: 'active', manualPhase: 'day', lightOn: false },
  },

  /** Dificuldade: ritmo das barras, se o gatinho pode morrer e multiplicadores de pontos e moedas. */
  difficulty: {
    relaxed: { label: 'Relaxado', desc: 'Barras mais lentas, o gatinho não morre.', decay: 0.65, canDie: false, points: 0.7, coins: 0.8 },
    normal:  { label: 'Normal',   desc: 'A experiência padrão.',                    decay: 1,    canDie: true,  points: 1,   coins: 1 },
    hard:    { label: 'Difícil',  desc: 'Barras mais rápidas, mais pontos e moedas.', decay: 1.35, canDie: true,  points: 1.4, coins: 1.25 },
  },

  /** Missões do dia (data/missions.js) e hábitos da pausa (data/habits.js). */
  missions: { count: 3, bonusCoins: 10 },

  happyMs: 2400,             // duração da comemoração
  deathMs: 9300,             // duração da animação de morte
  maxOfflineMinutes: 30,     // quanto tempo "passa" para o gatinho com a página fechada

  floatingWindow: { width: 320, height: 620 },
};
