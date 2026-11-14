/**
 * Painel "Ambiente": ciclo do dia e da noite (manual, rápido ou horário local), se o gatinho dorme a noite
 * inteira ou continua ativo, e o estado atual (dia/noite, luz, energia). As mudanças passam por context.actions.ambient.
 */
Gatinho.AmbientPanel = {
  id: 'ambient',
  icon: 'moon',
  title: 'Ambiente',

  render(body, { ambient, pet, actions }) {
    const { CONFIG } = Gatinho;
    const s = ambient.settings;
    const now = Date.now();
    const night = ambient.isNight(now);
    const segment = (name, value, label, active) => `<button type="button" class="btn btn--small" data-${name}="${value}" aria-pressed="${active}">${label}</button>`;
    const cycleHint = {
      manual: 'Você escolhe quando é dia ou noite. Sem ciclo, o gatinho não se cansa.',
      fast: 'Dia e noite passam rápido, e o gatinho se cansa ao longo do dia.',
      local: 'Segue o horário do seu computador (noite das 21h às 6h). O gatinho se cansa ao longo do dia.',
    };
    const nightHint = {
      sleep: 'Ele dorme até amanhecer: fica escuro e os eventos aleatórios pausam. Use o 💡 no palco para acender a luz; acordado de madrugada ele fica cansado.',
      active: 'Ele continua acordado e os eventos aleatórios seguem acontecendo.',
    };
    const light = ambient.sleeping(now) ? (ambient.lightOn ? ' · luz acesa' : ' · luz apagada') : '';

    const wrap = document.createElement('div');
    wrap.className = 'ambient';
    wrap.innerHTML = `
      <div class="card">
        <div class="row"><b>Agora</b><span>${night ? '🌙 Noite' : '☀️ Dia'}${light}</span></div>
        ${ambient.fatigueEnabled
          ? `<div class="row"><b>Energia</b><span>${Math.round(pet.energy)}%</span></div><div class="meter"><i style="width:${Math.round(pet.energy)}%"></i></div>`
          : '<small>Sem ciclo de dia e noite não há cansaço.</small>'}
      </div>

      <div class="card">
        <b>Ciclo do dia e da noite</b>
        <div class="tabs">
          ${segment('cycle', 'manual', '✋ Manual', s.cycle === 'manual')}
          ${segment('cycle', 'fast', '⏩ Rápido', s.cycle === 'fast')}
          ${segment('cycle', 'local', '🕒 Horário local', s.cycle === 'local')}
        </div>
        <small>${cycleHint[s.cycle]}</small>
        ${s.cycle === 'fast' ? `<div class="row"><span>Um dia inteiro dura</span><span class="tabs">${CONFIG.ambient.fastOptions.map((m) => segment('fast', m, `${m} min`, s.fastMinutes === m)).join('')}</span></div>` : ''}
        ${s.cycle === 'manual' ? `<div class="row"><span>Agora é</span><span class="tabs">${segment('phase', 'day', '☀️ Dia', s.manualPhase === 'day')}${segment('phase', 'night', '🌙 Noite', s.manualPhase === 'night')}</span></div>` : ''}
      </div>

      <div class="card">
        <b>Durante a noite</b>
        <div class="tabs">
          ${segment('night', 'sleep', '😴 Dorme a noite inteira', s.nightMode === 'sleep')}
          ${segment('night', 'active', '🎲 Fica ativo', s.nightMode === 'active')}
        </div>
        <small>${nightHint[s.nightMode]}</small>
      </div>`;

    wrap.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if (!button) return;
      const { cycle, night: nightMode, fast, phase } = button.dataset;
      if (cycle) actions.setCycle(cycle);
      else if (nightMode) actions.setNightMode(nightMode);
      else if (fast) actions.setFastMinutes(Number(fast));
      else if (phase) actions.setPhase(phase);
    });
    body.append(wrap);
  },
};
