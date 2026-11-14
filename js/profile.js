/**
 * Progresso permanente do jogador (não zera quando o gatinho morre):
 * moedas, histórico de focos, metas, sequência, combo, contadores e conquistas desbloqueadas.
 * Não conhece a tela.
 */
(function () {
  const pad = (n) => String(n).padStart(2, '0');

  /** Data local como "2026-10-25". */
  function dayKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** Data de n dias atrás (à meia-noite local). */
  function daysAgo(n, now) {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - n);
  }

  function normalizeTask(task) {
    return String(task ?? '').trim().replace(/\s+/g, ' ') || 'Sem nome';
  }

  Gatinho.Profile = class Profile {
    constructor(saved) {
      const { progress } = Gatinho.CONFIG;
      this.coins = saved?.coins ?? 0;
      this.counters = { ...saved?.counters };
      this.sessions = Array.isArray(saved?.sessions) ? saved.sessions : []; // [{ task, minutes, at }]
      this.achievements = { ...saved?.achievements };                      // { id: timestamp }
      this.unseen = Array.isArray(saved?.unseen) ? saved.unseen : [];       // conquistas ainda não vistas
      this.goalMinutes = saved?.goalMinutes ?? progress.dailyGoalMinutes;
      this.streak = { count: 0, lastDate: null, ...saved?.streak };
      this.combo = { count: 0, lastAt: 0, ...saved?.combo };
      this.goalPaidDate = saved?.goalPaidDate ?? null;
      this.settings = {
        musicVolume: 60, youtubeApiKey: '', sound: true, soundVolume: 70, notifications: false, difficulty: 'normal',
        ...saved?.settings,
        ambient: { ...Gatinho.CONFIG.ambient.defaults, ...saved?.settings?.ambient },
        update: { repo: '', auto: true, lastCheck: 0, latest: null, ...saved?.settings?.update }, // repositório do GitHub e última consulta
      };
      this.supplies = { ...Gatinho.CONFIG.supplies.start, ...saved?.supplies }; // { food, water, medicine } em doses
      this.placements = saved?.placements ?? {};                                  // { cenárioId: [{ id, x, y }] }
      this.daily = { date: null, ids: [], counters: {}, done: {}, bonus: false, ...saved?.daily };
      this.graveyard = Array.isArray(saved?.graveyard) ? saved.graveyard : []; // [{ name, days, score, cause, at }]
      this.inventory = { [Gatinho.CONFIG.defaultCoat]: 0, [Gatinho.CONFIG.defaultTheme]: 0, [Gatinho.CONFIG.defaultScene]: 0, ...saved?.inventory }; // { itemId: timestamp da compra }
      this.equipped = { coat: Gatinho.CONFIG.defaultCoat, theme: Gatinho.CONFIG.defaultTheme, scene: Gatinho.CONFIG.defaultScene, hat: null, face: null, neck: null, ...saved?.equipped };
    }

    toJSON() {
      const { coins, counters, sessions, achievements, unseen, goalMinutes, streak, combo, goalPaidDate, inventory, equipped, graveyard, settings, supplies, placements, daily } = this;
      return { coins, counters, sessions, achievements, unseen, goalMinutes, streak, combo, goalPaidDate, inventory, equipped, graveyard, settings, supplies, placements, daily };
    }

    static dayKey(date) {
      return dayKey(date);
    }

    counter(name) {
      return this.counters[name] ?? 0;
    }

    addCoins(amount) {
      this.coins += amount;
      this._bump('coinsEarned', amount);
    }

    // ---- Registro de acontecimentos ----

    /** Um cuidado deu certo. Retorna as moedas ganhas. */
    recordCare(actionKey, result, now = Date.now()) {
      const { coinsPerCare, urgentCareBonus } = Gatinho.CONFIG.progress;
      this.rollDay(now);
      this._bump('careTotal');
      this._bump(`care:${actionKey}`);
      if (result.critical) this._bump('urgentSaves');
      const base = Gatinho.CONFIG.actions[actionKey].coins ?? coinsPerCare; // ração, água e remédio já custam: não rendem moedas
      const coins = base === 0 ? 0 : this._earn(base + (result.urgent ? urgentCareBonus : 0));
      this.addCoins(coins);
      return coins;
    }

    /** Um foco foi concluído. Retorna { coins, combo, bonusPoints, goalMet, streak }. */
    recordFocus({ task, minutes }, now = Date.now()) {
      const p = Gatinho.CONFIG.progress;
      this.sessions.push({ task: normalizeTask(task), minutes, at: now });
      const extra = this.sessions.length - p.maxSessionsStored;
      if (extra > 0) this.sessions.splice(0, extra);

      this.rollDay(now);
      this._bump('focusSessions');
      this._bump('focusMinutes', minutes);
      this.addSupply('water', minutes * Gatinho.CONFIG.supplies.waterPerFocusMinute); // a água vem do trabalho
      this._max('longestFocus', minutes);

      const combo = this._advanceCombo(now);
      const bonusPoints = Math.min(combo - 1, p.maxComboSteps) * p.comboPointsPerStep;
      const goal = this._checkGoal(now);
      const coins = this._earn(minutes * p.coinsPerFocusMinute) + goal.coins;
      this.addCoins(coins);
      return { coins, combo, bonusPoints, goalMet: goal.met, streak: this.streak.count };
    }

    /** Um foco foi cancelado: quebra o combo. */
    recordCancel() {
      this.combo.count = 0;
      this._bump('cancels');
    }

    /** O gatinho morreu: registra no cemitério. detail = { name, days, score, cause }. */
    recordDeath(detail = {}, now = Date.now()) {
      this._bump('deaths');
      this.graveyard.unshift({ name: detail.name ?? '?', days: detail.days ?? 0, score: detail.score ?? 0, cause: detail.cause ?? '', at: now });
      this.graveyard.length = Math.min(this.graveyard.length, 30);
      this._max('bestLifeDays', detail.days ?? 0);
    }

    /** Atualiza o recorde de dias vivo (chamado com a idade do gatinho atual). */
    noteLife(days) {
      this._max('bestLifeDays', days);
    }

    recordRareEvent() {
      this._bump('rareEvents');
    }

    recordRevive() {
      this._bump('revives');
    }

    unlock(achievement, now = Date.now()) {
      this.achievements[achievement.id] = now;
      this.unseen.push(achievement.id);
      this.addCoins(achievement.coins);
    }

    markSeen() {
      this.unseen = [];
    }

    // ---- Loja e guarda-roupa ----
    // Os três métodos abaixo retornam { ok: true } ou { ok: false, reason }.

    owns(itemId) {
      return itemId in this.inventory;
    }

    buy(item, now = Date.now()) {
      if (!item) return { ok: false, reason: 'Item não encontrado.' };
      if (item.slot === 'supply') return this._buySupply(item);
      if (this.owns(item.id)) return { ok: false, reason: 'Você já tem este item.' };
      if (this.coins < item.price) return { ok: false, reason: `Faltam ${item.price - this.coins} moedas.` };
      this.coins -= item.price;
      this.inventory[item.id] = now;
      this._bump('coinsSpent', item.price);
      this._bump('purchases');
      return { ok: true };
    }

    equip(item) {
      if (!item || !this.owns(item.id)) return { ok: false, reason: 'Você ainda não tem este item.' };
      if (item.slot === 'coat' && this.equipped.coat !== item.id) this._bump('coatChanges');
      if (item.slot === 'theme' && this.equipped.theme !== item.id) this._bump('themeChanges');
      if (item.slot === 'scene' && this.equipped.scene !== item.id) this._bump('sceneChanges');
      this.equipped[item.slot] = item.id;
      this._bump('equips');
      this._max('maxSlotsEquipped', ['hat', 'face', 'neck'].filter((slot) => this.equipped[slot]).length);
      return { ok: true };
    }

    /** Tira a roupinha de um encaixe. A cor do pelo, o tema e o cenário não podem ser removidos (só trocados). */
    unequip(slot) {
      if (slot === 'coat' || slot === 'theme' || slot === 'scene') return { ok: false, reason: 'Este item só pode ser trocado, não removido.' };
      this.equipped[slot] = null;
      return { ok: true };
    }

    // ---- Suprimentos (ração, água, remédio) ----

    hasSupply(key) {
      return (this.supplies[key] ?? 0) >= 1;
    }

    supplyCount(key) {
      return Math.floor(this.supplies[key] ?? 0);
    }

    useSupply(key) {
      this.supplies[key] = Math.max(0, (this.supplies[key] ?? 0) - 1);
    }

    /** Soma doses respeitando o limite de estoque. Retorna quanto realmente entrou. */
    addSupply(key, amount) {
      const before = this.supplies[key] ?? 0;
      this.supplies[key] = Math.min(Gatinho.CONFIG.supplies.cap[key], before + amount);
      return this.supplies[key] - before;
    }

    _buySupply(item) {
      const [[key, amount]] = Object.entries(item.grants);
      if (this.coins < item.price) return { ok: false, reason: `Faltam ${item.price - this.coins} moedas.` };
      if (this.supplies[key] + amount > Gatinho.CONFIG.supplies.cap[key] + 0.001) return { ok: false, reason: 'Seu estoque está cheio.' };
      this.coins -= item.price;
      this.addSupply(key, amount);
      this._bump('coinsSpent', item.price);
      this._bump('suppliesBought');
      return { ok: true };
    }

    // ---- Móveis nos cenários ----

    placed(sceneId) {
      return this.placements[sceneId] ?? [];
    }

    /** Coloca (ou reposiciona) um móvel que você tem num cenário. x e y já vêm ajustados (Scenery.clamp). */
    place(sceneId, itemId, x, y) {
      if (!this.owns(itemId)) return { ok: false, reason: 'Você ainda não tem este móvel.' };
      const list = (this.placements[sceneId] ??= []);
      const existing = list.find((entry) => entry.id === itemId);
      if (existing) Object.assign(existing, { x, y });
      else {
        list.push({ id: itemId, x, y });
        this._bump('furniturePlaced');
      }
      return { ok: true };
    }

    /** Guarda o móvel de volta no inventário (some do cenário). */
    store(sceneId, itemId) {
      const list = this.placements[sceneId] ?? [];
      const index = list.findIndex((entry) => entry.id === itemId);
      if (index < 0) return { ok: false, reason: 'Esse móvel não está no cenário.' };
      list.splice(index, 1);
      return { ok: true };
    }

    // ---- Dia a dia: missões e hábitos ----

    /** Vira o dia: sorteia as missões de hoje e zera os contadores diários. */
    rollDay(now = Date.now()) {
      const today = dayKey(new Date(now));
      if (this.daily.date === today) return false;
      const pool = [...Gatinho.MISSIONS];
      const ids = [];
      while (ids.length < Gatinho.CONFIG.missions.count && pool.length) ids.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
      this.daily = { date: today, ids, counters: {}, done: {}, bonus: false };
      return true;
    }

    dailyCounter(name) {
      return this.daily.counters[name] ?? 0;
    }

    /** O jogador cuidou de si na pausa (beber água, alongar...). Retorna as moedas. */
    recordHabit(now = Date.now()) {
      this.rollDay(now);
      this._bump('habits');
      const coins = this._earn(Gatinho.CONFIG.progress.habitCoins);
      this.addCoins(coins);
      return coins;
    }

    /** Uma pausa do pomodoro foi até o fim. */
    recordBreak(now = Date.now()) {
      this.rollDay(now);
      this._bump('breaksTaken');
    }

    /** Moedas ganhas por foco e cuidados valem mais ou menos conforme a dificuldade (conquistas e missões não). */
    _earn(base) {
      return Math.round(base * (Gatinho.CONFIG.difficulty[this.settings.difficulty]?.coins ?? 1));
    }

    // ---- Consultas (usadas pelos painéis) ----

    minutesOn(key) {
      return this.sessions.reduce((sum, s) => (dayKey(new Date(s.at)) === key ? sum + s.minutes : sum), 0);
    }

    minutesToday(now = Date.now()) {
      return this.minutesOn(dayKey(new Date(now)));
    }

    /** Minutos por dia nos últimos n dias, do mais antigo ao mais novo. */
    minutesPerDay(n, now = Date.now()) {
      return Array.from({ length: n }, (_, i) => {
        const date = daysAgo(n - 1 - i, now);
        const label = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').slice(0, 3);
        return { key: dayKey(date), label, minutes: this.minutesOn(dayKey(date)) };
      });
    }

    /** Total por tarefa, do maior ao menor. days = 0 significa "todo o histórico". */
    taskTotals(days = 0, now = Date.now()) {
      const since = days ? daysAgo(days - 1, now).getTime() : 0;
      const totals = new Map();
      for (const s of this.sessions) {
        if (s.at < since) continue;
        const key = s.task.toLowerCase();
        const entry = totals.get(key) ?? { task: s.task, minutes: 0, sessions: 0 };
        entry.minutes += s.minutes;
        entry.sessions += 1;
        totals.set(key, entry);
      }
      return [...totals.values()].sort((a, b) => b.minutes - a.minutes);
    }

    /** Dias seguidos batendo a meta (0 se a sequência já foi quebrada). */
    currentStreak(now = Date.now()) {
      const { count, lastDate } = this.streak;
      const alive = lastDate === dayKey(new Date(now)) || lastDate === dayKey(daysAgo(1, now));
      return alive ? count : 0;
    }

    /** Focos seguidos sem cancelar (0 se passou da janela de tempo). */
    currentCombo(now = Date.now()) {
      const windowMs = Gatinho.CONFIG.progress.comboWindowMinutes * 60000;
      return this.combo.lastAt && now - this.combo.lastAt <= windowMs ? this.combo.count : 0;
    }

    // ---- Internos ----

    _advanceCombo(now) {
      this.combo.count = this.currentCombo(now) + 1;
      this.combo.lastAt = now;
      this._max('bestCombo', this.combo.count);
      return this.combo.count;
    }

    /** Se a meta do dia foi atingida agora, atualiza a sequência e retorna o bônus. */
    _checkGoal(now) {
      const p = Gatinho.CONFIG.progress;
      const today = dayKey(new Date(now));
      if (this.goalPaidDate === today || this.minutesOn(today) < this.goalMinutes) return { met: false, coins: 0 };

      this.goalPaidDate = today;
      const continued = this.streak.lastDate === dayKey(daysAgo(1, now));
      this.streak.count = continued ? this.streak.count + 1 : 1;
      this.streak.lastDate = today;
      this._bump('goalsMet');
      this._max('bestStreak', this.streak.count);
      return { met: true, coins: p.dailyGoalCoins + (p.streakBonus[this.streak.count] ?? 0) };
    }

    _bump(name, amount = 1) {
      this.counters[name] = this.counter(name) + amount;
      this.daily.counters[name] = this.dailyCounter(name) + amount; // o mesmo contador, só do dia de hoje
    }

    _max(name, value) {
      this.counters[name] = Math.max(this.counter(name), value);
    }
  };
})();
