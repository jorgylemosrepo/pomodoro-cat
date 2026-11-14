/**
 * Simula horas de jogo em segundos e confere se os eventos aleatórios estão estáveis.
 * Uso: node tests/simulate.js
 * Não precisa instalar nada. O sorteio usa uma semente fixa, então o resultado é reproduzível.
 */
const fs = require('fs');
const path = require('path');
global.window = global;
global.localStorage = { getItem() {}, setItem() {} };
for (const file of ['random', 'config', 'life', 'pet']) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', file + '.js'), 'utf8'));
}
const { Pet, CONFIG } = Gatinho;

// Meio-dia, gatinho adulto e sem personalidade: o ritmo das barras fica exatamente o da config.
const NOON = new Date(2026, 9, 5, 12, 0).getTime();
const newPet = () => new Pet({ life: { name: 'Teste', adopted: true, bornAt: NOON - 10 * 86400000, personality: 'neutral' } }, { now: () => NOON });

function seed(value) {
  let state = value;
  Math.random = () => (state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

const careFor = Object.fromEntries(Object.entries(CONFIG.actions).filter(([, action]) => action.need).map(([key, action]) => [action.need, key]));

/** Jogador atento: cuida de cada necessidade de 0 a maxDelay segundos depois que ela aparece. */
function playHours(hours, maxDelay) {
  const pet = newPet();
  const result = { deaths: 0, cares: 0, events: [], eventsByNeed: {}, angryEvents: 0, sickEvents: 0, cures: 0 };
  const waiting = {};
  let now = 0;

  pet.addEventListener('died', () => { result.deaths++; pet.revive(); });
  pet.addEventListener('event', ({ detail }) => {
    result.events.push(now);
    if (detail.type === 'sick') { result.sickEvents++; return; }
    result.eventsByNeed[detail.need] = (result.eventsByNeed[detail.need] || 0) + 1;
    if (pet.stats[detail.need] < CONFIG.angryThreshold) result.angryEvents++;
  });

  for (now = 1; now <= hours * 3600; now++) {
    pet.tick(1);
    for (const [need, value] of Object.entries(pet.stats)) {
      if (value < CONFIG.needThreshold && waiting[need] === undefined) waiting[need] = now + Math.random() * maxDelay;
      if (waiting[need] !== undefined && now >= waiting[need]) {
        if (pet.care(careFor[need]).ok) result.cares++;
        waiting[need] = undefined;
      }
    }
    // doente: o jogador atento dá o remédio depois do mesmo tempo de reação
    if (pet.sick && waiting.sick === undefined) waiting.sick = now + Math.random() * maxDelay;
    if (waiting.sick !== undefined && now >= waiting.sick) {
      if (pet.care('medicine').ok) result.cures++;
      waiting.sick = undefined;
    }
  }
  return result;
}

/**
 * Sem nenhum cuidado: minutos até uma barra pedir ajuda e ficar brava.
 * Usa o modo offline do tick (sem eventos e sem morte) para medir cada barra isoladamente.
 */
function neglectMinutes(need) {
  const pet = newPet();
  const marks = { need: null, angry: null };
  for (let t = 1; marks.angry === null; t++) {
    pet.tick(1, { offline: true });
    if (marks.need === null && pet.stats[need] < CONFIG.needThreshold) marks.need = t / 60;
    if (pet.stats[need] < CONFIG.angryThreshold) marks.angry = t / 60;
  }
  return marks;
}

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}

// 1) Eventos aleatórios com jogador atento
seed(7);
const hours = 300;
const r = playHours(hours, 300);
const gaps = r.events.slice(1).map((t, i) => t - r.events[i]);
const { minSeconds, maxSeconds } = CONFIG.randomEvent;
const perHour = r.events.length / hours;
const counts = Object.values(r.eventsByNeed);
const spread = Math.max(...counts) / Math.min(...counts);

console.log(`\n${hours}h simuladas | eventos/hora: ${perHour.toFixed(1)} (doenças: ${(r.sickEvents / hours).toFixed(2)}/h, curadas: ${r.cures}) | cuidados/hora: ${(r.cares / hours).toFixed(1)}`);
console.log('eventos por necessidade:', r.eventsByNeed, '\n');
check('nenhum intervalo menor que o mínimo', Math.min(...gaps) >= minSeconds - 2, `mínimo ${Math.round(Math.min(...gaps))}s`);
check('intervalo médio dentro da faixa configurada', gaps.reduce((a, b) => a + b) / gaps.length <= maxSeconds * 1.5, `média ${Math.round(gaps.reduce((a, b) => a + b) / gaps.length)}s`);
check('eventos não deixam o gatinho bravo na hora', r.angryEvents === 0, `${r.angryEvents}`);
check('jogador atento nunca perde o gatinho', r.deaths === 0, `${r.deaths} mortes`);
check('doenças acontecem e o jogador atento cura todas', r.sickEvents > 0 && r.cures === r.sickEvents, `${r.cures}/${r.sickEvents}`);
check('todas as necessidades recebem eventos', counts.length === Object.keys(CONFIG.needs).length);
check('distribuição razoavelmente equilibrada', spread < 2.5, `maior/menor = ${spread.toFixed(2)}`);

// 2) Descuido total: estabilidade do tempo até cada marco (30 repetições por necessidade)
console.log('\nSem cuidar de nada (minutos até: pedir ajuda / ficar bravo), média e variação em 30 execuções:');
for (const [need, info] of Object.entries(CONFIG.needs)) {
  const runs = [];
  for (let i = 0; i < 30; i++) { seed(100 + i); runs.push(neglectMinutes(need)); }
  const avg = (key) => runs.reduce((a, m) => a + m[key], 0) / runs.length;
  const range = (key) => Math.max(...runs.map((m) => m[key])) - Math.min(...runs.map((m) => m[key]));
  const expected = info.minutesToEmpty * (1 - CONFIG.needThreshold / 100);
  console.log(`  ${need.padEnd(9)} pede ajuda em ${avg('need').toFixed(1)} min (esperado ${expected.toFixed(1)}, variação ${range('need').toFixed(2)}) | fica bravo em ${avg('angry').toFixed(1)} min`);
  check(`${need}: tempo até pedir ajuda bate com a config`, Math.abs(avg('need') - expected) < 1);
}

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
