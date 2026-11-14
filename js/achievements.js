/** Motor de conquistas: confere a lista em data/achievements.js contra os contadores do Profile. */
Gatinho.Achievements = {
  /**
   * Desbloqueia tudo que foi cumprido e retorna as conquistas novas.
   * Repete enquanto houver novas, porque a recompensa em moedas pode liberar outras.
   */
  check(profile, now = Date.now()) {
    const unlocked = [];
    let fresh;
    do {
      fresh = Gatinho.ACHIEVEMENTS.filter((a) => !profile.achievements[a.id] && this.isMet(a, profile));
      for (const achievement of fresh) profile.unlock(achievement, now);
      unlocked.push(...fresh);
    } while (fresh.length);
    return unlocked;
  },

  isMet(achievement, profile) {
    return profile.counter(achievement.when.counter) >= achievement.when.atLeast;
  },

  /** Progresso atual (limitado ao alvo), para a barrinha do painel. */
  progress(achievement, profile) {
    return Math.min(profile.counter(achievement.when.counter), achievement.when.atLeast);
  },
};
