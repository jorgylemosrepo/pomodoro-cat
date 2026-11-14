/**
 * MISSÕES DO DIA: a cada dia são sorteadas 3 destas. Para criar uma nova, adicione um item na lista:
 *   id      identificador único
 *   title   o que fazer
 *   counter contador do dia (os mesmos de data/achievements.js, mas contando só o dia de hoje)
 *   target  quanto precisa chegar
 *   coins   recompensa em moedas
 * Fazer as 3 dá um bônus extra (CONFIG.missions.bonusCoins).
 */
window.Gatinho = window.Gatinho || {};

Gatinho.MISSIONS = [
  { id: 'focus_50',  title: 'Foque por 50 minutos',        counter: 'focusMinutes',  target: 50, coins: 12 },
  { id: 'focus_2',   title: 'Conclua 2 focos',             counter: 'focusSessions', target: 2,  coins: 10 },
  { id: 'feed_2',    title: 'Dê ração 2 vezes',            counter: 'care:feed',     target: 2,  coins: 6 },
  { id: 'water_2',   title: 'Dê água 2 vezes',             counter: 'care:water',    target: 2,  coins: 6 },
  { id: 'play_2',    title: 'Brinque 2 vezes',             counter: 'care:play',     target: 2,  coins: 8 },
  { id: 'pet_3',     title: 'Faça carinho 3 vezes',        counter: 'care:pet',      target: 3,  coins: 8 },
  { id: 'clean_1',   title: 'Limpe a caixinha',            counter: 'care:clean',    target: 1,  coins: 6 },
  { id: 'break_1',   title: 'Faça uma pausa até o fim',    counter: 'breaksTaken',   target: 1,  coins: 6 },
  { id: 'habit_2',   title: 'Cuide de você na pausa 2 vezes', counter: 'habits',     target: 2,  coins: 10 },
];
