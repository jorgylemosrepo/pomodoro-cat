/** Teste da página inteira num navegador simulado. Requer: pnpm add -D jsdom (ou npm i -D jsdom). */
const path = require('path');
const { whenReady } = require('./page-helpers');
let jsdom;
try { jsdom = require('jsdom'); } catch { console.log('Instale o jsdom para rodar este teste: pnpm add -D jsdom'); process.exit(0); }
const { JSDOM, VirtualConsole } = jsdom;
const errors = []; const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (e) => errors.push(String(e)));
const KEY = 'gatinho-pomodoro:v1';
const store = { [KEY]: JSON.stringify({ savedAt: Date.now() - 2000, profile: { coins: 180 } }) };
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log((cond ? 'OK   ' : 'FALHA') + ' ' + name + (extra ? ` (${extra})` : '')); };
JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } });
  },
}).then((dom) => {
  const w = dom.window, d = w.document, q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
  const cat = q('#cat-stage');
  whenReady(dom, () => {
    ok('10 painéis na barra', qa('#toolbar [data-panel]').map((b) => b.dataset.panel).join() === 'shop,inventory,missions,history,achievements,cat,ambient,music,ranking,settings');
    ok('cor padrão aplicada', cat.style.getPropertyValue('--coat') === '#fff6e3');

    q('[data-panel="shop"]').click();
    ok('loja abre em modo peek (palco visível)', !q('#panel').hidden && !q('#panel').classList.contains('panel--full'));
    ok('loja mostra 6 cores', qa('.gcard').length === 6, qa('.gcard').length);
    ok('cor padrão aparece como comprada', qa('.gcard')[0].textContent.includes('Comprado'));
    const buyBtn = (id) => q(`[data-buy="${id}"]`);
    ok('cor cara (200) desabilitada com 180 moedas', buyBtn('coat_gold').disabled);
    buyBtn('coat_orange').click();
    ok('compra: aviso e moedas atualizadas', q('.note').textContent.includes('Comprou Laranja') && q('#coins').textContent === '135', q('#coins').textContent + ' (180 − 60 + 15 da conquista)');
    ok('botão vira Comprado', !q('[data-buy="coat_orange"]'));
    q('[data-slot="hat"]').click();
    ok('aba chapéus: 5 itens', qa('.gcard').length === 5);
    ok('pré-visualização SVG do item', q('.gcard svg.preview path, .gcard svg.preview rect, .gcard svg.preview g') !== null);
    ok('coroa (150) desabilitada com 135 moedas', buyBtn('hat_crown').disabled);
    buyBtn('hat_bow').click();
    ok('compra laço (40): saldo 95', q('#coins').textContent === '95', q('#coins').textContent);

    q('[data-panel="inventory"]').click();
    ok('trocou de painel (só um aberto)', q('#panel-title').textContent === 'Inventário' && qa('#toolbar [aria-pressed="true"]').length === 1);
    ok('inventário: abas por encaixe', qa('[data-slot]').length === 8);
    q('[data-slot="coat"]').click();
    ok('inventário lista cores que tenho (2)', qa('.gcard').length === 2, qa('.gcard').length);
    q('[data-equip="coat_orange"]').click();
    ok('gatinho muda de cor ao equipar', cat.style.getPropertyValue('--coat') === '#f6b26b');
    ok('cor em uso fica marcada', q('.gcard--on') !== null && q('.gcard--on').textContent.includes('Em uso'));
    q('[data-slot="hat"]').click();
    ok('inventário de chapéus mostra só o laço', qa('.gcard').length === 1);
    q('[data-equip="hat_bow"]').click();
    ok('chapéu aparece no gatinho', q('#slot-hat').children.length > 0);
    ok('botão vira Tirar', q('[data-unequip="hat"]') !== null);
    q('[data-unequip="hat"]').click();
    ok('tirar remove do gatinho', q('#slot-hat').children.length === 0);

    q('[data-panel="inventory"]').click();
    ok('clicar de novo fecha o inventário', q('#panel').hidden);

    const saved = JSON.parse(store[KEY]).profile;
    ok('save: inventário e equipado', saved.inventory.coat_orange > 0 && saved.equipped.coat === 'coat_orange', JSON.stringify(saved.equipped));
    ok('save: contadores de compra', saved.counters.purchases >= 1 && saved.counters.coinsSpent >= 60);
    ok('conquistas de compra desbloqueadas', ['first_purchase', 'new_look'].every((id) => saved.achievements[id]), Object.keys(saved.achievements).join());
    console.log('\nerros de execução:', errors.length ? errors : 'nenhum');
    console.log(fails ? `${fails} falha(s)` : 'Tudo certo');
    process.exit(fails || errors.length ? 1 : 0);
  });
});
