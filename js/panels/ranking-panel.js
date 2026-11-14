/** Painel "World Ranking": espaço reservado para uma atualização futura (ranking mundial). */
Gatinho.RankingPanel = {
  id: 'ranking',
  icon: 'globe',
  title: 'World Ranking',

  render(body, { profile, pet }) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="card ranking">
        <div class="ranking__globe">🌍</div>
        <b>Em breve!</b>
        <small>Em uma próxima atualização você poderá comparar sua pontuação e seu recorde com jogadores do mundo todo.</small>
        <button type="button" class="btn btn--small" disabled>Entrar no ranking</button>
      </div>
      <div class="card">
        <b>Seus números até agora</b>
        <div class="row"><span>⭐ Pontos</span><b>${pet.score}</b></div>
        <div class="row"><span>🏆 Recorde</span><b>${pet.record}</b></div>
        <div class="row"><span>🎯 Focos concluídos</span><b>${profile.counter('focusSessions')}</b></div>
        <div class="row"><span>🔥 Maior sequência</span><b>${profile.counter('bestStreak')} dias</b></div>
      </div>`;
    body.append(wrap);
  },
};
