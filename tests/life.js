/**
 * Testa a vida do gatinho: fases, personalidade, dia/noite, doença, remédio, higiene,
 * cemitério e eventos raros. Uso: node tests/life.js
 */
const fs = require('fs');
const path = require('path');
global.window = global;
global.localStorage = { getItem() {}, setItem() {} };
for (const file of ['random', 'config', 'html', 'life', 'pet', 'profile', '../data/rare-events', '../data/missions']) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`).replace('js/../', ''), 'utf8'));
}
const { Life, Pet, Profile, CONFIG, RARE_EVENTS, random } = Gatinho;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}
function seed(value) {
  let state = value;
  Math.random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}
const DAY = 86400000;
const at = (hour, minute = 0) => new Date(2026, 9, 5, hour, minute).getTime(); // 5/out/2026
const NOON = at(12);
const petAt = (ageDays, personality = 'neutral', now = NOON) =>
  new Pet({ life: { name: 'Teste', adopted: true, bornAt: now - ageDays * DAY, personality } }, { now: () => now });
seed(1);

// ---- Fases e idade ----
const life = new Life({ name: 'A', bornAt: NOON - 3 * DAY, personality: 'neutral' });
check('3 dias = filhote', life.stage(NOON).id === 'kitten' && life.ageDays(NOON) === 3);
check('próxima fase em 4 dias', life.nextStage(NOON).inDays === 4 && life.nextStage(NOON).stage.id === 'adult');
check('10 dias = adulto', new Life({ bornAt: NOON - 10 * DAY }).stage(NOON).id === 'adult');
check('70 dias = idoso e sem próxima fase', new Life({ bornAt: NOON - 70 * DAY }).stage(NOON).id === 'senior' && new Life({ bornAt: NOON - 70 * DAY }).nextStage(NOON) === null);

// ---- Ritmo das barras ----
const adult = (personality) => new Life({ bornAt: NOON - 10 * DAY, personality });
check('adulto neutro: ritmo normal', adult('neutral').decayMultiplier('hunger', NOON) === 1);
check('filhote gasta 15% mais rápido', Math.abs(life.decayMultiplier('hunger', NOON) - 1.15) < 1e-9);
check('personalidade muda só a barra dela', adult('playful').decayMultiplier('fun', NOON) === 1.4 && adult('playful').decayMultiplier('thirst', NOON) === 1);
check('à noite as barras descem mais devagar', Math.abs(adult('neutral').decayMultiplier('hunger', at(23)) - CONFIG.life.night.decay) < 1e-9);

// ---- Dia e noite ----
check('20:59 é dia, 21:00 é noite', !Life.isNight(at(20, 59)) && Life.isNight(at(21)));
check('05:59 é noite, 06:00 é dia', Life.isNight(at(5, 59)) && !Life.isNight(at(6)));
check('meio-dia e meia-noite', !Life.isNight(NOON) && Life.isNight(at(0)));

// ---- Nome e renascimento ----
const named = new Life({ name: 'X', bornAt: NOON });
check('renomear apara espaços e limita o tamanho', named.rename('  Rei   Leão do Sofá Grande  ').ok && named.name === 'Rei Leão do So' && named.name.length <= CONFIG.life.maxNameLength);
check('nome vazio é recusado', !named.rename('   ').ok && named.name === 'Rei Leão do So');
named.rebirth(NOON + DAY);
check('renascer: idade zera e nome fica', named.ageDays(NOON + DAY) === 0 && named.name === 'Rei Leão do So');
check('sorteia nome e personalidade válidos', (() => { const l = new Life(); return [...CONFIG.life.names.m, ...CONFIG.life.names.f].includes(l.name) && l.personality in CONFIG.life.personalities; })());

// ---- Gênero, adoção e textos ----
check('nome sorteado respeita o gênero', CONFIG.life.names.f.includes(new Life({ gender: 'f' }).name) && CONFIG.life.names.m.includes(new Life({ gender: 'm' }).name));
check('textos no masculino', Life.speak('{Ele} é {um} {gatinho} {novo}, cuide d{ele}. {O} {gatinho}!', 'm') === 'Ele é um gatinho novo, cuide dele. O gatinho!');
check('textos no feminino', Life.speak('{Ele} é {um} {gatinho} {novo}, cuide d{ele}. {O} {gatinho}!', 'f') === 'Ela é uma gatinha nova, cuide dela. A gatinha!');
check('palavra desconhecida fica como está', Life.speak('{xyz} ok', 'f') === '{xyz} ok');
check('mensagens da config e dos eventos raros só usam tokens conhecidos', (() => {
  const texts = [CONFIG.illness.message, ...Object.values(CONFIG.needs).flatMap((n) => [n.message, n.event]), CONFIG.angryMessage];
  texts.push(...RARE_EVENTS.map((e) => e.run({ pet: petAt(10), profile: new Profile(), random, CONFIG })));
  return texts.every((t) => !/\{\w+\}/.test(Life.speak(t, 'f')) && !/\{\w+\}/.test(Life.speak(t, 'm')));
})());
const fresh = new Life({ name: 'X', bornAt: NOON });
check('começa sem adoção (tela de escolha pendente)', fresh.adopted === false);
check('adotar exige gênero válido', !fresh.adopt({ name: 'Bia', gender: 'x' }).ok && !fresh.adopt({ name: 'Bia', gender: null }).ok && !fresh.adopted);
check('adotar exige nome', !fresh.adopt({ name: '  ', gender: 'f' }).ok && !fresh.adopted);
check('adotar guarda nome, gênero e libera o jogo', fresh.adopt({ name: ' Bia ', gender: 'f' }).ok && fresh.name === 'Bia' && fresh.gender === 'f' && fresh.adopted);
check('renascer mantém o gênero', (() => { fresh.rebirth(NOON); return fresh.gender === 'f' && fresh.adopted; })());
const waiting = new Pet({ life: { name: 'W', bornAt: NOON - 10 * DAY } }, { now: () => NOON });
waiting.tick(3600);
check('antes da adoção o tempo não passa para o gatinho', Object.values(waiting.stats).every((v) => v === 100) && waiting.alive);
check('gênero e adoção são salvos', (() => { const q = new Life(JSON.parse(JSON.stringify(fresh))); return q.gender === 'f' && q.adopted; })());

// ---- Higiene ----
check('higiene é uma necessidade', 'hygiene' in CONFIG.needs && 'hygiene' in petAt(10).stats);
let pet = petAt(10); pet.stats.hygiene = 20;
let r = pet.care('clean');
check('limpar a caixinha sobe a barra e pontua em dobro (urgente)', r.ok && pet.stats.hygiene === 80 && r.points === CONFIG.actions.clean.points * CONFIG.urgentMultiplier);
check('limpa demais: recusa', !pet.care('clean').ok && (pet.stats.hygiene = 100, !pet.care('clean').ok));

// ---- Doença ----
pet = petAt(10);
check('remédio sem doença é recusado', !pet.care('medicine').ok && pet.score === 0);
const dropAfter = (sick) => { const p = petAt(10); if (sick) p.sickSeconds = 0; for (let t = 0; t < 600; t++) p.tick(1); return 100 - p.stats.hunger; };
const healthyDrop = dropAfter(false), sickDrop = dropAfter(true);
check('doente: barras descem 1,4x mais rápido', Math.abs(sickDrop / healthyDrop - CONFIG.illness.decayMultiplier) < 0.1, `${sickDrop.toFixed(1)} vs ${healthyDrop.toFixed(1)}`);
pet = petAt(10); pet.sickSeconds = 0;
r = pet.care('medicine');
check('remédio cura, pontua e conta como urgente', r.ok && !pet.sick && r.points === CONFIG.actions.medicine.points && r.urgent);

let deaths = [];
pet = petAt(10); pet.addEventListener('died', (e) => deaths.push(e.detail));
pet.sickSeconds = 0;
for (let t = 0; t < CONFIG.illness.deathMinutes * 60 - 2; t++) pet.stats.hunger = 100, pet.stats.thirst = 100, pet.stats.fun = 100, pet.stats.affection = 100, pet.stats.hygiene = 100, pet.tick(1);
check('doente quase 40 min ainda está vivo', pet.alive && deaths.length === 0);
for (let t = 0; t < 5; t++) pet.tick(1);
check('sem remédio ele morre de doença', !pet.alive && deaths[0]?.cause === 'doença' && deaths[0].name === 'Teste', JSON.stringify(deaths[0]));

pet = petAt(10); pet.sickSeconds = 0; pet.tick(5 * 3600, { offline: true });
check('offline não mata nem de doença (fica a 1 min do limite)', pet.alive && pet.sickSeconds === CONFIG.illness.deathMinutes * 60 - 60);

// chance de doença maior com higiene baixa (estatístico)
function sickRate(hygiene, trials = 6000) {
  let sick = 0;
  for (let i = 0; i < trials; i++) { const p = petAt(10); p.stats.hygiene = hygiene; p._triggerEvent(); if (p.sick) sick++; }
  return sick / trials;
}
const clean = sickRate(100), dirty = sickRate(10);
check('higiene baixa triplica a chance de doença', dirty / clean > 2.2 && dirty / clean < 3.8, `${(clean * 100).toFixed(1)}% -> ${(dirty * 100).toFixed(1)}%`);
check('chance base de doença bate com a config', Math.abs(clean - CONFIG.illness.chancePerEvent) < 0.02, `${(clean * 100).toFixed(1)}%`);

// ---- Morte, cemitério e renascimento ----
pet = petAt(12, 'glutton'); pet.score = 120;
let grave; pet.addEventListener('died', (e) => (grave = e.detail));
pet.die('descuido');
check('morte informa nome, dias e pontuação', grave.name === 'Teste' && grave.days === 12 && grave.score === 120 && pet.score === 0);
const profile = new Profile(); profile.recordDeath(grave, NOON);
check('cemitério e recorde de dias', profile.graveyard[0].name === 'Teste' && profile.counter('bestLifeDays') === 12 && profile.counter('deaths') === 1);
pet.revive();
check('reviver = filhote novo, saudável e com tudo cheio', pet.alive && !pet.sick && pet.life.stage(NOON).id === 'kitten' && Object.values(pet.stats).every((v) => v === 100));
check('salva e carrega (inclui doença e vida)', (() => { const p = petAt(5); p.sickSeconds = 30; const q = new Pet(JSON.parse(JSON.stringify(p)), { now: () => NOON }); return q.sickSeconds === 30 && q.life.name === 'Teste' && q.life.ageDays(NOON) === 5; })());

// ---- Eventos raros ----
check('eventos raros bem formados', RARE_EVENTS.every((e) => e.id && e.weight > 0 && e.scene && e.ms > 0 && typeof e.run === 'function'));
pet = petAt(10); pet.stats.fun = 50; pet.stats.affection = 90;
const ctx = { pet, profile: new Profile(), random, CONFIG };
const messages = RARE_EVENTS.map((e) => e.run(ctx));
check('cada evento raro retorna uma mensagem', messages.every((m) => typeof m === 'string' && m.length > 5));
check('presente dá moedas, zoomies diverte, ciúmes e soneca mexem no carinho', ctx.profile.coins > 0 && pet.stats.fun === 80 && pet.stats.affection <= 100);
const counts = {}; seed(9);
for (let i = 0; i < 8000; i++) { const e = random.pickWeighted(RARE_EVENTS); counts[e.id] = (counts[e.id] || 0) + 1; }
check('sorteio com pesos respeita as proporções', Math.abs(counts.gift / counts.jealous - 1.5) < 0.2, JSON.stringify(counts));

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
