/** Teste da página inteira num navegador simulado. Requer: pnpm add -D jsdom (ou npm i -D jsdom). */
const path = require('path');
const { whenReady } = require('./page-helpers');
let jsdom;
try { jsdom = require('jsdom'); } catch { console.log('Instale o jsdom para rodar este teste: pnpm add -D jsdom'); process.exit(0); }
const { JSDOM, VirtualConsole } = jsdom;
const errors = []; const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (e) => errors.push(String(e)));
const KEY = 'gatinho-pomodoro:v1';
const DAY = 86400000;
const fixedNoon = new Date(); fixedNoon.setHours(12, 0, 0, 0);
const store = { [KEY]: JSON.stringify({ savedAt: Date.now() - 2000,
  pet: { life: { name: 'Mingau', adopted: true, gender: 'f', bornAt: Date.now() - 2 * DAY, personality: 'clingy' }, sickSeconds: 100, stats: { hunger: 80, thirst: 80, fun: 80, affection: 80, hygiene: 80 } },
  profile: { coins: 50, graveyard: [{ name: 'Tigre', days: 9, score: 40, cause: 'descuido', at: Date.now() - DAY }] } }) };
let fails = 0;
const ok = (n, c, x = '') => { if (!c) fails++; console.log((c ? 'OK   ' : 'FALHA') + ' ' + n + (x ? ` (${x})` : '')); };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } }); } }).then((dom) => {
  const w = dom.window, d = w.document, q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
  whenReady(dom, () => {
    ok('nome do gatinho no cabeçalho', q('#cat-name').textContent === 'Mingau' && q('#cat-name').title.includes('Filhote'), q('#cat-name').title);
    ok('filhote é menor (escala no SVG)', q('#cat-wrap').getAttribute('transform').includes('scale(0.82)'));
    ok('5 necessidades + energia (escondida com o ciclo desligado) + aviso de doença', qa('.need[data-need]').length === 6 && !q('#sick-chip').hidden);
    ok('doente: cena sick e balão', q('#cat-stage').getAttribute('class') === 's-sick' && q('#bubble').textContent === '🤒', q('#cat-stage').getAttribute('class'));
    ok('botão de remédio aparece só doente', !q('[data-action="medicine"]').hidden);
    ok('6 botões de cuidado no DOM', qa('[data-action]').length === 6);
    ok('10 painéis na barra', qa('#toolbar [data-panel]').map((b) => b.dataset.panel).join() === 'shop,inventory,missions,history,achievements,cat,ambient,music,ranking,settings');
    ok('o palco sabe se é dia ou noite', ['day', 'night'].includes(q('.stage').dataset.time), q('.stage').dataset.time);
    q('[data-action="medicine"]').click();
    ok('remédio cura: some o aviso e o botão', q('#sick-chip').hidden && q('[data-action="medicine"]').hidden);
    ok('conquista Enfermeiro desbloqueada', JSON.parse(store[KEY]).profile.achievements.nurse > 0);
    ok('saiu da cena doente', q('#cat-stage').getAttribute('class') !== 's-sick', q('#cat-stage').getAttribute('class'));
    q('[data-action="clean"]').click();
    ok('limpar: recusa com a caixinha em 80', q('#message').textContent.includes('limpinho'), q('#message').textContent);
    q('[data-panel="cat"]').click();
    ok('painel Gatinho abre embaixo (palco visível)', !q('#panel').hidden && !q('#panel').classList.contains('panel--full') && q('#panel-title').textContent === 'Gatinho');
    ok('painel mostra fase, personalidade e cemitério', q('#panel-body').textContent.includes('Filhote') && q('#panel-body').textContent.includes('Dengoso') && q('#panel-body').textContent.includes('Tigre'));
    const input = q('#cat-name-input'); input.value = '  Rei <b>Leão</b> '; input.dispatchEvent(new w.Event('change', { bubbles: true }));
    ok('renomear: cabeçalho e save', q('#cat-name').textContent === 'Rei <b>Leão</b>'.slice(0, 14) && JSON.parse(store[KEY]).pet.life.name === 'Rei <b>Leão</b'.slice(0, 14), q('#cat-name').textContent);
    ok('nome é escapado no painel (sem HTML injetado)', !qa('#panel-body b').some((b) => b.textContent.includes('Leão')) && q('#cat-name-input').value === 'Rei <b>Leão</b');
    input.value = '   '; input.dispatchEvent(new w.Event('change', { bubbles: true }));
    ok('nome vazio recusado', q('.note').textContent.includes('Digite um nome'));
    q('[data-panel="cat"]').click();
    const saved = JSON.parse(store[KEY]);
    ok('save guarda doença curada e vida', saved.pet.sickSeconds === null && saved.pet.life.personality === 'clingy');
    console.log('\nerros de execução:', errors.length ? errors : 'nenhum');
    console.log(fails ? `${fails} falha(s)` : 'Tudo certo');
    process.exit(fails || errors.length ? 1 : 0);
  });
});
