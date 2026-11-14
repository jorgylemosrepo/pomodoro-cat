/**
 * Sons do jogo, sintetizados (sem arquivos): sininho de conquista, moedas, miado, ronronar, fim do timer.
 * O som da conquista é um arpejo ascendente de sinos (dó-mi-sol-dó) com um brilho no final.
 */
Gatinho.Sound = {
  enabled: true,
  volume: 0.7, // 0 a 1
  context: null,

  /** Lê as configurações do jogador (profile.settings). */
  configure({ sound = true, soundVolume = 70 } = {}) {
    this.enabled = Boolean(sound);
    this.volume = Math.min(1, Math.max(0, soundVolume / 100));
  },

  achievement() {
    [[523.25, 0], [659.25, 0.09], [783.99, 0.18], [1046.5, 0.27]].forEach(([freq, delay]) => this._bell(freq, delay, 0.9, 0.22));
    this._bell(2093, 0.36, 0.7, 0.07); // brilho
  },

  coin() {
    this._bell(987.77, 0, 0.35, 0.18);
    this._bell(1318.5, 0.08, 0.5, 0.18);
  },

  timerDone() {
    [[659.25, 0], [523.25, 0.22], [783.99, 0.44]].forEach(([freq, delay]) => this._bell(freq, delay, 1.1, 0.24));
  },

  meow() {
    const ctx = this._ctx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.18);
    osc.frequency.linearRampToValueAtTime(600, t + 0.45);
    filter.type = 'lowpass';
    filter.frequency.value = 2200;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.18 * this.volume, t + 0.06);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(filter).connect(amp).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  },

  purr() {
    const ctx = this._ctx();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const trem = ctx.createOscillator();
    const tremDepth = ctx.createGain();
    const amp = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    trem.frequency.value = 24; // o ronco vem do tremolo rápido
    tremDepth.gain.value = 0.5;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(0.1 * this.volume, t + 0.2);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    trem.connect(tremDepth).connect(amp.gain);
    osc.connect(amp).connect(ctx.destination);
    osc.start(t); trem.start(t);
    osc.stop(t + 1.5); trem.stop(t + 1.5);
  },

  /** Um sininho: tom fundamental + dois harmônicos que somem mais rápido. */
  _bell(freq, delay, duration, gain) {
    const ctx = this._ctx();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    for (const [multiple, level] of [[1, 1], [2, 0.35], [3.01, 0.12]]) {
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq * multiple;
      amp.gain.setValueAtTime(0.0001, start);
      amp.gain.exponentialRampToValueAtTime(gain * level * this.volume, start + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.0001, start + duration / multiple);
      osc.connect(amp).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    }
  },

  /** Cria o AudioContext só quando preciso. Devolve null se o som está desligado ou indisponível. */
  _ctx() {
    if (!this.enabled || this.volume <= 0) return null;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  },
};
