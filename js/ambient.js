/**
 * Ambiente: dia ou noite, se o gatinho dorme à noite e se a luz está acesa.
 * Três ciclos: "manual" (o jogador escolhe), "fast" (dia e noite rápidos, em minutos) e "local" (horário do computador).
 * Só trabalha com as configurações (profile.settings.ambient); não conhece a tela.
 */
Gatinho.Ambient = class Ambient {
  constructor(settings) {
    this.settings = settings;
    this.lastPhase = null;
  }

  get cycle() {
    return this.settings.cycle;
  }

  /** Com ciclo (rápido ou local) o gatinho cansa; sem ciclo, não. */
  get fatigueEnabled() {
    return this.cycle !== 'manual';
  }

  get lightOn() {
    return this.settings.lightOn;
  }

  isNight(now = Date.now()) {
    const { cycle, fastMinutes, manualPhase } = this.settings;
    if (cycle === 'manual') return manualPhase === 'night';
    if (cycle === 'fast') {
      const cycleMs = fastMinutes * 60000;
      return (now % cycleMs) / cycleMs >= Gatinho.CONFIG.ambient.fastDayFraction;
    }
    return Gatinho.Life.isNight(now);
  }

  phase(now = Date.now()) {
    return this.isNight(now) ? 'night' : 'day';
  }

  /** O gatinho está dormindo (noite + "dorme a noite inteira")? Com a luz acesa ele fica acordado, mas cansado. */
  sleeping(now = Date.now()) {
    return this.settings.nightMode === 'sleep' && this.isNight(now);
  }

  /** Escuro de verdade: dormindo com a luz apagada. */
  lightsOff(now = Date.now()) {
    return this.sleeping(now) && !this.settings.lightOn;
  }

  /** Duração (min) do dia e da noite, usada no ritmo do cansaço. */
  minutes() {
    const { fastMinutes, cycle } = this.settings;
    if (cycle === 'fast') {
      const day = fastMinutes * Gatinho.CONFIG.ambient.fastDayFraction;
      return { day, night: fastMinutes - day };
    }
    const { startHour, endHour } = Gatinho.CONFIG.life.night;
    const nightHours = (24 - startHour + endHour) % 24;
    return { day: (24 - nightHours) * 60, night: nightHours * 60 };
  }

  /** Dados para o gatinho (Pet.environment). */
  environment(now = Date.now()) {
    const { day, night } = this.minutes();
    return { night: this.isNight(now), sleeping: this.sleeping(now), lightOn: this.settings.lightOn, fatigue: this.fatigueEnabled, dayMinutes: day, nightMinutes: night };
  }

  /** Chame de tempos em tempos: toda noite nova começa com a luz apagada. Retorna true se a fase mudou. */
  sync(now = Date.now()) {
    const phase = this.phase(now);
    const changed = this.lastPhase !== null && phase !== this.lastPhase;
    this.lastPhase = phase;
    if (changed && phase === 'night') this.settings.lightOn = false;
    return changed;
  }

  toggleLight() {
    this.settings.lightOn = !this.settings.lightOn;
    return this.settings.lightOn;
  }

  /** Muda o ciclo. Ao ir para "manual", fica na fase atual. */
  setCycle(cycle, now = Date.now()) {
    if (!['manual', 'fast', 'local'].includes(cycle)) return false;
    if (cycle === 'manual' && this.settings.cycle !== 'manual') this.settings.manualPhase = this.phase(now);
    this.settings.cycle = cycle;
    this.lastPhase = this.phase(now);
    return true;
  }

  setNightMode(mode) {
    if (!['sleep', 'active'].includes(mode)) return false;
    this.settings.nightMode = mode;
    return true;
  }

  setFastMinutes(minutes) {
    if (!Gatinho.CONFIG.ambient.fastOptions.includes(minutes)) return false;
    this.settings.fastMinutes = minutes;
    return true;
  }

  /** Só vale no ciclo manual. */
  setManualPhase(phase) {
    if (this.settings.cycle !== 'manual' || !['day', 'night'].includes(phase)) return false;
    this.settings.manualPhase = phase;
    if (phase === 'night') this.settings.lightOn = false;
    return true;
  }
};
