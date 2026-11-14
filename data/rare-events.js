/**
 * EVENTOS RARAS: acontecem sozinhos, a cada 25 a 70 minutos (ver CONFIG.rareEvent).
 * Para criar um novo, adicione um objeto na lista:
 *
 *   id      identificador
 *   weight  chance relativa de ser sorteado (maior = mais comum)
 *   scene   animação mostrada (nome de uma cena de css/cat.css)
 *   ms      duração da animação
 *   run     função que aplica o efeito e retorna a mensagem. Recebe { pet, profile, random, CONFIG }.
 */
window.Gatinho = window.Gatinho || {};

Gatinho.RARE_EVENTS = [
  {
    id: 'gift', weight: 3, scene: 'happy', ms: 2400,
    run({ profile, random }) {
      const coins = Math.round(random.between(15, 40));
      profile.addCoins(coins);
      return `🎁 {Ele} trouxe um presentinho! +${coins} 🪙`;
    },
  },
  {
    id: 'zoomies', weight: 3, scene: 'ball', ms: 6000,
    run({ pet }) {
      pet.stats.fun = Math.min(100, pet.stats.fun + 30);
      return '🌀 Deu a louca e correu pela casa! Diversão +30';
    },
  },
  {
    id: 'jealous', weight: 2, scene: 'sad', ms: 5000,
    run({ pet, CONFIG }) {
      pet.stats.affection = Math.min(pet.stats.affection, CONFIG.needThreshold - 5);
      return '😾 Ficou com ciúmes do seu computador!';
    },
  },
  {
    id: 'nap', weight: 2, scene: 'sleep', ms: 8000,
    run({ pet }) {
      pet.stats.affection = Math.min(100, pet.stats.affection + 15);
      return '😴 Tirou uma sonequinha e acordou animad{o}! Carinho +15';
    },
  },
];
