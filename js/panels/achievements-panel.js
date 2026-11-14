/** Painel "Conquistas": lista de todas, com progresso das que faltam. */
Gatinho.AchievementsPanel = {
  id: 'achievements',
  icon: 'medal',
  title: 'Conquistas',

  render(body, { profile, updateBadges }) {
    const { html, ACHIEVEMENTS, Achievements } = Gatinho;
    const done = ACHIEVEMENTS.filter((a) => profile.achievements[a.id]).length;

    const card = (a) => {
      const unlockedAt = profile.achievements[a.id];
      const isNew = profile.unseen.includes(a.id);
      const progress = Achievements.progress(a, profile);
      const status = unlockedAt
        ? `<small>+${a.coins} 🪙 · ${new Date(unlockedAt).toLocaleDateString('pt-BR')}</small>`
        : `<div class="meter"><i style="width:${Math.round((progress / a.when.atLeast) * 100)}%"></i></div><small>${progress} / ${a.when.atLeast} · recompensa ${a.coins} 🪙</small>`;
      return `<li class="ach ${unlockedAt ? 'ach--done' : ''} ${isNew ? 'ach--new' : ''}">
        <span class="ach__icon">${html.icon(unlockedAt ? a.icon : 'lock', 22)}</span>
        <div class="ach__text"><b>${html.escape(a.title)}</b><small>${html.escape(a.desc)}</small>${status}</div>
      </li>`;
    };

    body.innerHTML = `<p class="summary">${done} / ${ACHIEVEMENTS.length} conquistas</p><ul class="list">${ACHIEVEMENTS.map(card).join('')}</ul>`;

    profile.markSeen(); // o destaque "novo" aparece só nesta abertura
    updateBadges();
  },
};
