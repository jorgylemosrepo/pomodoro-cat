/** Sorteios usados pelo jogo. Ficam num arquivo só para facilitar testes e manutenção. */
window.Gatinho = window.Gatinho || {};

Gatinho.random = {
  /** Número real entre min e max. */
  between(min, max) {
    return min + Math.random() * (max - min);
  },
  /** Sorteio com pesos: cada item precisa de "weight". */
  pickWeighted(list) {
    let roll = Math.random() * list.reduce((sum, item) => sum + item.weight, 0);
    for (const item of list) {
      roll -= item.weight;
      if (roll <= 0) return item;
    }
    return list[list.length - 1];
  },
  /** Um item aleatório de uma lista. */
  pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  },
};
