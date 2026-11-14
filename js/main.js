/** Ponto de entrada: cria as peças, liga umas nas outras e roda o relógio do jogo. */
(function () {
  const { CONFIG, Storage, Pet, Pomodoro, Profile, Achievements, Missions, Care, Ambient, Scenery, SceneStrip, FurnitureEditor, Animator, UI, Setup,
    PanelManager, Wardrobe, Life, MusicPlayer, MusicView, FloatingWindow, Sound, Notify, Backup, Updates, random } = Gatinho;

  const MAX_TICK_SECONDS = 5; // acima disso o tempo é tratado como "app suspenso" (ver advance)

  const root = document.getElementById('app');
  const catSvg = root.querySelector('#cat-stage');
  const saved = Storage.load();
  const pet = new Pet(saved?.pet);
  const pomodoro = new Pomodoro(saved?.pomodoro);
  const profile = new Profile(saved?.profile);
  const ambient = new Ambient(profile.settings.ambient);

  pet.environment = () => ambient.environment(Date.now()); // dia/noite, sono e luz alimentam o cansaço do gatinho
  applyDifficulty();
  Sound.configure(profile.settings);
  Notify.enabled = Boolean(profile.settings.notifications) && Notify.permitted;

  let lastTick = saved?.savedAt ?? Date.now();
  let secondsToFlavor = nextFlavorDelay();
  let secondsToRare = nextRareDelay();
  let secondsSinceSave = 0;
  let appliedStage = null;
  let currentHabit = null; // o hábito sugerido na pausa atual
  let skipSave = false;    // true ao importar um backup (para não sobrescrevê-lo ao recarregar)

  const lookup = (id) => Wardrobe.item(id);
  const currentScene = () => lookup(profile.equipped.scene) ?? lookup(CONFIG.defaultScene);

  /** Decide o que o gatinho está sentindo agora: cena, fala e ícone do balão. */
  function status() {
    const now = Date.now();
    if (!pet.alive) return { scene: 'rip', message: '{O} {gatinho} virou um anjinho… 😿', bubble: '' };
    if (ambient.lightsOff(now)) return { scene: 'sleep', message: 'Zzz… dormindo 🌙', bubble: '' };
    if (pet.sick) return { scene: 'sick', message: 'Não estou me sentindo bem… 🤒', bubble: '🤒' };

    const { need, value } = pet.mostUrgent();
    const info = CONFIG.needs[need];
    if (value < CONFIG.angryThreshold) return { scene: 'angry', message: CONFIG.angryMessage, bubble: '💢' };
    if (value < CONFIG.needThreshold) return { scene: info.scene, message: info.message, bubble: info.icon };

    const awakeAtNight = ambient.sleeping(now) && ambient.lightOn; // a luz acesa o acordou de madrugada
    if (ambient.fatigueEnabled && (pet.tired || awakeAtNight)) {
      return { scene: 'tired', message: awakeAtNight ? 'A luz está acesa… estou com sono 😴' : 'Estou cansad{o}… 😴', bubble: '😴' };
    }
    if (pomodoro.mode === 'break' && pomodoro.running) return { scene: 'coffee', message: 'Pausa para o café ☕', bubble: '' };

    const focusing = pomodoro.mode === 'focus' && pomodoro.running;
    return { scene: 'idle', message: focusing ? 'Estou de olho no seu foco 👀' : 'Tudo certo por aqui 😺', bubble: '' };
  }

  const animator = new Animator(catSvg, () => status().scene);

  const ui = new UI(root, {
    action(key) {
      const result = Care.perform(key, { pet, profile });
      if (!result.ok) return ui.say(result.message);
      const { scene, ms, supply } = CONFIG.actions[key];
      if (key === 'pet') Sound.purr();
      animator.play([{ scene, ms }, { scene: 'happy', ms: CONFIG.happyMs }]);
      const parts = [`+${result.points} pontos`];
      if (result.coins) parts.push(`+${result.coins} 🪙`);
      if (supply && profile.supplyCount(supply) <= 1) parts.push(`restam ${profile.supplyCount(supply)} de ${CONFIG.supplies.labels[supply]}`);
      ui.say(parts.join(' · ') + (result.urgent ? ' (ele precisava!)' : ''));
      commit();
    },
    start(data) {
      currentHabit = null;
      pomodoro.start(data);
      commit();
    },
    preset({ mode, minutes }) {
      if (mode === 'focus') ui.setMinutes(minutes); // a pausa não muda o tempo padrão do foco
      currentHabit = mode === 'break' ? random.pick(Gatinho.HABITS) : null; // na pausa, um hábito saudável
      pomodoro.start(ui.formData(mode, minutes));
      commit();
    },
    pause() {
      if (pomodoro.running) pomodoro.pause();
      else pomodoro.resume();
      commit();
    },
    cancel() {
      if (pomodoro.mode === 'focus') profile.recordCancel(); // cancelar um foco quebra o combo
      currentHabit = null;
      pomodoro.cancel();
      commit();
    },
    habit() {
      if (!currentHabit) return;
      const coins = profile.recordHabit();
      if (ambient.fatigueEnabled) pet.energy = Math.min(100, pet.energy + 8); // cuidar de você também descansa o gatinho
      Sound.coin();
      ui.say(`${currentHabit.icon} Muito bem! +${coins} 🪙`);
      currentHabit = null;
      commit();
    },
    light() {
      ui.say(ambient.toggleLight() ? 'Luz acesa 💡' : 'Luz apagada 🌙', 2500);
      commit();
    },
    edit() {
      editor.setEditing(!editor.editing);
      if (editor.editing) ui.say('Clique num móvel e arraste. Delete guarda, Esc termina. O tamanho é fixo 🔒', 6000);
      commit();
    },
    revive() {
      openSetup('rebirth'); // reviver = escolher nome e gênero do novo filhote
    },
    async pin() {
      if (!FloatingWindow.supported) return ui.say('Para fixar a janela, use Chrome ou Edge 116+.', 6000);
      try {
        await FloatingWindow.toggle(root);
        applyLook(); // a janela flutuante é outro documento
      } catch {
        ui.say('Não consegui abrir a janela flutuante.', 5000);
      }
    },
  });
  ui.gender = pet.life.gender;

  // ---- Cenário: tira de cenários e editor de móveis ----

  const strip = new SceneStrip(root, {
    onPick(sceneId) {
      const result = profile.equip(lookup(sceneId));
      if (!result.ok) return;
      editor.select(null);
      applyLook();
      commit();
    },
  });

  const editor = new FurnitureEditor(catSvg, {
    getPlacements: () => profile.placed(currentScene().id),
    lookup,
    onChange: (persist) => {
      if (persist) save();
      update();
    },
    onStore: (index) => storeAt(index),
    onToggle: () => update(),
  });

  function storeAt(index) {
    const entry = profile.placed(currentScene().id)[index];
    if (!entry) return;
    profile.store(currentScene().id, entry.id);
    editor.select(null);
    ui.say(`${lookup(entry.id).name} guardado no inventário.`);
    commit();
  }

  // ---- Escolha do felino ----

  const setup = new Setup(root);

  /** mode "adopt" = primeiro uso (não pode cancelar); "rebirth" = reviver um gatinho que morreu. */
  function openSetup(mode) {
    const rebirth = mode === 'rebirth';
    const isNewGame = !saved?.pet;
    setup.open(
      {
        title: rebirth ? 'Um novo gatinho vai nascer 🐾' : 'Adote seu gatinho 🐾',
        name: rebirth || !isNewGame ? pet.life.name : '',
        gender: rebirth ? pet.life.gender : null,
        confirmLabel: rebirth ? 'Reviver' : 'Começar',
        cancellable: rebirth,
      },
      ({ name, gender }) => {
        const result = pet.life.adopt({ name, gender });
        if (!result.ok) return result;
        if (rebirth) {
          pet.revive();
          profile.recordRevive();
        }
        ui.gender = gender;
        animator.play([{ scene: 'happy', ms: CONFIG.happyMs }]);
        ui.say(`${pet.life.name} chegou! Cuide bem d{ele} 💗`, 6000);
        commit();
        return result;
      }
    );
  }

  // ---- Música ----

  const music = new MusicPlayer(document.getElementById('music-host'), profile.settings.musicVolume);
  const MUSIC_COMMANDS = ['toggle', 'next', 'prev']; // o que os botões data-music podem chamar
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-music]');
    if (button && MUSIC_COMMANDS.includes(button.dataset.music)) music[button.dataset.music]();
  });
  music.addEventListener('change', () => MusicView.render(root, music));
  music.addEventListener('error', ({ detail }) => {
    Gatinho.MusicPanel.notify(detail); // com o painel aberto, a fala do gatinho fica escondida
    ui.say(`🎵 ${detail}`, 7000);
  });

  // ---- Atualizações pelo GitHub ----

  const appInfo = window.desktop?.appInfo ?? { version: CONFIG.version, kind: 'browser', arch: 'x64', repository: '', canGitPull: false };
  const updates = new Updates({ settings: profile.settings.update, info: appInfo });
  updates.addEventListener('change', () => {
    panels.setBadge('update', updates.available ? '!' : 0); // bolinha no 🔄 quando há versão nova
    panels.refresh();
  });

  // ---- Janelinhas (painéis) e as ações que elas pedem ----

  const wardrobeAction = (run, successMessage) => {
    const result = run();
    if (!result.ok) return result.reason;
    Sound.coin();
    applyLook();
    commit();
    return successMessage;
  };

  const actions = {
    // atualizações (GitHub)
    async checkUpdates() {
      await updates.check();
      save();
    },
    saveRepo(text) {
      const result = updates.setRepo(text);
      if (!result.ok) return result.reason;
      save();
      return String(text).trim() ? 'Repositório salvo ✓' : 'Usando o repositório do projeto.';
    },
    setAutoUpdate(on) {
      profile.settings.update.auto = on;
      save();
    },
    openUpdateUrl(url) {
      if (window.desktop?.openUpdateUrl) window.desktop.openUpdateUrl(url, updates.repo);
      else window.open(url, '_blank', 'noopener');
    },
    gitPull: () => window.desktop?.gitPull() ?? Promise.resolve({ ok: false, output: 'Só disponível no app de desktop.' }),
    restartApp: () => window.desktop?.relaunch(),
    // loja e inventário (cada ação devolve o aviso mostrado no painel)
    buy: (id) => wardrobeAction(() => profile.buy(lookup(id)), `Comprou ${lookup(id).name}! −${lookup(id).price} 🪙`),
    equip: (id) => wardrobeAction(() => profile.equip(lookup(id)), `${lookup(id).name} equipado!`),
    unequip: (slot) => wardrobeAction(() => profile.unequip(slot), 'Item guardado.'),
    place(id) {
      const item = lookup(id);
      const sceneId = currentScene().id;
      const spot = Scenery.defaultPosition(item, profile.placed(sceneId), lookup);
      const result = profile.place(sceneId, id, spot.x, spot.y);
      if (!result.ok) return result.reason;
      editor.setEditing(true);
      editor.select(profile.placed(sceneId).findIndex((entry) => entry.id === id));
      commit();
      return `${item.name} colocado! Arraste no palco para mudar o lugar.`;
    },
    store(id) {
      const result = profile.store(currentScene().id, id);
      if (!result.ok) return result.reason;
      editor.select(null);
      commit();
      return `${lookup(id).name} guardado.`;
    },
    rename(name) {
      const result = pet.life.rename(name);
      if (!result.ok) return result.reason;
      commit();
      return ui.format(`Agora {ele} se chama ${pet.life.name}!`);
    },
    // ambiente
    setCycle: (cycle) => { ambient.setCycle(cycle); commit(); },
    setNightMode: (mode) => { ambient.setNightMode(mode); commit(); },
    setFastMinutes: (minutes) => { ambient.setFastMinutes(minutes); commit(); },
    setPhase: (phase) => { ambient.setManualPhase(phase); commit(); },
    // configurações
    setSound(on) {
      profile.settings.sound = on;
      Sound.configure(profile.settings);
      if (on) Sound.coin();
      save();
    },
    setSoundVolume(volume) {
      profile.settings.soundVolume = volume;
      Sound.configure(profile.settings);
      save();
    },
    testSound: () => Sound.achievement(),
    async setNotifications(on) {
      if (!on) {
        Notify.disable();
        profile.settings.notifications = false;
        save();
        return 'Notificações desligadas.';
      }
      const result = await Notify.enable();
      profile.settings.notifications = result.ok;
      save();
      if (result.ok) Notify.show('Gatinho Pomodoro', 'Notificações ligadas! 🐱');
      return result.ok ? 'Notificações ligadas.' : result.reason;
    },
    setDifficulty(key) {
      if (!CONFIG.difficulty[key]) return;
      profile.settings.difficulty = key;
      applyDifficulty();
      commit();
    },
    exportBackup() {
      Backup.download(Backup.serialize(snapshot()), Backup.fileName(), root.ownerDocument);
      return 'Backup exportado ✓';
    },
    importBackup(text) {
      const result = Backup.parse(text);
      if (!result.ok) return result.reason;
      skipSave = true; // senão o salvamento ao recarregar apagaria o que acabou de ser importado
      Storage.save(result.data);
      location.reload();
      return 'Importando…';
    },
  };

  const context = { root, music, pet, profile, ambient, updates, actions, save, refresh: () => panels.refresh(), updateBadges };
  const panels = new PanelManager(root, context);
  [Gatinho.ShopPanel, Gatinho.InventoryPanel, Gatinho.MissionsPanel, Gatinho.HistoryPanel, Gatinho.AchievementsPanel, Gatinho.CatPanel,
    Gatinho.AmbientPanel, Gatinho.MusicPanel, Gatinho.RankingPanel, Gatinho.SettingsPanel, Gatinho.UpdatePanel].forEach((panel) => panels.register(panel));

  function updateBadges() {
    panels.setBadge('achievements', profile.unseen.length);
  }

  /** Conquistas e missões cumpridas: paga, toca o sininho e avisa o jogador. */
  function checkProgress() {
    if (pet.alive) profile.noteLife(pet.life.ageDays());
    const achievements = Achievements.check(profile);
    const missions = Missions.check(profile);
    const lines = [];
    if (achievements.length) {
      const titles = achievements.map((a) => a.title).join(', ');
      lines.push(`🏅 ${titles} (+${achievements.reduce((sum, a) => sum + a.coins, 0)} 🪙)`);
      Sound.achievement();
      Notify.show('Conquista desbloqueada!', titles);
    }
    if (missions.done.length) {
      lines.push(`🎯 ${missions.done.map((m) => m.title).join(', ')}${missions.bonus ? ` · dia perfeito, +${missions.bonus} 🪙` : ''}`);
      if (!achievements.length) Sound.coin();
    }
    if (lines.length) ui.say(lines.join(' · '), 9000, { append: true });
    if (lines.length) updateBadges();
  }

  // ---- Eventos do jogo ----

  pet.addEventListener('died', ({ detail }) => {
    animator.play([{ scene: 'dead', ms: CONFIG.deathMs }]);
    profile.recordDeath(detail);
    const cause = detail.cause === 'doença' ? 'não resistiu à doença' : 'se foi';
    ui.say(`${detail.name} ${cause}… a pontuação foi zerada.`, 8000);
    Notify.show('O gatinho se foi 😿', `${detail.name} ${cause}.`);
    checkProgress();
  });

  pet.addEventListener('event', ({ detail }) => {
    ui.say(detail.type === 'sick' ? CONFIG.illness.message : CONFIG.needs[detail.need].event, 6000);
    Sound.meow();
    if (detail.type === 'sick') Notify.show('O gatinho está doente 🤒', ui.format(CONFIG.illness.message));
  });

  pomodoro.addEventListener('done', ({ detail }) => {
    Sound.timerDone();
    if (detail.mode === 'break') {
      profile.recordBreak();
      currentHabit = null;
      ui.say('A pausa acabou. Hora de voltar! 💪', 8000);
      Notify.show('A pausa acabou ☕', 'Hora de voltar ao foco! 💪');
    } else {
      const reward = profile.recordFocus(detail); // o histórico vale mesmo com o gatinho morto
      const parts = [`Foco concluído! +${reward.coins} 🪙`];
      if (pet.alive) {
        const points = pet.addFocusMinutes(detail.minutes) + pet.addPoints(reward.bonusPoints);
        parts.push(`+${points} pontos`);
        animator.play([{ scene: 'happy', ms: CONFIG.happyMs * 2 }]);
      } else {
        parts.push('reviva o gatinho para ganhar pontos');
      }
      if (reward.combo > 1) parts.push(`combo x${reward.combo}`);
      if (reward.goalMet) parts.push(`meta do dia! 🎯 (${reward.streak} ${reward.streak === 1 ? 'dia' : 'dias'})`);
      ui.say(parts.join(' · '), 9000);
      Notify.show('Foco concluído 🎉', `${detail.task || 'Foco'}: ${detail.minutes} min. Hora da pausa!`);
    }
    commit();
  });

  // ---- Relógio do jogo ----

  /**
   * Avança o jogo até agora. Usa o relógio real (não "1 segundo por chamada"), então
   * atrasos do navegador não distorcem o tempo. Se passou muito tempo de uma vez
   * (computador suspenso, app fechado), conta como offline: limitado e sem matar o gatinho.
   */
  function advance() {
    const now = Date.now();
    const elapsed = Math.max(0, (now - lastTick) / 1000);
    lastTick = now;

    const onBreak = pomodoro.mode === 'break' && pomodoro.running; // a pausa descansa o gatinho
    if (elapsed > MAX_TICK_SECONDS) pet.tick(Math.min(elapsed, CONFIG.maxOfflineMinutes * 60), { offline: true });
    else pet.tick(elapsed, { onBreak });

    pomodoro.check();
    ambient.sync(now); // toda noite nova começa de luz apagada
    maybeIdleFlavor(Math.min(elapsed, MAX_TICK_SECONDS));
    if (elapsed <= MAX_TICK_SECONDS) maybeRareEvent(elapsed);
    secondsSinceSave += elapsed;
  }

  function onSecond() {
    advance();
    checkProgress();
    if (secondsSinceSave >= 15) save();
    update();
  }

  function nextFlavorDelay() {
    return random.between(CONFIG.idleFlavor.minSeconds, CONFIG.idleFlavor.maxSeconds);
  }

  /** De tempos em tempos (e sem depender do timer) o gatinho faz uma gracinha. Dormindo, não. */
  function maybeIdleFlavor(seconds) {
    secondsToFlavor -= seconds;
    if (secondsToFlavor > 0 || !pet.life.adopted) return;
    secondsToFlavor = nextFlavorDelay();
    if (status().scene === 'idle' && !animator.busy && !ambient.sleeping()) animator.play([random.pick(CONFIG.idleFlavor.scenes)]);
  }

  function nextRareDelay() {
    return random.between(CONFIG.rareEvent.minSeconds, CONFIG.rareEvent.maxSeconds);
  }

  /** De tempos em tempos acontece um evento raro (data/rare-events.js). Dormindo a noite inteira, não. */
  function maybeRareEvent(seconds) {
    secondsToRare -= seconds;
    if (secondsToRare > 0 || !pet.alive || !pet.life.adopted || ambient.sleeping()) return;
    secondsToRare = nextRareDelay();
    const event = random.pickWeighted(Gatinho.RARE_EVENTS);
    const message = event.run({ pet, profile, random, CONFIG });
    profile.recordRareEvent();
    animator.play([{ scene: event.scene, ms: event.ms }]);
    ui.say(message, 9000);
  }

  /** Um Worker não é atrasado quando a janela fica em segundo plano. */
  function startClock(callback) {
    try {
      const code = 'setInterval(() => postMessage(0), 1000)';
      new Worker(URL.createObjectURL(new Blob([code]))).onmessage = callback;
    } catch {
      setInterval(callback, 1000);
    }
  }

  // ---- Utilitários ----

  function applyDifficulty() {
    pet.rules = CONFIG.difficulty[profile.settings.difficulty] ?? CONFIG.difficulty.normal;
  }

  function update() {
    const now = Date.now();
    const night = ambient.isNight(now);
    const lightsOff = ambient.lightsOff(now);
    const scene = currentScene();
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    const tone = Wardrobe.stageTone(profile.equipped, night, prefersDark);

    applyStage();
    Scenery.mount(catSvg, {
      scene, night, lightsOff, lookup,
      placements: profile.placed(scene.id),
      dirt: Scenery.dirtCount(pet.stats.hygiene),
      editing: editor.editing,
      selected: editor.selected,
    });
    strip.render(profile);
    animator.refresh();
    ui.render({
      pet, pomodoro, profile, night, tone,
      env: { fatigue: ambient.fatigueEnabled, lightSwitch: ambient.sleeping(now), lightOn: ambient.lightOn, lightsOff, editing: editor.editing },
      habit: pomodoro.mode === 'break' ? currentHabit : null,
      ...status(),
    });
  }

  /** Filhote é menor; ajusta o tamanho quando a fase da vida muda. */
  function applyStage() {
    const stage = pet.life.stage();
    if (stage.id === appliedStage) return;
    appliedStage = stage.id;
    Life.applyStage(catSvg, stage);
  }

  /** Aplica tudo que o jogador escolheu na loja: cor e roupinhas, tema da janela. (O cenário é desenhado em update.) */
  function applyLook() {
    Wardrobe.apply(catSvg, profile.equipped);
    const theme = Wardrobe.applyTheme(root, profile.equipped);
    // No app de desktop, avisa o Electron para pintar também o que é dele (fundo da janela, rolagem, campos)
    const background = getComputedStyle(root).getPropertyValue('--bg').trim();
    window.desktop?.setWindowTheme?.({ scheme: theme.scheme ?? 'system', background });
  }

  /** Depois de uma ação do usuário: confere conquistas e missões, atualiza a tela e salva. */
  function commit() {
    checkProgress();
    update();
    panels.refresh();
    save();
  }

  const snapshot = () => ({ pet, pomodoro, profile, savedAt: Date.now() });

  function save() {
    secondsSinceSave = 0;
    Storage.save(snapshot());
  }

  // ---- Início ----

  applyLook();
  advance(); // recupera o tempo em que o app ficou fechado
  profile.rollDay();
  updateBadges();
  update();
  startClock(onSecond);
  if (!pet.life.adopted) openSetup('adopt');
  panels.setBadge('update', updates.available ? '!' : 0);
  if (updates.shouldAutoCheck()) { // no máximo 1 consulta por dia
    updates.check().then(() => {
      save();
      if (updates.available) ui.say(`🔄 Nova versão ${updates.latest.version} disponível! Veja em Atualizações.`, 9000);
    });
  }

  // No app de desktop (Electron) a janela já fica no topo: o botão Fixar não é necessário.
  if (window.desktop) root.querySelector('[data-command="pin"]').hidden = true; // (o user agent não diz mais "Electron")

  window.addEventListener('beforeunload', () => { if (!skipSave) save(); });
  document.getElementById('unpin').addEventListener('click', () => FloatingWindow.close());
})();
