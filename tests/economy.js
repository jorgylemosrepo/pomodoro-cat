/**
 * Simula 100 horas de um jogador atento (ciclos de 25 min de foco + 5 min de pausa) e confere se a economia
 * é estável: renda por hora, quanto vai para ração/água/remédio e quanto sobra para a loja.
 * Uso: node tests/economy.js
 */
const fs = require('fs');
const path = require('path');
global.window = global;
global.localStorage = { getItem() {}, setItem() {} };
for (const file of ['random', 'config', 'html', 'life', 'ambient', 'pet', 'profile', '../data/items', '../data/missions', 'care']) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`).replace('js/../', ''), 'utf8'));
}
const { Pet, Profile, Care, CONFIG, ITEMS } = Gatinho;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}
function seed(value) { let s = value; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }

const NOON = new Date(2026, 9, 5, 12, 0).getTime();
const careFor = Object.fromEntries(Object.entries(CONFIG.actions).filter(([, a]) => a.need).map(([key, a]) => [a.need, key]));
const buyFor = { food: 'supply_food', water: 'supply_water', medicine: 'supply_medicine' };
const item = (id) => ITEMS.find((i) => i.id === id);

/** Um jogador atento: reage em até 5 min a cada pedido do gatinho e compra suprimento quando acaba. */
function simulate(hours, difficulty = 'normal') {
  seed(11);
  const profile = new Profile();
  profile.settings.difficulty = difficulty;
  profile.goalMinutes = 1e9; // a meta diária e a sequência rendem bônus à parte; aqui medimos só a renda base
  const pet = new Pet({ life: { name: 'T', adopted: true, personality: 'neutral', bornAt: NOON - 10 * 86400000 } }, { now: () => NOON });
  pet.rules = CONFIG.difficulty[difficulty];
  const stats = { deaths: 0, cares: 0, waterFromFocus: 0, waterDrunk: 0, bought: { food: 0, water: 0, medicine: 0 }, stuck: 0 };
  pet.addEventListener('died', () => { stats.deaths++; pet.revive(); });
  const waiting = {};
  let clock = NOON;

  const act = (key) => {
    let result = Care.perform(key, { pet, profile });
    const supply = CONFIG.actions[key].supply;
    if (!result.ok && supply && !profile.hasSupply(supply)) {
      const bought = profile.buy(item(buyFor[supply]));
      if (!bought.ok) { stats.stuck++; return false; } // sem moedas: tenta de novo mais tarde
      stats.bought[supply]++;
      result = Care.perform(key, { pet, profile });
    }
    if (result.ok) { stats.cares++; if (key === 'water') stats.waterDrunk++; }
    return true;
  };

  for (let second = 0; second < hours * 3600; second++) {
    clock += 1000;
    const minuteOfBlock = (second / 60) % 30;
    const onBreak = minuteOfBlock >= 25;
    pet.tick(1, { onBreak });
    if (second % 1800 === 1500 - 1) { // fim de um foco de 25 min
      const reward = profile.recordFocus({ task: 'x', minutes: 25 }, clock);
      stats.waterFromFocus += 25 * CONFIG.supplies.waterPerFocusMinute;
      pet.addFocusMinutes(25); pet.addPoints(reward.bonusPoints);
    }
    for (const [need, value] of Object.entries(pet.stats)) {
      if (value < CONFIG.needThreshold && waiting[need] === undefined) waiting[need] = second + Math.random() * 300;
      if (waiting[need] !== undefined && second >= waiting[need]) { if (act(careFor[need])) waiting[need] = undefined; else waiting[need] = second + 60; }
    }
    if (pet.sick && waiting.sick === undefined) waiting.sick = second + Math.random() * 300;
    if (waiting.sick !== undefined && second >= waiting.sick) { if (act('medicine')) waiting.sick = undefined; else waiting.sick = second + 60; }
  }
  return { profile, stats, hours };
}

const H = 100;
const { profile, stats } = simulate(H);
const income = profile.counter('coinsEarned') / H;
const spent = profile.counter('coinsSpent') / H;
const net = income - spent;
const per = (n) => (n / H).toFixed(1);

console.log(`\n${H}h de jogador atento (normal):`);
console.log(`  renda: ${income.toFixed(1)} moedas/h | gasto com suprimentos: ${spent.toFixed(1)}/h (${((spent / income) * 100).toFixed(0)}%) | sobra para a loja: ${net.toFixed(1)}/h`);
console.log(`  ração comprada: ${per(stats.bought.food)} pacotes/h | garrafões: ${per(stats.bought.water)}/h | remédios: ${per(stats.bought.medicine)}/h`);
console.log(`  cuidados: ${per(stats.cares)}/h | água bebida: ${per(stats.waterDrunk)} doses/h, ganha no foco: ${per(stats.waterFromFocus)}/h | mortes: ${stats.deaths}\n`);

const catalog = (slots) => ITEMS.filter((i) => slots.includes(i.slot)).reduce((sum, i) => sum + i.price, 0);
const cosmetics = catalog(['coat', 'hat', 'face', 'neck', 'theme', 'scene', 'furniture']);
const hoursToAll = cosmetics / net;

check('o jogador atento nunca perde o gatinho', stats.deaths === 0, `${stats.deaths} mortes`);
check('ninguém fica travado sem moedas para o essencial', stats.stuck === 0, `${stats.stuck} vezes`);
check('suprimentos custam entre 5% e 25% da renda', spent / income >= 0.05 && spent / income <= 0.25, `${((spent / income) * 100).toFixed(1)}%`);
check('sobram pelo menos 45 moedas por hora para a loja', net >= 45, net.toFixed(1));
check('a água vem principalmente do trabalho (foco cobre >= 70% do consumo)', stats.waterFromFocus >= 0.7 * stats.waterDrunk, `${stats.waterFromFocus.toFixed(0)} de ${stats.waterDrunk}`);
check('mas dá trabalho: ainda precisa de garrafão de vez em quando', stats.bought.water >= 1);
check('o remédio é raro e caro o bastante para ser notado', stats.bought.medicine >= 5 && stats.bought.medicine / H < 1);
check(`comprar TODO o catálogo de enfeites (${cosmetics} moedas) leva de 40 a 100 horas`, hoursToAll >= 40 && hoursToAll <= 100, `${hoursToAll.toFixed(0)}h`);
check('o item mais barato custa até 1 hora de renda líquida', Math.min(...ITEMS.filter((i) => i.price > 0).map((i) => i.price)) <= net);
check('o item mais caro custa até 3 horas de renda líquida', Math.max(...ITEMS.map((i) => i.price)) <= net * 3);

// dificuldade: relaxado rende menos e custa menos; difícil rende mais
const rel = simulate(40, 'relaxed'), hard = simulate(40, 'hard');
check('relaxado: ninguém morre e a renda é menor que a normal', rel.stats.deaths === 0 && rel.profile.counter('coinsEarned') / 40 < income);
check('difícil: o jogador atento ainda sobrevive e ganha mais por hora', hard.stats.deaths === 0 && hard.profile.counter('coinsEarned') / 40 > income, `${(hard.profile.counter('coinsEarned') / 40).toFixed(1)}/h`);

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
