/**
 * Interface: desenha o estado na tela e repassa os cliques para main.js.
 * Não contém regras do jogo.
 *
 * Elementos clicáveis usam atributos data-*:
 *   data-action="feed"      cuidados (ver CONFIG.actions)
 *   data-preset="0"         atalhos de tempo (ver CONFIG.presets)
 *   data-command="pause"    pause | cancel | revive | pin
 * Elementos com data-when="idle running paused" só aparecem nesses estados do timer.
 */
Gatinho.UI = class UI {
  /**
   * @param {HTMLElement} root  elemento #app
   * @param {object} handlers   { action, preset, start, pause, cancel, revive, pin }
   */
  constructor(root, handlers) {
    this.root = root;
    this.handlers = handlers;
    this.transient = { text: '', until: 0 };
    this.last = {}; // últimos valores desenhados
    this.gender = 'm'; // gênero do gatinho (para os textos com {o} {ele}...)
    this._buildNeeds();
    this._buildActions();
    this._buildPresets();
    this._bindEvents();
    this._cacheElements();
  }

  $(selector) {
    return this.root.querySelector(selector);
  }

  /** Mostra uma mensagem temporária no lugar da fala do gatinho. append: junta à mensagem atual. */
  say(text, ms = 3500, { append = false } = {}) {
    text = this.format(text);
    if (append && Date.now() < this.transient.until) text = `${this.transient.text} · ${text}`;
    this.transient = { text, until: Date.now() + ms };
    this.last.message = text;
    this.el.message.textContent = text;
  }

  /** Aplica o gênero do gatinho aos textos ("{Ele} é {um} {gatinho}"). */
  format(text) {
    return Gatinho.Life.speak(text, this.gender);
  }

  /** @param {{pet, pomodoro, profile, night: boolean, tone: 'light'|'dark', env: {fatigue, lightSwitch, lightOn, lightsOff, editing}, habit: object|null, message: string, bubble: string}} view */
  render({ pet, pomodoro, profile, night, tone, env, habit, message, bubble }) {
    const { needThreshold, angryThreshold } = Gatinho.CONFIG;
    const { el, root } = this;
    this.gender = pet.life.gender;
    const state = pomodoro.state;

    this._set('score', pet.score, (v) => (el.score.textContent = v));
    this._set('record', pet.record, (v) => (el.record.textContent = v));
    this._set('coins', profile.coins, (v) => (el.coins.textContent = v));

    const { life } = pet;
    const now = Date.now();
    const stage = life.stage(now);
    this._set('name', `${life.name}|${stage.label}|${life.ageDays(now)}|${life.gender}`, () => {
      el.name.textContent = life.name;
      el.name.dataset.gender = life.gender; // mostra ♂ ou ♀ antes do nome
      el.name.title = `${stage.label} · ${life.ageDays(now)} dia(s) · ${life.trait().label}`;
    });
    this._set('gender', life.gender, () => (el.revive.textContent = this.format('✨ Reviver {o} {gatinho}')));
    this._set('tone', tone, () => (el.stage.dataset.tone = tone)); // palco escuro: textos claros e gatinho com contorno
    this._set('night', night, () => (el.stage.dataset.time = night ? 'night' : 'day'));

    // energia (cansaço): só existe quando há ciclo de dia e noite
    const energy = Math.round(pet.energy);
    this._set('energy', `${env.fatigue}|${energy}`, () => {
      el.energy.hidden = !env.fatigue;
      el.energy.style.setProperty('--v', `${energy}%`);
      const { exhaustedBelow, tiredBelow } = Gatinho.CONFIG.energy;
      el.energy.dataset.level = energy < exhaustedBelow ? 'crit' : energy < tiredBelow ? 'warn' : 'ok';
    });
    // quantas doses de ração, água e remédio restam (vermelho quando zera)
    for (const [key, action] of Object.entries(Gatinho.CONFIG.actions)) {
      if (!action.supply) continue;
      const count = profile.supplyCount(action.supply);
      this._set(`supply:${key}`, count, () => {
        el.counts[key].textContent = count;
        el.counts[key].classList.toggle('is-empty', count === 0);
      });
    }
    this._set('lights', `${env.lightSwitch}|${env.lightOn}|${env.lightsOff}`, () => {
      el.lightSwitch.hidden = !env.lightSwitch;
      el.lightSwitch.setAttribute('aria-pressed', env.lightOn);
      el.lightSwitch.title = env.lightOn ? 'Apagar a luz' : 'Acender a luz';
      el.stage.dataset.lights = env.lightsOff ? 'off' : 'on';
    });
    this._set('editing', env.editing, () => {
      el.stage.classList.toggle('is-editing', env.editing);
      el.editButton.setAttribute('aria-pressed', env.editing);
    });
    this._set('habit', habit?.id ?? '', () => {
      el.habit.hidden = !habit;
      el.habitText.textContent = habit ? `${habit.icon} ${habit.text}` : '';
    });
    this._set('sick', pet.sick, () => {
      el.sickChip.hidden = !pet.sick;
      for (const [key, button] of Object.entries(el.actionButtons)) {
        if (Gatinho.CONFIG.actions[key].onlyWhenSick) button.hidden = !pet.sick; // o remédio só aparece quando precisa
      }
    });

    for (const [key, value] of Object.entries(pet.stats)) {
      const percent = Math.round(value);
      this._set(`need:${key}`, percent, () => {
        el.needs[key].style.setProperty('--v', `${percent}%`);
        el.needs[key].dataset.level = percent < angryThreshold ? 'crit' : percent < needThreshold ? 'warn' : 'ok';
      });
    }

    this._set('timer', state, () => {
      root.dataset.timer = state;
      for (const item of el.when) item.hidden = !item.dataset.when.split(' ').includes(state);
      el.pause.textContent = state === 'paused' ? '▶ Retomar' : '⏸ Pausar';
    });
    this._set('alive', pet.alive, () => {
      root.dataset.alive = pet.alive;
      el.actions.hidden = !pet.alive;
      el.revive.hidden = pet.alive;
    });
    this._set('bubble', bubble, () => {
      el.bubble.hidden = !bubble;
      el.bubble.textContent = bubble;
    });

    const clock = this._format(state === 'idle' ? this._minutes() * 60 : pomodoro.remaining());
    this._set('clock', clock, () => (el.clock.textContent = clock));
    this._set('title', state === 'idle' ? 'Gatinho Pomodoro' : `${clock} · Gatinho`, (v) => (document.title = v));
    this._set('label', this._label(pomodoro), (v) => (el.label.textContent = v));
    this._set('message', Date.now() < this.transient.until ? this.transient.text : this.format(message), (v) => (el.message.textContent = v));
  }

  /** Dados do formulário de timer. */
  formData(mode = 'focus', minutes = this._minutes()) {
    return { mode, minutes, task: this.$('#task').value.trim() };
  }

  setMinutes(minutes) {
    this.$('#minutes').value = minutes;
  }

  _cacheElements() {
    this.el = {
      score: this.$('#score'),
      record: this.$('#record'),
      coins: this.$('#coins'),
      name: this.$('#cat-name'),
      stage: this.$('.stage'),
      energy: this.$('[data-need="energy"]'),
      lightSwitch: this.$('#light-switch'),
      editButton: this.$('[data-command="edit"]'),
      habit: this.$('#habit'),
      habitText: this.$('#habit-text'),
      counts: Object.fromEntries([...this.root.querySelectorAll('[data-count]')].map((el) => [el.dataset.count, el])),
      sickChip: this.$('#sick-chip'),
      actionButtons: Object.fromEntries(Object.keys(Gatinho.CONFIG.actions).map((key) => [key, this.$(`[data-action="${key}"]`)])),
      message: this.$('#message'),
      bubble: this.$('#bubble'),
      clock: this.$('#clock'),
      label: this.$('#timer-label'),
      actions: this.$('#actions'),
      revive: this.$('[data-command="revive"]'),
      pause: this.$('[data-command="pause"]'),
      needs: Object.fromEntries(Object.keys(Gatinho.CONFIG.needs).map((key) => [key, this.$(`[data-need="${key}"]`)])),
      when: [...this.root.querySelectorAll('[data-when]')],
    };
  }

  /** Só mexe no DOM quando o valor mudou (evita trabalho inútil a cada segundo). */
  _set(key, value, apply) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    apply(value);
  }

  _buildNeeds() {
    this.$('#needs').innerHTML = Object.entries(Gatinho.CONFIG.needs)
      .map(([key, n]) => `<div class="need" data-need="${key}" title="${n.label}"><span>${n.icon}</span><div class="need__bar"><i></i></div></div>`)
      .join('') + '<div class="need" data-need="energy" title="Energia (cansaço)" hidden><span>🔋</span><div class="need__bar"><i></i></div></div><div id="sick-chip" class="need need--sick" hidden>🤒 Doente: dê o remédio!</div>';
  }

  _buildActions() {
    this.$('#actions').innerHTML = Object.entries(Gatinho.CONFIG.actions)
      .map(([key, a]) => `<button type="button" class="btn btn--action" data-action="${key}"><span class="btn__icon">${a.icon}</span>${a.label}${a.supply ? `<i class="btn__count" data-count="${key}"></i>` : ''}</button>`)
      .join('');
  }

  _buildPresets() {
    this.$('#presets').innerHTML = Gatinho.CONFIG.presets
      .map((p, i) => `<button type="button" class="btn btn--small" data-preset="${i}">${p.label}</button>`)
      .join('');
  }

  _bindEvents() {
    this.root.addEventListener('click', (event) => {
      const target = event.target;
      const action = target.closest('[data-action]');
      const preset = target.closest('[data-preset]');
      const command = target.closest('[data-command]');
      if (action) this.handlers.action(action.dataset.action);
      if (preset) this.handlers.preset(Gatinho.CONFIG.presets[Number(preset.dataset.preset)]);
      if (command) this.handlers[command.dataset.command]();
    });
    this.$('#timer-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this.handlers.start(this.formData());
    });
  }

  /** Minutos digitados, sempre dentro do limite permitido. */
  _minutes() {
    const value = Math.round(Number(this.$('#minutes').value)) || 25;
    return Math.min(Gatinho.CONFIG.maxMinutes, Math.max(1, value));
  }

  _label(pomodoro) {
    if (pomodoro.mode === 'idle') return 'Pronto para começar';
    const base = pomodoro.mode === 'break' ? '☕ Pausa' : `🎯 ${pomodoro.task || 'Foco'}`;
    return pomodoro.state === 'paused' ? `${base} (pausado)` : base;
  }

  _format(totalSeconds) {
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${minutes}:${seconds}`;
  }
};
