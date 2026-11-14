/**
 * Testa na página inteira: ciclo dia/noite, luz, cansaço, suprimentos, sujeirinhas, tira de cenários, móveis
 * (arrastar e transformer), missões, hábito e café na pausa, configurações e ranking.
 * O relógio da página é fixado para o teste ser repetível. Requer: pnpm add -D jsdom.
 */
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); } catch { console.log('Instale o jsdom para rodar este teste: pnpm add -D jsdom'); process.exit(0); }
const { JSDOM, VirtualConsole } = jsdom;
const { ready, wait } = require('./page-helpers');

const KEY = 'gatinho-pomodoro:v1';
const DAY_MS = 86400000;
const NOON = new Date(2026, 9, 26, 12, 0).getTime();          // meio-dia local (ciclo "local" = dia)
const FAST_NIGHT = 2400000 * 700000 + 1900000;                // ciclo rápido de 40 min: noite
const FAST_DAY = 2400000 * 700000 + 240000;                   // ciclo rápido de 40 min: dia
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALHA'} ${name}${extra ? ` (${extra})` : ''}`); };
const dayKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Abre o app com um save e um relógio fixo. save = { pet, profile } (mesclados com o mínimo). */
async function open({ now = NOON, pet = {}, profile = {} } = {}) {
  const errors = []; const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (e) => errors.push(String(e)));
  const store = { [KEY]: JSON.stringify({ savedAt: now, pet: { life: { name: 'Mingau', adopted: true, gender: 'm', bornAt: now - 20 * DAY_MS }, ...pet }, profile }) };
  const dom = await JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } });
      w.Date.now = () => now;
    },
  });
  await ready(dom);
  const w = dom.window, d = w.document;
  const svg = d.querySelector('#cat-stage');
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 866, height: 460 }); // escala 1: client = viewBox + (203, 40)
  return { w, d, q: (s) => d.querySelector(s), qa: (s) => [...d.querySelectorAll(s)], errors, svg, saved: () => JSON.parse(store[KEY]), store };
}
const cls = (page) => page.q('#cat-stage').getAttribute('class');
const hit = (page, el, type, x, y, extra = {}) => el.dispatchEvent(new page.w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y, ...extra }));
const key = (page, k, extra = {}) => page.d.dispatchEvent(new page.w.KeyboardEvent('keydown', { key: k, bubbles: true, ...extra }));
const ambient = (cycle, nightMode, extra = {}) => ({ settings: { ambient: { cycle, fastMinutes: 40, nightMode, manualPhase: 'day', lightOn: false, ...extra } } });

(async () => {
  // ================= Painéis na barra e ranking =================
  let p = await open();
  ok('10 painéis na barra, na ordem certa', p.qa('#toolbar [data-panel]').map((b) => b.dataset.panel).join() === 'shop,inventory,missions,history,achievements,cat,ambient,music,ranking,settings');
  p.q('[data-panel="ranking"]').click();
  ok('World Ranking: "em breve", botão desabilitado e seus números', p.q('#panel-title').textContent === 'World Ranking' && p.q('#panel-body').textContent.includes('Em breve') && p.q('#panel-body .btn').disabled && p.q('#panel-body').textContent.includes('Recorde'));
  ok('sem erros ao abrir', p.errors.length === 0, p.errors.join('; '));

  // ================= Noite, dormir a noite inteira e luz =================
  p = await open({ now: FAST_NIGHT, profile: ambient('fast', 'sleep') });
  ok('noite + "dorme a noite inteira": escuro, dormindo e com o interruptor', p.q('.stage').dataset.lights === 'off' && cls(p) === 's-sleep' && !p.q('#light-switch').hidden);
  ok('a janela mostra a noite e o quarto está bem escuro', p.q('#scenery').innerHTML.includes('#f6f2d4') && p.q('#scenery').innerHTML.includes('opacity="0.62"') && p.q('.stage').dataset.tone === 'dark');
  ok('com o ciclo rápido existe a barra de energia', !p.q('[data-need="energy"]').hidden);
  p.q('#light-switch').click();
  ok('acendeu a luz: o gatinho acorda com cara de cansado', cls(p) === 's-tired' && p.q('.stage').dataset.lights === 'on' && p.q('#bubble').textContent === '😴', cls(p));
  ok('luz acesa: o quarto clareia (mas continua noite lá fora)', p.q('#scenery').innerHTML.includes('opacity="0.42"') && p.q('#scenery').innerHTML.includes('#f6f2d4'));
  p.q('#light-switch').click();
  ok('apagou a luz: volta a dormir', cls(p) === 's-sleep' && p.q('.stage').dataset.lights === 'off');
  p.q('[data-panel="ambient"]').click();
  ok('painel Ambiente mostra o ciclo e a escolha da noite', p.q('[data-cycle="fast"]').getAttribute('aria-pressed') === 'true' && p.q('[data-night="sleep"]').getAttribute('aria-pressed') === 'true' && p.q('#panel-body').textContent.includes('Energia'));
  p.q('[data-night="active"]').click();
  ok('"fica ativo": sem escuridão e sem interruptor (eventos aleatórios continuam)', cls(p) !== 's-sleep' && p.q('#light-switch').hidden && p.q('.stage').dataset.lights === 'on');
  p.q('[data-night="sleep"]').click();
  p.q('[data-cycle="manual"]').click();
  ok('ciclo manual: some a energia e aparecem Dia/Noite para escolher', p.q('[data-need="energy"]').hidden && !!p.q('[data-phase="day"]') && !!p.q('[data-phase="night"]'));
  ok('manual guarda a fase em que estava (noite)', p.q('[data-phase="night"]').getAttribute('aria-pressed') === 'true');
  p.q('[data-phase="day"]').click();
  ok('escolhendo "Dia" a janela mostra o sol e some o escuro', p.q('#scenery').innerHTML.includes('#ffd54a') && !p.q('#scenery').innerHTML.includes('fill-rule="evenodd"') && p.q('#light-switch').hidden);
  p.q('[data-phase="night"]').click();
  ok('manual + dorme a noite inteira: escuro e dormindo', cls(p) === 's-sleep' && !p.q('#light-switch').hidden);
  p.q('#light-switch').click();
  ok('manual: sem ciclo não há cansaço, então acender a luz não deixa cansado', cls(p) !== 's-tired' && cls(p) !== 's-sleep', cls(p));
  p.q('[data-cycle="fast"]').click(); p.q('[data-fast="90"]').click();
  ok('ciclo rápido permite escolher a duração do dia (20, 40 ou 90 min)', p.qa('[data-fast]').map((b) => b.dataset.fast).join() === '20,40,90' && p.saved().profile.settings.ambient.fastMinutes === 90);
  ok('as escolhas ficam salvas', p.saved().profile.settings.ambient.cycle === 'fast' && p.saved().profile.settings.ambient.nightMode === 'sleep');
  ok('sem erros no ambiente', p.errors.length === 0, p.errors.join('; '));

  // ================= Cansaço de dia =================
  p = await open({ now: FAST_DAY, pet: { energy: 30 }, profile: ambient('fast', 'active') });
  ok('energia baixa (<40): cara de cansado, mesmo de dia', cls(p) === 's-tired' && p.q('#message').textContent.includes('cansad'), cls(p));
  ok('a barra de energia aparece em alerta', !p.q('[data-need="energy"]').hidden && p.q('[data-need="energy"]').dataset.level === 'warn');
  p = await open({ now: FAST_DAY, pet: { energy: 10, stats: { fun: 30, hunger: 100, thirst: 100, affection: 100, hygiene: 100 } }, profile: ambient('fast', 'active') });
  ok('exausto: a barra fica vermelha', p.q('[data-need="energy"]').dataset.level === 'crit');
  p.q('[data-action="play"]').click();
  ok('exausto não brinca (e explica)', p.q('#message').textContent.includes('cansad') && p.q('#message').textContent.includes('demais'), p.q('#message').textContent);
  p = await open({ now: FAST_DAY, pet: { energy: 10, stats: { fun: 30, hunger: 100, thirst: 100, affection: 100, hygiene: 100 } }, profile: ambient('manual', 'active') });
  ok('sem ciclo (manual) a energia é ignorada: nada de cansaço', cls(p) !== 's-tired' && p.q('[data-need="energy"]').hidden);

  // ================= Suprimentos: ração, água, remédio =================
  const hungry = { stats: { hunger: 20, thirst: 20, fun: 100, affection: 100, hygiene: 100 } };
  p = await open({ pet: hungry, profile: { coins: 30, supplies: { food: 1, water: 0, medicine: 0 } } });
  ok('botões mostram quantas doses restam', p.q('[data-count="feed"]').textContent === '1' && p.q('[data-count="water"]').textContent === '0' && p.q('[data-count="water"]').classList.contains('is-empty') && p.q('[data-count="medicine"]').textContent === '0');
  let sounds = 0;
  p.w.Gatinho.Sound.achievement = () => sounds++;
  p.q('[data-action="feed"]').click();
  ok('dar ração gasta uma dose', p.q('[data-count="feed"]').textContent === '0' && p.q('[data-count="feed"]').classList.contains('is-empty') && p.saved().profile.supplies.food === 0);
  ok('a primeira conquista toca o sininho', sounds >= 1, `${sounds}`);
  p.q('[data-action="feed"]').click();
  ok('sem ração: manda comprar na loja', p.q('#message').textContent.includes('Compre na loja'), p.q('#message').textContent);
  p.q('[data-action="water"]').click();
  ok('sem água: lembra do foco e do garrafão', p.q('#message').textContent.includes('foco') && p.q('#message').textContent.includes('garrafão'), p.q('#message').textContent);
  p.q('[data-panel="shop"]').click(); p.q('[data-slot="supply"]').click();
  ok('loja: 3 suprimentos com o estoque atual', p.qa('.gcard').length === 3 && p.q('#panel-body').textContent.includes('Você tem: 0 / 30'));
  const coinsBefore = Number(p.q('#coins').textContent);
  p.q('[data-buy="supply_food"]').click();
  ok('comprar o pacote de ração: +6 doses e cobra 12', p.saved().profile.supplies.food === 6 && p.q('[data-count="feed"]').textContent === '6' && Number(p.q('#coins').textContent) === coinsBefore - 12, `${coinsBefore} -> ${p.q('#coins').textContent}`);
  p.q('[data-buy="supply_water"]').click();
  ok('garrafão de água: +6 doses', p.saved().profile.supplies.water === 6 && p.q('[data-count="water"]').textContent === '6');
  ok('remédio fica desabilitado sem moedas suficientes', p.q('[data-buy="supply_medicine"]').disabled === (Number(p.q('#coins').textContent) < 15));
  p.q('[data-panel="inventory"]').click(); p.q('[data-slot="supply"]').click();
  ok('inventário mostra o estoque dos suprimentos (sem botões de compra)', p.qa('.gcard').length === 3 && p.qa('[data-buy]').length === 0 && p.q('#panel-body').textContent.includes('Você tem: 6 / 30'));

  // ================= Sujeirinhas =================
  p = await open({ pet: { stats: { hygiene: 100, hunger: 100, thirst: 100, fun: 100, affection: 100 } } });
  ok('higiene boa: o cenário está limpo', p.qa('#scenery .dirt').length === 0);
  p = await open({ pet: { stats: { hygiene: 50, hunger: 100, thirst: 100, fun: 100, affection: 100 } } });
  ok('higiene 50: só 1 sujeirinha', p.qa('#scenery .dirt').length === 1);
  p = await open({ pet: { stats: { hygiene: 20, hunger: 100, thirst: 100, fun: 100, affection: 100 } } });
  ok('higiene 20: 3 sujeirinhas no chão', p.qa('#scenery .dirt').length === 3, `${p.qa('#scenery .dirt').length}`);
  p.q('[data-action="clean"]').click();
  ok('limpar a caixinha tira a sujeira do cenário', p.qa('#scenery .dirt').length === 0, `${p.qa('#scenery .dirt').length}`);

  // ================= Tira de cenários =================
  p = await open({ profile: { coins: 600 } });
  ok('a tira começa só com o Quarto (e sem setinhas)', p.qa('.strip__item').length === 1 && p.qa('[data-strip]').every((a) => a.hidden));
  p.q('[data-panel="shop"]').click(); p.q('[data-slot="scene"]').click();
  ['scene_garden', 'scene_beach', 'scene_dusk', 'scene_snow', 'scene_space'].forEach((id) => p.q(`[data-buy="${id}"]`).click());
  ok('cada cenário comprado vira um quadradinho', p.qa('.strip__item').length === 6);
  const list = p.q('#strip-list');
  const scrolls = [];
  list.scrollBy = (options) => scrolls.push(options);
  Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 500 });
  Object.defineProperty(list, 'clientWidth', { configurable: true, value: 100 });
  list.dispatchEvent(new p.w.Event('scroll'));
  ok('com muitos cenários aparecem as setinhas (a da esquerda desabilitada no começo)', p.qa('[data-strip]').every((a) => !a.hidden) && p.q('[data-strip="-1"]').disabled && !p.q('[data-strip="1"]').disabled);
  p.q('[data-strip="1"]').click();
  ok('a seta rola a tira para o lado', scrolls.length === 1 && scrolls[0].left > 0);
  p.q('[data-scene="scene_beach"]').click();
  ok('clicar no quadradinho troca o cenário na hora', p.q('#scenery').innerHTML.includes('#cfeefb') && p.q('[data-scene="scene_beach"]').getAttribute('aria-pressed') === 'true' && p.saved().profile.equipped.scene === 'scene_beach');
  p.q('[data-scene="scene_room"]').click();
  ok('e volta ao Quarto', p.q('#scenery').innerHTML.includes('var(--stage-sky)'));

  // ================= Móveis: colocar, arrastar, transformer =================
  p = await open({ profile: { coins: 600 } });
  p.q('[data-panel="shop"]').click(); p.q('[data-slot="furniture"]').click();
  ok('loja de móveis: 11 itens', p.qa('.gcard').length === 11, `${p.qa('.gcard').length}`);
  ['fur_plant', 'fur_sofa', 'fur_picture'].forEach((id) => p.q(`[data-buy="${id}"]`).click());
  p.q('[data-panel="inventory"]').click(); p.q('[data-slot="furniture"]').click();
  ok('inventário: os 3 móveis comprados, com "Colocar"', p.qa('.gcard').length === 3 && p.qa('[data-place]').length === 3);
  p.q('[data-place="fur_plant"]').click();
  ok('colocar já liga a edição e seleciona o móvel', p.q('.stage').classList.contains('is-editing') && p.qa('#scenery .fur').length === 1 && !!p.q('#editor .transformer'));
  ok('o botão vira "Guardar"', !!p.q('[data-store="fur_plant"]'));
  ok('transformer: caixa tracejada, 4 cantos e cadeado (tamanho fixo)', !!p.q('#editor .tf-box') && p.qa('#editor .tf-handle').length === 4 && !!p.q('#editor .tf-lock'));
  const box = () => p.q('#editor .tf-box').getAttribute('width') + 'x' + p.q('#editor .tf-box').getAttribute('height');
  const sizeBefore = box();
  const pos = () => p.saved().profile.placements.scene_room.find((e) => e.id === 'fur_plant');
  const start = { ...pos() };
  const fur = () => p.q('#scenery .fur-hit');
  hit(p, fur(), 'pointerdown', start.x + 203, start.y + 40);
  hit(p, fur(), 'pointermove', start.x + 203 + 60, start.y + 40 - 10);
  ok('arrastando, o móvel e o transformer andam juntos na hora', p.q('#scenery .fur').getAttribute('transform') === p.q('#editor .transformer').getAttribute('transform') && p.q('#scenery .fur').getAttribute('transform').startsWith(`translate(${start.x + 60} `));
  hit(p, fur(), 'pointerup', 0, 0);
  ok('soltar salva a nova posição', pos().x === start.x + 60 && pos().y <= start.y && pos().y >= start.y - 10, JSON.stringify([start, pos()]));
  ok('o tamanho do móvel não muda ao mover (fixo)', box() === sizeBefore, `${sizeBefore} -> ${box()}`);
  hit(p, p.q('#editor .tf-handle'), 'pointerdown', 0, 0);
  hit(p, p.q('#editor .tf-handle'), 'pointermove', 400, 400);
  hit(p, p.q('#editor .tf-handle'), 'pointerup', 0, 0);
  ok('arrastar um canto travado não redimensiona nem desmarca', box() === sizeBefore && !!p.q('#editor .transformer') && pos().x === start.x + 60);
  hit(p, fur(), 'pointerdown', pos().x + 203, pos().y + 40);
  hit(p, fur(), 'pointermove', 99999, 99999);
  hit(p, fur(), 'pointerup', 0, 0);
  ok('não dá para arrastar para fora do cenário (limite do chão e da lateral)', pos().x <= p.w.Gatinho.Scenery.BOUNDS.usableMaxX - 28 && pos().y <= 396 && pos().y >= 338, JSON.stringify(pos()));
  const before = pos().x;
  key(p, 'ArrowLeft'); key(p, 'ArrowLeft', { shiftKey: true });
  ok('setas ajustam (4 de cada vez; Shift = 16)', pos().x === before - 4 - 16, `${before} -> ${pos().x}`);
  hit(p, p.q('#cat-stage'), 'pointerdown', 5, 5);
  ok('clicar num lugar vazio desmarca', !p.q('#editor .transformer'));
  hit(p, fur(), 'pointerdown', pos().x + 203, pos().y + 40); hit(p, fur(), 'pointerup', 0, 0);
  key(p, 'Delete');
  ok('Delete guarda o móvel de volta no inventário', p.qa('#scenery .fur').length === 0 && p.saved().profile.placements.scene_room.length === 0 && 'fur_plant' in p.saved().profile.inventory);
  p.q('[data-place="fur_sofa"]').click(); p.q('[data-place="fur_picture"]').click();
  const placed = p.saved().profile.placements.scene_room;
  ok('móveis novos entram em lugares diferentes (e de parede vai na parede)', placed.length === 2 && placed[0].x !== placed[1].x && placed.find((e) => e.id === 'fur_picture').y < 330, JSON.stringify(placed));
  key(p, 'Escape');
  ok('Esc termina a edição e esconde o transformer', !p.q('.stage').classList.contains('is-editing') && !p.q('#editor .transformer'));
  p.q('[data-command="edit"]').click();
  ok('o botão da tira liga a edição de novo', p.q('.stage').classList.contains('is-editing') && p.q('[data-command="edit"]').getAttribute('aria-pressed') === 'true');
  ok('conquista "Lar doce lar" pelo primeiro móvel', !!p.saved().profile.achievements.home_sweet);
  ok('sem erros nos móveis', p.errors.length === 0, p.errors.join('; '));

  // ================= Missões, hábito e café na pausa =================
  const today = dayKey(NOON);
  p = await open({
    pet: { stats: { hygiene: 30, hunger: 100, thirst: 100, fun: 100, affection: 100 } },
    profile: { daily: { date: today, ids: ['clean_1', 'break_1', 'habit_2'], counters: {}, done: {}, bonus: false } },
  });
  p.q('[data-panel="missions"]').click();
  ok('painel de missões: as 3 de hoje, nenhuma pronta', p.qa('#panel-body .ach').length === 3 && p.qa('#panel-body .ach--done').length === 0 && p.q('#panel-body').textContent.includes('0 / 3'));
  p.q('[data-action="clean"]').click();
  ok('limpar a caixinha cumpre a missão e avisa', p.qa('#panel-body .ach--done').length === 1 && p.q('#message').textContent.includes('🎯'), p.q('#message').textContent);
  ok('a missão pagou a recompensa (6 moedas + 6 do cuidado urgente)', Number(p.q('#coins').textContent) >= 12, p.q('#coins').textContent);
  p.q('[data-panel="missions"]').click();
  p = await open({ profile: { daily: { date: today, ids: ['clean_1', 'break_1', 'habit_2'], counters: {}, done: {}, bonus: false } } }); // página limpa: sem animação de cuidado em andamento
  p.q('[data-preset="3"]').click();
  ok('pausa: o gatinho toma café', cls(p) === 's-coffee', cls(p));
  ok('pausa: aparece um hábito saudável com botão', !p.q('#habit').hidden && p.q('#habit-text').textContent.length > 8, p.q('#habit-text').textContent);
  const coinsB = Number(p.q('#coins').textContent);
  p.q('[data-command="habit"]').click();
  ok('"Fiz!": +3 moedas e o hábito some', Number(p.q('#coins').textContent) === coinsB + 3 && p.q('#habit').hidden && p.saved().profile.counters.habits === 1, `${coinsB} -> ${p.q('#coins').textContent}`);
  p.q('[data-command="cancel"]').click();
  ok('cancelar a pausa volta ao normal', cls(p) !== 's-coffee' && p.q('#habit').hidden);
  p.q('[data-preset="1"]').click();
  ok('foco comum não mostra hábito nem café', p.q('#habit').hidden && cls(p) !== 's-coffee');

  // ================= Configurações =================
  p = await open({ profile: { coins: 5 } });
  p.q('[data-panel="settings"]').click();
  ok('notificações ficam desabilitadas se o sistema não suporta', p.q('#set-notify').disabled);
  p.q('#set-sound').checked = false; p.q('#set-sound').dispatchEvent(new p.w.Event('change', { bubbles: true }));
  ok('desligar o som fica salvo e muda o volume efetivo', p.saved().profile.settings.sound === false && p.w.Gatinho.Sound.enabled === false);
  p.q('#set-volume').value = '35'; p.q('#set-volume').dispatchEvent(new p.w.Event('input', { bubbles: true }));
  ok('o volume é salvo sem redesenhar o painel (não atrapalha o arrasto)', p.saved().profile.settings.soundVolume === 35 && p.q('#set-volume') !== null);
  let tested = 0; p.w.Gatinho.Sound.achievement = () => tested++;
  p.q('#set-test').click();
  ok('"Testar" toca o som da conquista', tested === 1);
  p.q('[data-difficulty="relaxed"]').click();
  ok('dificuldade relaxada fica salva e explica', p.saved().profile.settings.difficulty === 'relaxed' && p.q('#panel-body').textContent.includes('não morre'));
  p.q('[data-difficulty="hard"]').click();
  ok('dificuldade difícil', p.saved().profile.settings.difficulty === 'hard' && p.q('[data-difficulty="hard"]').getAttribute('aria-pressed') === 'true');
  let exported = null;
  p.w.Gatinho.Backup.download = (text, name) => { exported = { text, name }; };
  const coinsNow = () => Number(p.q('#coins').textContent); // 5 + a conquista "Primeira semana" (o gatinho tem 20 dias), paga na 1ª checagem
  p.q('#set-export').click();
  const coinsAtExport = coinsNow();
  ok('exportar gera o arquivo com o progresso e a data no nome', exported && JSON.parse(exported.text).app === 'gatinho-pomodoro' && JSON.parse(exported.text).data.profile.coins === coinsAtExport && /^gatinho-backup-\d{4}-\d{2}-\d{2}\.json$/.test(exported.name), exported?.name);
  Object.defineProperty(p.q('#set-import'), 'files', { configurable: true, value: [{ text: async () => 'isso não é um backup' }] });
  p.q('#set-import').dispatchEvent(new p.w.Event('change', { bubbles: true }));
  await wait(50);
  ok('importar um arquivo ruim avisa e NÃO apaga nada', p.q('.note').textContent.includes('JSON inválido') && p.saved().profile.coins === coinsNow());
  ok('sem erros nas configurações', p.errors.length === 0, p.errors.join('; '));

  console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
  process.exit(fails ? 1 : 0);
})();
