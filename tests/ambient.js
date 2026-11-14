/**
 * Testa ambiente (dia/noite, sono, luz), energia (cansaço), dificuldade, suprimentos, móveis,
 * missões e hábitos. Uso: node tests/ambient.js
 */
const fs = require('fs');
const path = require('path');
global.window = global;
global.localStorage = { getItem() {}, setItem() {} };
for (const file of ['random', 'config', 'html', 'life', 'ambient', 'pet', 'profile', '../data/items', '../data/missions', '../data/habits', 'achievements', '../data/achievements', 'care', 'missions']) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`).replace('js/../', ''), 'utf8'));
}
const { Ambient, Pet, Profile, Care, Missions, CONFIG } = Gatinho;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}
function seed(value) { let s = value; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
seed(5);
const MIN = 60000;
const at = (h, m = 0, d = 5) => new Date(2026, 9, d, h, m).getTime();
const settings = (over = {}) => ({ ...CONFIG.ambient.defaults, ...over });
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ================= Ambiente =================
let a = new Ambient(settings({ cycle: 'manual', manualPhase: 'night' }));
check('manual: a fase é a escolhida, sem olhar o relógio', a.isNight(at(12)) && !new Ambient(settings({ cycle: 'manual', manualPhase: 'day' })).isNight(at(3)));
a = new Ambient(settings({ cycle: 'local' }));
check('local: segue o horário do computador (21h–6h)', !a.isNight(at(20, 59)) && a.isNight(at(21)) && a.isNight(at(5, 59)) && !a.isNight(at(6)));
a = new Ambient(settings({ cycle: 'fast', fastMinutes: 40 }));
check('rápido: 62% do ciclo é dia (24,8 de 40 min)', !a.isNight(0) && !a.isNight(24 * MIN) && a.isNight(25 * MIN) && a.isNight(39 * MIN) && !a.isNight(40 * MIN));
check('rápido: o ciclo se repete', a.isNight(65 * MIN) && !a.isNight(80 * MIN + 1));
check('minutos do dia e da noite', near(a.minutes().day, 24.8, 0.01) && near(a.minutes().night, 15.2, 0.01) && new Ambient(settings()).minutes().night === 540 && new Ambient(settings()).minutes().day === 900);
check('cansaço só existe com ciclo (rápido ou local)', a.fatigueEnabled && new Ambient(settings()).fatigueEnabled && !new Ambient(settings({ cycle: 'manual' })).fatigueEnabled);

a = new Ambient(settings({ cycle: 'manual', manualPhase: 'night', nightMode: 'sleep' }));
check('dorme a noite inteira: dorme e fica escuro', a.sleeping() && a.lightsOff());
a.toggleLight();
check('luz acesa: segue "dormindo" (cansado), mas não está escuro', a.sleeping() && !a.lightsOff() && a.lightOn);
check('modo ativo: não dorme e nunca fica escuro', !new Ambient(settings({ cycle: 'manual', manualPhase: 'night', nightMode: 'active' })).sleeping());
check('de dia não dorme, mesmo no modo "dorme a noite inteira"', !new Ambient(settings({ cycle: 'manual', manualPhase: 'day', nightMode: 'sleep' })).sleeping());

a = new Ambient(settings({ cycle: 'fast', fastMinutes: 40, nightMode: 'sleep', lightOn: true }));
check('primeira checagem não conta como mudança', a.sync(0) === false);
check('de dia a luz não é mexida', a.sync(10 * MIN) === false && a.lightOn === true);
check('toda noite nova começa de luz apagada', a.sync(26 * MIN) === true && a.lightOn === false);
a.toggleLight();
check('dentro da mesma noite a luz acesa continua', a.sync(30 * MIN) === false && a.lightOn === true);
check('amanhecer muda a fase sem mexer na luz', a.sync(41 * MIN) === true);

a = new Ambient(settings({ cycle: 'fast' }));
check('trocar para manual fica na fase atual', a.setCycle('manual', 30 * MIN) && a.settings.manualPhase === 'night' && a.phase(0) === 'night');
check('só no manual dá para escolher dia/noite', a.setManualPhase('day') && !new Ambient(settings()).setManualPhase('night'));
check('escolher noite no manual apaga a luz', (() => { const b = new Ambient(settings({ cycle: 'manual', lightOn: true })); b.setManualPhase('night'); return b.lightOn === false; })());
check('valores inválidos são recusados', !a.setCycle('x') && !a.setNightMode('x') && !a.setFastMinutes(7) && a.setFastMinutes(90) && a.setNightMode('sleep'));
check('environment() entrega o que o gatinho precisa', (() => { const e = new Ambient(settings({ cycle: 'fast', nightMode: 'sleep' })).environment(26 * MIN); return e.night && e.sleeping && e.fatigue && e.nightMinutes > 0; })());

// ================= Energia =================
const DAY = 86400000;
const petWith = (env, energy = 100) => {
  const p = new Pet({ energy, life: { name: 'T', adopted: true, personality: 'neutral', bornAt: at(12) - 10 * DAY } }, { now: () => at(12) });
  p.environment = () => env;
  p.secondsToEvent = 1e9;
  return p;
};
const run = (p, minutes, opts) => { for (let i = 0; i < minutes * 60; i++) p.tick(1, opts); };
const fast = { fatigue: true, dayMinutes: 24.8, nightMinutes: 15.2 };
const dayEnv = { ...fast, night: false, sleeping: false, lightOn: true };
const nightSleep = { ...fast, night: true, sleeping: true, lightOn: false };
const keepFed = (p) => { for (const k of Object.keys(p.stats)) p.stats[k] = 100; };

let p = petWith(dayEnv);
run(p, 24.8);
check('um dia inteiro acordado gasta ~55 de energia', near(100 - p.energy, CONFIG.energy.dayLoss, 1.2), `${(100 - p.energy).toFixed(1)}`);
p = petWith(nightSleep, 40);
run(p, CONFIG.energy.sleepFraction * 15.2 + 0.2);
check('dormindo no escuro, recupera tudo em 60% da noite', p.energy >= 99.5, p.energy.toFixed(1));
p = petWith({ ...nightSleep, lightOn: true }, 100);
run(p, 5);
check('dormindo com a luz acesa, cansa 1,5x mais rápido e não recupera', near(100 - p.energy, (55 / 24.8) * 5 * 1.5, 0.6), `${(100 - p.energy).toFixed(1)}`);
const sleepRate = 100 / (15.2 * 0.6);
p = petWith({ ...fast, night: true, sleeping: false, lightOn: false }, 20);
run(p, 3);
check('ativo à noite, descansa à metade da velocidade do sono', near(p.energy - 20, sleepRate * 0.5 * 3, 0.6), `${(p.energy - 20).toFixed(1)}`);
p = petWith({ fatigue: false, night: false, sleeping: false, lightOn: true, dayMinutes: 900, nightMinutes: 540 }, 30);
run(p, 1);
check('sem ciclo (manual) não há cansaço: energia volta a 100', p.energy === 100);
p = petWith(dayEnv, 50);
run(p, 5, { onBreak: true });
check('pausa do pomodoro descansa (+2/min além do desgaste do dia)', near(p.energy - 50, 5 * (2 - 55 / 24.8), 0.6), `${(p.energy - 50).toFixed(1)}`);
check('energia nunca passa de 0 a 100', (() => { const q = petWith(dayEnv, 1); run(q, 30); const r = petWith(nightSleep, 99); run(r, 20); return q.energy === 0 && r.energy === 100; })());

// efeitos do cansaço
const drop = (energy) => { const q = petWith(dayEnv, energy); keepFed(q); for (let i = 0; i < 1200; i++) { q.energy = energy; q.tick(1); } return 100 - q.stats.hunger; };
check('exausto (<15): as barras descem 1,15x mais rápido', near(drop(10) / drop(60), CONFIG.energy.exhaustedDecay, 0.06), `${(drop(10) / drop(60)).toFixed(2)}`);
p = petWith(dayEnv, 24); p.stats.fun = 50;
check('exausto demais (<25): não brinca', !p.care('play').ok && p.care('play').message.includes('cansad') && p.energy === 24);
p.energy = 26;
check('com 26 de energia ainda brinca', p.care('play').ok);
check('cansado ainda pode comer', (() => { const q = petWith(dayEnv, 5); q.stats.hunger = 30; return q.care('feed').ok; })());
check('tired / exhausted refletem os limites', petWith(dayEnv, 39).tired && !petWith(dayEnv, 41).tired && petWith(dayEnv, 14).exhausted && !petWith(dayEnv, 16).exhausted);

// sono suspende eventos
let events = 0;
p = petWith(nightSleep, 80); p.addEventListener('event', () => events++);
p.secondsToEvent = 1; run(p, 1 / 6);
check('dormindo a noite inteira não tem eventos aleatórios', events === 0);
p = petWith({ ...nightSleep, sleeping: false }, 80); p.addEventListener('event', () => events++);
p.stats = Object.fromEntries(Object.keys(p.stats).map((k) => [k, 100]));
p.secondsToEvent = 1; run(p, 1 / 6);
check('ativo à noite os eventos continuam', events === 1);
check('energia é salva e reviver devolve 100', (() => { const q = new Pet(JSON.parse(JSON.stringify(petWith(dayEnv, 33))), { now: () => at(12) }); const ok = q.energy === 33; q.revive(); return ok && q.energy === 100; })());

// ================= Dificuldade =================
const D = CONFIG.difficulty;
p = petWith(dayEnv); p.rules = D.relaxed; for (const k of Object.keys(p.stats)) p.stats[k] = 0.5;
run(p, 5);
check('relaxado: nunca morre de descuido (barras param em 1)', p.alive && Object.values(p.stats).every((v) => v >= 1));
p = petWith(dayEnv); p.rules = D.relaxed; p.sickSeconds = 0; run(p, CONFIG.illness.deathMinutes + 5);
check('relaxado: nem de doença', p.alive && p.sick);
p = petWith(dayEnv); p.rules = D.normal; for (const k of Object.keys(p.stats)) p.stats[k] = 0.5;
run(p, 2);
check('normal: morre se descuidar', !p.alive);
const rate = (rules) => { const q = petWith(dayEnv); q.rules = rules; run(q, 10); return 100 - q.stats.hunger; };
check('relaxado desce 0,65x e difícil 1,35x', near(rate(D.relaxed) / rate(D.normal), 0.65, 0.05) && near(rate(D.hard) / rate(D.normal), 1.35, 0.06));
p = petWith(dayEnv); p.rules = D.relaxed;
check('pontos seguem a dificuldade (foco, bônus e cuidado)', p.addFocusMinutes(25) === 35 && p.addPoints(10) === 7 && (p.stats.hunger = 30, p.care('feed').points === Math.round(10 * 2 * 0.7)));
p = petWith(dayEnv); p.rules = D.hard;
check('difícil dá 1,4x pontos', p.addFocusMinutes(25) === 70);

// ================= Suprimentos e cuidado =================
let profile = new Profile();
p = petWith({ ...dayEnv, fatigue: false });
check('começa com 6 rações, 6 águas e 1 remédio', profile.supplyCount('food') === 6 && profile.supplyCount('water') === 6 && profile.supplyCount('medicine') === 1);
p.stats.hunger = 30;
let r = Care.perform('feed', { pet: p, profile });
check('dar ração gasta 1 dose, sobe a barra e não rende moedas', r.ok && profile.supplyCount('food') === 5 && p.stats.hunger === 75 && r.coins === 0 && profile.coins === 0);
r = Care.perform('feed', { pet: p, profile });
check('barra cheia o bastante: recusa SEM gastar ração', !r.ok && profile.supplyCount('food') === 5);
profile.supplies.food = 0; p.stats.hunger = 20;
r = Care.perform('feed', { pet: p, profile });
check('sem ração: avisa para comprar e não muda nada', !r.ok && r.message.includes('Compre na loja') && p.stats.hunger === 20);
check('água acabou: avisa que o foco ou o garrafão resolvem', (() => { profile.supplies.water = 0; p.stats.thirst = 20; return Care.perform('water', { pet: p, profile }).message.includes('foco'); })());
check('remédio sem doença não gasta', (() => Care.perform('medicine', { pet: p, profile }).ok === false && profile.supplyCount('medicine') === 1)());
p.sickSeconds = 0;
r = Care.perform('medicine', { pet: p, profile });
check('remédio cura, gasta a dose e não rende moedas', r.ok && !p.sick && profile.supplyCount('medicine') === 0 && r.coins === 0);
p.sickSeconds = 0;
check('sem remédio guardado: avisa', Care.perform('medicine', { pet: p, profile }).message.includes('Sem remédio'));
p.stats.fun = 30;
r = Care.perform('play', { pet: p, profile });
check('brincar é grátis e rende moedas (urgente: 6)', r.ok && r.coins === 6 && profile.coins === 6);

profile = new Profile();
profile.recordFocus({ task: 'a', minutes: 25 }, at(10));
check('foco rende água: 1 dose a cada 20 min (25 min = +1,25)', near(profile.supplies.water, 7.25, 0.001) && profile.supplyCount('water') === 7);
profile.supplies.water = 9.9; profile.recordFocus({ task: 'a', minutes: 25 }, at(11));
check('o reservatório de água tem limite (10)', profile.supplies.water === 10);
const sup = (id) => Gatinho.ITEMS.find((i) => i.id === id);
profile = new Profile(); profile.coins = 30; profile.supplies.food = 0;
check('comprar ração: paga, soma 6 doses e conta', profile.buy(sup('supply_food')).ok && profile.supplyCount('food') === 6 && profile.coins === 18 && profile.counter('suppliesBought') === 1 && profile.counter('coinsSpent') === 12);
check('pode comprar de novo (consumível)', profile.buy(sup('supply_food')).ok && profile.supplyCount('food') === 12);
check('sem moedas: recusa e diz quanto falta', (() => { profile.coins = 5; const x = profile.buy(sup('supply_food')); return !x.ok && x.reason.includes('Faltam 7'); })());
check('estoque cheio: recusa e NÃO cobra', (() => { profile.coins = 100; profile.supplies.food = 26; const x = profile.buy(sup('supply_food')); return !x.ok && profile.coins === 100 && x.reason.includes('cheio'); })());
check('compra de suprimento não vira "item do inventário"', !profile.owns('supply_food') && profile.counter('purchases') === 0);
check('suprimentos e configurações são salvos', (() => { const q = new Profile(JSON.parse(JSON.stringify(profile))); return q.supplies.food === profile.supplies.food && q.settings.ambient.cycle === 'local'; })());
check('save antigo (sem suprimentos) recebe os iniciais', (() => { const old = JSON.parse(JSON.stringify(new Profile())); delete old.supplies; delete old.settings.ambient; const q = new Profile(old); return q.supplyCount('food') === 6 && q.settings.ambient.nightMode === 'active'; })());
check('dificuldade muda as moedas de foco e cuidado (não as de conquista)', (() => { const q = new Profile(); q.settings.difficulty = 'relaxed'; const f = q.recordFocus({ task: 'a', minutes: 25 }, at(10)).coins; const c = q.recordCare('play', { urgent: false }); const h = q.recordHabit(at(10)); return f === 20 && c === Math.round(3 * 0.8) && h === Math.round(3 * 0.8); })());

// ================= Móveis =================
profile = new Profile(); profile.coins = 500;
check('só coloca móvel que você tem', !profile.place('scene_room', 'fur_sofa', 10, 380).ok);
profile.buy(sup('fur_sofa')); profile.buy(sup('fur_lamp'));
check('coloca e guarda posição', profile.place('scene_room', 'fur_sofa', 10, 380).ok && profile.placed('scene_room')[0].x === 10);
check('colocar de novo só muda a posição (sem duplicar nem contar de novo)', profile.place('scene_room', 'fur_sofa', 50, 370).ok && profile.placed('scene_room').length === 1 && profile.placed('scene_room')[0].x === 50 && profile.counter('furniturePlaced') === 1);
check('cada cenário tem seus móveis', profile.place('scene_beach', 'fur_sofa', 0, 380).ok && profile.placed('scene_room').length === 1 && profile.placed('scene_beach').length === 1 && profile.counter('furniturePlaced') === 2);
check('guardar tira do cenário e mantém o móvel no inventário', profile.store('scene_room', 'fur_sofa').ok && profile.placed('scene_room').length === 0 && profile.owns('fur_sofa') && !profile.store('scene_room', 'fur_sofa').ok);
check('móveis são salvos', new Profile(JSON.parse(JSON.stringify(profile))).placed('scene_beach')[0].id === 'fur_sofa');

// ================= Missões =================
profile = new Profile();
check('vira o dia e sorteia 3 missões diferentes', profile.rollDay(at(8)) && profile.daily.ids.length === 3 && new Set(profile.daily.ids).size === 3);
check('no mesmo dia não sorteia de novo', !profile.rollDay(at(20)));
profile.daily.ids = ['focus_2', 'water_2', 'pet_3'];
profile.recordFocus({ task: 'a', minutes: 25 }, at(9));
check('contadores do dia acompanham as ações', profile.dailyCounter('focusSessions') === 1 && profile.dailyCounter('focusMinutes') === 25);
let m = Missions.check(profile, at(9));
check('missão ainda incompleta não paga', m.done.length === 0 && m.bonus === 0);
profile.recordFocus({ task: 'a', minutes: 25 }, at(10));
const before = profile.coins;
m = Missions.check(profile, at(10));
check('missão cumprida paga a recompensa uma vez', m.done.map((x) => x.id).join() === 'focus_2' && profile.coins - before === 10 && Missions.check(profile, at(10)).done.length === 0);
profile.recordCare('water', { urgent: false }, at(11)); profile.recordCare('water', { urgent: false }, at(11));
for (let i = 0; i < 3; i++) profile.recordCare('pet', { urgent: false }, at(11));
const b2 = profile.coins;
m = Missions.check(profile, at(11));
check('fazer as 3 dá o bônus (e só uma vez)', m.done.length === 2 && m.bonus === CONFIG.missions.bonusCoins && profile.coins - b2 === 6 + 8 + 10 && Missions.check(profile, at(11)).bonus === 0);
check('dia perfeito vira conquista contável', profile.counter('allMissionsDays') === 1 && profile.counter('missionsDone') === 3);
check('no dia seguinte: missões novas e contadores do dia zerados', profile.rollDay(at(9, 0, 6)) && profile.dailyCounter('focusSessions') === 0 && profile.counter('focusSessions') === 2);
check('missão de pausa: contador de pausas', (() => { const q = new Profile(); q.recordBreak(at(10)); return q.counter('breaksTaken') === 1 && q.dailyCounter('breaksTaken') === 1; })());
check('hábitos: moedas e contador, e a lista é válida', (() => { const q = new Profile(); const c = q.recordHabit(at(10)); return c === 3 && q.counter('habits') === 1 && Gatinho.HABITS.length >= 5 && Gatinho.HABITS.every((h) => h.id && h.icon && h.text); })());
check('missões bem formadas (contadores existem na lista de conquistas ou nas ações)', Gatinho.MISSIONS.every((x) => x.id && x.title && x.target > 0 && x.coins > 0 && x.counter) && new Set(Gatinho.MISSIONS.map((x) => x.id)).size === Gatinho.MISSIONS.length);

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
