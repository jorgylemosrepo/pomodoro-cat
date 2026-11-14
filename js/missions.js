/** Motor das missões do dia: confere o progresso e paga as recompensas (a lista fica em data/missions.js). */
Gatinho.Missions = {
  /** Progresso de uma missão hoje, limitado ao alvo. */
  progress(mission, profile) {
    return Math.min(profile.dailyCounter(mission.counter), mission.target);
  },

  /**
   * Conclui as missões cumpridas, paga as moedas e o bônus de fazer todas.
   * Retorna { done: [missões novas], bonus: moedas do bônus (0 se não houve) }.
   */
  check(profile, now = Date.now()) {
    profile.rollDay(now);
    const done = [];
    for (const id of profile.daily.ids) {
      const mission = Gatinho.MISSIONS.find((m) => m.id === id);
      if (!mission || profile.daily.done[id] || profile.dailyCounter(mission.counter) < mission.target) continue;
      profile.daily.done[id] = true;
      profile.addCoins(mission.coins);
      profile._bump('missionsDone');
      done.push(mission);
    }
    let bonus = 0;
    const all = profile.daily.ids.length > 0 && profile.daily.ids.every((id) => profile.daily.done[id]);
    if (all && !profile.daily.bonus) {
      profile.daily.bonus = true;
      bonus = Gatinho.CONFIG.missions.bonusCoins;
      profile.addCoins(bonus);
      profile._bump('allMissionsDays');
    }
    return { done, bonus };
  },
};
