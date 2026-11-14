/** Painel "Missões": as 3 missões de hoje, o progresso de cada uma e o bônus de fazer todas. */
Gatinho.MissionsPanel = {
  id: 'missions',
  icon: 'target',
  title: 'Missões',

  render(body, { profile, save }) {
    const { html, MISSIONS, Missions, CONFIG } = Gatinho;
    if (profile.rollDay()) save(); // virou o dia: sorteia as missões novas
    const list = profile.daily.ids.map((id) => MISSIONS.find((m) => m.id === id)).filter(Boolean);
    const done = list.filter((m) => profile.daily.done[m.id]).length;

    const card = (mission) => {
      const finished = Boolean(profile.daily.done[mission.id]);
      const progress = Missions.progress(mission, profile);
      return `<li class="ach ${finished ? 'ach--done' : ''}">
        <span class="ach__icon">${html.icon(finished ? 'medal' : 'target', 22)}</span>
        <div class="ach__text"><b>${html.escape(mission.title)}</b>
          <div class="meter"><i style="width:${Math.round((progress / mission.target) * 100)}%"></i></div>
          <small>${progress} / ${mission.target} · ${finished ? 'concluída ✓' : `recompensa ${mission.coins} 🪙`}</small></div>
      </li>`;
    };

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <p class="summary">${done} / ${list.length} missões de hoje</p>
      <ul class="list">${list.map(card).join('')}</ul>
      <p class="summary">${profile.daily.bonus ? '🎉 Bônus do dia recebido!' : `Complete as ${list.length} e ganhe +${CONFIG.missions.bonusCoins} 🪙 de bônus.`}</p>
      <p class="summary"><small>As missões mudam todo dia, à meia-noite.</small></p>`;
    body.append(wrap);
  },
};
