/** Painel "Configurações": som, notificações, dificuldade e backup do progresso (exportar e importar). */
Gatinho.SettingsPanel = {
  id: 'settings',
  icon: 'gear',
  title: 'Configurações',
  note: '',

  render(body, { profile, actions, refresh, save }) {
    const { html, CONFIG, Notify } = Gatinho;
    const s = profile.settings;
    const wrap = document.createElement('div');
    wrap.className = 'settings';
    wrap.innerHTML = `
      ${this.note ? `<p class="note">${html.escape(this.note)}</p>` : ''}
      <div class="card">
        <label class="row"><b>🔊 Sons</b><input type="checkbox" id="set-sound" ${s.sound ? 'checked' : ''}></label>
        <div class="row"><small>Volume</small><input type="range" id="set-volume" min="0" max="100" value="${s.soundVolume}" aria-label="Volume dos sons"><button type="button" class="btn btn--small" id="set-test">Testar</button></div>
      </div>
      <div class="card">
        <label class="row"><b>🔔 Notificações</b><input type="checkbox" id="set-notify" ${s.notifications ? 'checked' : ''} ${Notify.supported ? '' : 'disabled'}></label>
        <small>Avisa quando o timer termina ou ${'o gatinho'} precisa de você, mesmo com a janela atrás de outras.</small>
      </div>
      <div class="card">
        <b>Dificuldade</b>
        <div class="tabs">${Object.entries(CONFIG.difficulty).map(([key, d]) => `<button type="button" class="btn btn--small" data-difficulty="${key}" aria-pressed="${s.difficulty === key}">${d.label}</button>`).join('')}</div>
        <small>${html.escape(CONFIG.difficulty[s.difficulty].desc)}</small>
      </div>
      <div class="card">
        <b>💾 Backup do progresso</b>
        <div class="row"><button type="button" class="btn btn--small" id="set-export">Exportar</button>
          <label class="btn btn--small">Importar<input type="file" id="set-import" accept=".json,application/json" hidden></label></div>
        <small>Guarda tudo (gatinho, moedas, loja, conquistas) num arquivo. Importar substitui o progresso atual.</small>
      </div>`;

    const $ = (selector) => wrap.querySelector(selector);
    $('#set-sound').addEventListener('change', (event) => { actions.setSound(event.target.checked); refresh(); });
    $('#set-volume').addEventListener('input', (event) => {
      actions.setSoundVolume(Number(event.target.value));
      save?.();
    }); // sem redesenhar: não atrapalha o arrasto
    $('#set-test').addEventListener('click', () => actions.testSound());
    $('#set-notify').addEventListener('change', async (event) => { this.note = await actions.setNotifications(event.target.checked); refresh(); });
    wrap.addEventListener('click', (event) => {
      const button = event.target.closest('[data-difficulty]');
      if (button) { actions.setDifficulty(button.dataset.difficulty); this.note = ''; }
    });
    $('#set-export').addEventListener('click', () => { this.note = actions.exportBackup(); refresh(); });
    $('#set-import').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      this.note = actions.importBackup(await file.text());
      refresh();
    });
    body.append(wrap);
  },
};