/** Painel "Histórico": meta do dia, sequência, combo, gráfico da semana e tempo por tarefa. */
Gatinho.HistoryPanel = {
  id: 'history',
  icon: 'chart',
  title: 'Histórico',
  period: 7, // 7 = últimos 7 dias, 0 = tudo (guarda a escolha enquanto o app está aberto)

  render(body, { profile, save, refresh }) {
    const { html } = Gatinho;
    const now = Date.now();
    const today = profile.minutesToday(now);
    const goalPercent = Math.min(100, Math.round((today / profile.goalMinutes) * 100));
    const week = profile.minutesPerDay(7, now);
    const peak = Math.max(1, ...week.map((day) => day.minutes));
    const tasks = profile.taskTotals(this.period, now).slice(0, 6);
    const taskPeak = Math.max(1, ...tasks.map((task) => task.minutes));
    const recent = profile.sessions.slice(-4).reverse();

    body.innerHTML = `
      <div class="card">
        <div class="row"><b>Hoje</b>
          <span>${today} / <input id="goal" class="field field--mini" type="number" min="10" max="600" value="${profile.goalMinutes}" aria-label="Meta diária em minutos"> min</span>
        </div>
        <div class="meter"><i style="width:${goalPercent}%"></i></div>
      </div>

      <div class="chips">
        <span class="chip" title="Dias seguidos batendo a meta">${html.icon('flame', 16)} ${profile.currentStreak(now)} dias</span>
        <span class="chip" title="Focos seguidos sem cancelar">${html.icon('bolt', 16)} combo ${profile.currentCombo(now)}</span>
        <span class="chip" title="Focos concluídos no total">${html.icon('clock', 16)} ${profile.counter('focusSessions')} focos</span>
      </div>

      <div class="card">
        <b>Últimos 7 dias</b>
        <div class="bars">${week
          .map((day) => `<div class="bar" title="${day.minutes} min"><i style="height:${Math.round((day.minutes / peak) * 100)}%"></i><span>${day.label}</span></div>`)
          .join('')}</div>
      </div>

      <div class="card">
        <div class="row"><b>Por tarefa</b>
          <span class="tabs">
            <button type="button" class="btn btn--small" data-period="7" aria-pressed="${this.period === 7}">7 dias</button>
            <button type="button" class="btn btn--small" data-period="0" aria-pressed="${this.period === 0}">Tudo</button>
          </span>
        </div>
        ${tasks.length
          ? `<ul class="list">${tasks
              .map((t) => `<li><div class="row"><span class="ellipsis">${html.escape(t.task)}</span><small>${t.minutes} min · ${t.sessions}x</small></div><div class="meter"><i style="width:${Math.round((t.minutes / taskPeak) * 100)}%"></i></div></li>`)
              .join('')}</ul>`
          : '<p class="empty">Nenhum foco concluído ainda.</p>'}
      </div>

      ${recent.length
        ? `<div class="card"><b>Últimos focos</b><ul class="list">${recent
            .map((s) => `<li class="row"><span class="ellipsis">${html.escape(s.task)}</span><small>${new Date(s.at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · ${s.minutes} min</small></li>`)
            .join('')}</ul></div>`
        : ''}`;

    body.querySelector('#goal').addEventListener('change', (event) => {
      profile.goalMinutes = Math.min(600, Math.max(10, Math.round(Number(event.target.value)) || profile.goalMinutes));
      save();
      refresh();
    });
    for (const button of body.querySelectorAll('[data-period]')) {
      button.addEventListener('click', () => {
        this.period = Number(button.dataset.period);
        refresh();
      });
    }
  },
};
