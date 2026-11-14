/**
 * Identidade e vida do gatinho: nome, idade, fase (filhote/adulto/idoso), personalidade
 * e as regras de dia e noite. Não conhece a tela.
 */
(function () {
  const DAY_MS = 86400000;
  const WORDS = {
    m: { o: 'o', O: 'O', um: 'um', Um: 'Um', ele: 'ele', Ele: 'Ele', dele: 'dele', gatinho: 'gatinho', novo: 'novo' },
    f: { o: 'a', O: 'A', um: 'uma', Um: 'Uma', ele: 'ela', Ele: 'Ela', dele: 'dela', gatinho: 'gatinha', novo: 'nova' },
  };

  Gatinho.Life = class Life {
    constructor(saved, now = Date.now()) {
      const { personalities } = Gatinho.CONFIG.life;
      this.gender = saved?.gender ?? 'm';       // 'm' = macho, 'f' = fêmea
      this.adopted = saved?.adopted ?? false;    // false = ainda não passou pela tela de escolha
      this.name = saved?.name ?? Life.randomName(this.gender);
      this.bornAt = saved?.bornAt ?? now;
      this.personality = saved?.personality ?? Gatinho.random.pick(Object.keys(personalities));
    }

    toJSON() {
      const { name, gender, adopted, bornAt, personality } = this;
      return { name, gender, adopted, bornAt, personality };
    }

    /** Idade em dias completos. */
    ageDays(now = Date.now()) {
      return Math.max(0, Math.floor((now - this.bornAt) / DAY_MS));
    }

    stage(now = Date.now()) {
      const days = this.ageDays(now);
      return Gatinho.CONFIG.life.stages.filter((stage) => days >= stage.fromDays).pop();
    }

    /** Próxima fase e em quantos dias ela chega (null se já é a última). */
    nextStage(now = Date.now()) {
      const days = this.ageDays(now);
      const next = Gatinho.CONFIG.life.stages.find((stage) => stage.fromDays > days);
      return next ? { stage: next, inDays: next.fromDays - days } : null;
    }

    trait() {
      return Gatinho.CONFIG.life.personalities[this.personality] ?? { label: 'Normal', desc: '', decay: {} };
    }

    /** Multiplicador do ritmo de uma barra: personalidade x fase x noite (isNight vem do Ambiente). */
    decayMultiplier(need, now = Date.now(), isNight = Life.isNight(now)) {
      const night = isNight ? Gatinho.CONFIG.life.night.decay : 1;
      return (this.trait().decay[need] ?? 1) * this.stage(now).decay * night;
    }

    rename(name) {
      const clean = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, Gatinho.CONFIG.life.maxNameLength);
      if (!clean) return { ok: false, reason: 'Digite um nome.' };
      this.name = clean;
      return { ok: true };
    }

    /** Confirma a escolha da tela inicial: gênero e nome. Retorna { ok } ou { ok: false, reason }. */
    adopt({ name, gender }) {
      if (gender !== 'm' && gender !== 'f') return { ok: false, reason: 'Escolha o gênero.' };
      const renamed = this.rename(name);
      if (!renamed.ok) return renamed;
      this.gender = gender;
      this.adopted = true;
      return { ok: true };
    }

    /** Depois de reviver, nasce um filhote novo (mesmo nome, nova personalidade). */
    rebirth(now = Date.now()) {
      this.bornAt = now;
      this.personality = Gatinho.random.pick(Object.keys(Gatinho.CONFIG.life.personalities));
    }

    static randomName(gender) {
      const { names } = Gatinho.CONFIG.life;
      return Gatinho.random.pick(names[gender] ?? [...names.m, ...names.f]);
    }

    /** Troca {o} {ele} {gatinho}... pela forma do gênero: "{Ele} é {um} {gatinho}" -> "Ela é uma gatinha". */
    static speak(text, gender = 'm') {
      const words = WORDS[gender] ?? WORDS.m;
      return String(text).replace(/\{(\w+)\}/g, (match, key) => words[key] ?? match);
    }

    static isNight(now = Date.now()) {
      const { startHour, endHour } = Gatinho.CONFIG.life.night;
      const hour = new Date(now).getHours();
      return startHour > endHour ? hour >= startHour || hour < endHour : hour >= startHour && hour < endHour;
    }

    /** Ajusta o tamanho do gatinho no SVG conforme a fase da vida. */
    static applyStage(svg, stage) {
      const wrap = svg.querySelector('#cat-wrap');
      wrap.setAttribute('transform', stage.scale === 1 ? '' : `translate(200 382) scale(${stage.scale}) translate(-200 -382)`);
    }
  };
})();
