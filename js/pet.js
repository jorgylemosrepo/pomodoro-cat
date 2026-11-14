/** Salva e carrega o estado do jogo no navegador (localStorage). */
Gatinho.Storage = {
  load() {
    try {
      let raw = localStorage.getItem(Gatinho.CONFIG.storageKey);
      if (!raw && window.desktop?.legacySave) { // app de desktop: traz o progresso salvo antes de servir por http
        raw = window.desktop.legacySave;
        localStorage.setItem(Gatinho.CONFIG.storageKey, raw);
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  save(data) {
    try {
      const text = JSON.stringify(data);
      localStorage.setItem(Gatinho.CONFIG.storageKey, text);
      window.desktop?.saveMirror?.(text); // app de desktop: cópia em arquivo, protege contra mudança de endereço
    } catch {
      /* armazenamento indisponível: o jogo continua, só não salva */
    }
  },
};

/**
 * O gatinho: necessidades, energia, doença, pontuação, vida e eventos aleatórios.
 * Não sabe nada de tela. Eventos emitidos:
 *   "died"  { name, days, score, cause }
 *   "event" { type: 'need', need } ou { type: 'sick' }
 *
 * Duas peças de fora entram por propriedades:
 *   pet.environment()  dia/noite, sono e luz (vem do Ambient; ver Ambient.environment)
 *   pet.rules          dificuldade: { decay, canDie, points }
 */
Gatinho.Pet = class Pet extends EventTarget {
  /** @param {object} saved  estado salvo   @param {{now?: () => number}} options  relógio (útil em testes) */
  constructor(saved, { now = Date.now } = {}) {
    super();
    this.now = now;
    this.stats = Object.fromEntries(Object.keys(Gatinho.CONFIG.needs).map((key) => [key, saved?.stats?.[key] ?? 100]));
    this.energy = saved?.energy ?? 100;
    this.score = saved?.score ?? 0;
    this.record = saved?.record ?? 0;
    this.alive = saved?.alive ?? true;
    this.sickSeconds = saved?.sickSeconds ?? null; // null = saudável; número = segundos doente
    this.life = new Gatinho.Life(saved?.life, this.now());
    this.lastEventNeed = null;
    this.secondsToEvent = this._nextEventDelay();
    this.rules = { decay: 1, canDie: true, points: 1 };
    this.environment = () => ({ night: Gatinho.Life.isNight(this.now()), sleeping: false, lightOn: true, fatigue: false, dayMinutes: 900, nightMinutes: 540 });
  }

  get sick() {
    return this.sickSeconds !== null;
  }

  get tired() {
    return this.energy < Gatinho.CONFIG.energy.tiredBelow;
  }

  get exhausted() {
    return this.energy < Gatinho.CONFIG.energy.exhaustedBelow;
  }

  toJSON() {
    const { stats, energy, score, record, alive, sickSeconds, life } = this;
    return { stats, energy, score, record, alive, sickSeconds, life };
  }

  /** A necessidade mais baixa no momento: { need, value }. */
  mostUrgent() {
    const [need, value] = Object.entries(this.stats).sort((a, b) => a[1] - b[1])[0];
    return { need, value };
  }

  /**
   * Passa o tempo: as barras descem, a energia muda, a doença avança e, de vez em quando, acontece um evento.
   * offline = true é para o tempo em que o app ficou fechado ou o computador suspenso:
   * as barras descem, mas sem eventos e sem matar o gatinho (mínimo 1).
   * onBreak = true quando uma pausa do pomodoro está rodando (a pausa descansa o gatinho).
   */
  tick(seconds, { offline = false, onBreak = false } = {}) {
    if (!this.alive || !this.life.adopted) return; // antes da tela de escolha o tempo não passa
    const env = this.environment();
    const safe = offline || !this.rules.canDie;
    this._decay(seconds, safe ? 1 : 0, env);
    this._tickEnergy(seconds, env, onBreak);
    if (this.sick) this._advanceSickness(seconds, safe);
    if (!this.alive || offline) return;

    if (this.mostUrgent().value <= 0) {
      this.die('descuido');
      return;
    }
    if (env.sleeping) return; // dormindo a noite inteira: sem eventos aleatórios
    this.secondsToEvent -= seconds;
    if (this.secondsToEvent <= 0) {
      this._triggerEvent();
      this.secondsToEvent = this._nextEventDelay();
    }
  }

  /** Aplica um cuidado. Retorna { ok, message?, points?, urgent?, critical? }. */
  care(actionKey) {
    const { actions, needThreshold, angryThreshold, refuseAbove, urgentMultiplier } = Gatinho.CONFIG;
    const action = actions[actionKey];
    if (!this.alive) return { ok: false, message: 'O gatinho precisa ser revivido.' };
    if (action.minEnergy && this.energy < action.minEnergy) return { ok: false, message: 'Estou cansad{o} demais para isso… 😴' };

    if (action.onlyWhenSick) { // remédio
      if (!this.sick) return { ok: false, message: action.refuse };
      this.sickSeconds = null;
      const points = this._points(action.points);
      this._addScore(points);
      return { ok: true, points, urgent: true, critical: false };
    }

    const value = this.stats[action.need];
    if (value >= refuseAbove) return { ok: false, message: action.refuse };

    const urgent = value < needThreshold;
    const points = this._points(action.points * (urgent ? urgentMultiplier : 1));
    this.stats[action.need] = Math.min(100, value + action.gain);
    this._addScore(points);
    return { ok: true, points, urgent, critical: value < angryThreshold };
  }

  /** Recompensa por concluir um foco. Retorna os pontos ganhos. */
  addFocusMinutes(minutes) {
    const points = this._points(minutes * Gatinho.CONFIG.focusPointsPerMinute);
    this._addScore(points);
    return points;
  }

  /** Pontos extras (ex.: combo). Retorna os pontos somados, já com a dificuldade. */
  addPoints(points) {
    const final = this._points(points);
    this._addScore(final);
    return final;
  }

  die(cause = 'descuido') {
    if (!this.alive) return;
    const detail = { name: this.life.name, days: this.life.ageDays(this.now()), score: this.score, cause };
    this.alive = false;
    this.sickSeconds = null;
    this.score = 0; // o recorde é mantido
    this.dispatchEvent(new CustomEvent('died', { detail }));
  }

  /** Reviver = nasce um filhote novo (mesmo nome), com tudo cheio. */
  revive() {
    for (const key of Object.keys(this.stats)) this.stats[key] = 100;
    this.energy = 100;
    this.alive = true;
    this.sickSeconds = null;
    this.life.rebirth(this.now());
    this.secondsToEvent = this._nextEventDelay();
  }

  _points(base) {
    return Math.round(base * this.rules.points);
  }

  _decay(seconds, floor, env) {
    const now = this.now();
    const jitter = Gatinho.random.between(0.7, 1.3);
    const sickFactor = this.sick ? Gatinho.CONFIG.illness.decayMultiplier : 1;
    const tiredFactor = env.fatigue && this.exhausted ? Gatinho.CONFIG.energy.exhaustedDecay : 1;
    for (const [key, need] of Object.entries(Gatinho.CONFIG.needs)) {
      const rate = this.life.decayMultiplier(key, now, env.night) * sickFactor * tiredFactor * this.rules.decay;
      this.stats[key] = Math.max(floor, this.stats[key] - (100 / (need.minutesToEmpty * 60)) * seconds * jitter * rate);
    }
  }

  /**
   * Energia: de dia gasta; dormindo à noite (luz apagada) recupera; dormindo com a luz acesa cansa mais;
   * ativo à noite descansa devagar. Sem ciclo de dia e noite não há cansaço. A pausa do pomodoro descansa.
   */
  _tickEnergy(seconds, env, onBreak) {
    const E = Gatinho.CONFIG.energy;
    if (!env.fatigue) {
      this.energy = 100;
      return;
    }
    const drain = E.dayLoss / env.dayMinutes;                    // pontos por minuto
    const sleepRecovery = 100 / (env.nightMinutes * E.sleepFraction);
    let perMinute;
    if (!env.night) perMinute = -drain;
    else if (env.sleeping) perMinute = env.lightOn ? -drain * E.lightOnFactor : sleepRecovery;
    else perMinute = sleepRecovery * E.activeNightRecovery;
    if (onBreak) perMinute += E.breakRecoverPerMin;
    this.energy = Math.min(100, Math.max(0, this.energy + (perMinute * seconds) / 60));
  }

  _advanceSickness(seconds, safe) {
    const limit = Gatinho.CONFIG.illness.deathMinutes * 60;
    this.sickSeconds += seconds;
    if (safe) this.sickSeconds = Math.min(this.sickSeconds, limit - 60); // offline e modo relaxado não matam
    else if (this.sickSeconds >= limit) this.die('doença');
  }

  _nextEventDelay() {
    const { minSeconds, maxSeconds } = Gatinho.CONFIG.randomEvent;
    return Gatinho.random.between(minSeconds, maxSeconds);
  }

  /** Evento aleatório: doença (mais provável com higiene baixa) ou uma barra que cai até o "pedido de ajuda". */
  _triggerEvent() {
    const { needThreshold, randomEvent, illness } = Gatinho.CONFIG;

    const dirty = (this.stats.hygiene ?? 100) < needThreshold;
    const sickChance = illness.chancePerEvent * (dirty ? illness.neglectedMultiplier : 1);
    if (!this.sick && Math.random() < sickChance) {
      this.sickSeconds = 0;
      this.dispatchEvent(new CustomEvent('event', { detail: { type: 'sick' } }));
      return;
    }

    let candidates = Object.keys(this.stats).filter((key) => this.stats[key] >= needThreshold + randomEvent.minDrop);
    if (candidates.length > 1) candidates = candidates.filter((key) => key !== this.lastEventNeed);
    if (!candidates.length) return;

    const need = Gatinho.random.pick(candidates);
    this.stats[need] = Gatinho.random.between(randomEvent.floor, needThreshold - 1);
    this.lastEventNeed = need;
    this.dispatchEvent(new CustomEvent('event', { detail: { type: 'need', need } }));
  }

  _addScore(points) {
    this.score += points;
    this.record = Math.max(this.record, this.score);
  }
};
