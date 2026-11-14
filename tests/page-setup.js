/** Testa a tela de escolha de gênero e nome. Requer: pnpm add -D jsdom (ou npm i -D jsdom). */
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); } catch { console.log('Instale o jsdom para rodar este teste: pnpm add -D jsdom'); process.exit(0); }
const { JSDOM, VirtualConsole } = jsdom;
const { ready } = require('./page-helpers');
const KEY = 'gatinho-pomodoro:v1';
const DAY = 86400000;
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALHA'} ${name}${extra ? ` (${extra})` : ''}`); };

/** Abre a página com um save inicial (ou nenhum) e devolve { w, d, q, store, errors }. */
function open(save) {
  const errors = []; const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (e) => errors.push(String(e)));
  const store = save ? { [KEY]: JSON.stringify(save) } : {};
  return JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } }); },
  }).then(async (dom) => {
    await ready(dom);
    const w = dom.window, d = w.document;
    return { w, d, q: (s) => d.querySelector(s), store, errors, saved: () => JSON.parse(store[KEY]) };
  });
}
const type = (w, el, value) => { el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); };

(async () => {
  // ---- 1) Jogo novo ----
  let { w, d, q, store, errors, saved } = await open(null);
  ok('jogo novo: a tela de escolha aparece', !q('#setup').hidden && q('#setup-title').textContent.includes('Adote'));
  ok('começar está desabilitado (falta gênero e nome)', q('#setup-go').disabled);
  q('#setup [data-gender="f"]').click();
  ok('só gênero: ainda desabilitado', q('#setup-go').disabled && q('#setup [data-gender="f"]').getAttribute('aria-pressed') === 'true');
  q('#setup-dice').click();
  ok('dado sugere nome feminino e habilita', ['Pipoca', 'Mel', 'Luna', 'Fofura', 'Pituca', 'Mia', 'Nina', 'Princesa'].includes(q('#setup-name').value) && !q('#setup-go').disabled, q('#setup-name').value);
  type(w, q('#setup-name'), '   ');
  ok('nome em branco desabilita de novo', q('#setup-go').disabled);
  type(w, q('#setup-name'), 'Bia');
  ok('cancelar não existe no primeiro uso', q('#setup-cancel').hidden);
  q('#setup-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  ok('confirmar fecha a tela', q('#setup').hidden);
  ok('cabeçalho mostra o nome e o gênero', q('#cat-name').textContent === 'Bia' && q('#cat-name').dataset.gender === 'f');
  ok('textos concordam com o gênero', q('#message').textContent.includes('Bia chegou') && q('#message').textContent.includes('dela'), q('#message').textContent);
  ok('save guarda adoção, nome e gênero', saved().pet.life.adopted === true && saved().pet.life.gender === 'f' && saved().pet.life.name === 'Bia');
  ok('sem erros de execução', errors.length === 0, errors.join('; '));

  // ---- 2) Jogador antigo (save sem adoção) ----
  ({ w, d, q, errors } = await open({ pet: { life: { name: 'Mingau', bornAt: Date.now() - 30 * DAY } }, profile: { coins: 80 } }));
  ok('jogador antigo: a tela aparece com o nome atual', !q('#setup').hidden && q('#setup-name').value === 'Mingau');
  ok('mas o gênero precisa ser escolhido', q('#setup-go').disabled);
  q('#setup [data-gender="m"]').click();
  ok('escolhendo o gênero habilita', !q('#setup-go').disabled);
  q('#setup-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  ok('mantém a idade e o progresso', q('#setup').hidden && Number(q('#coins').textContent) >= 80 && q('#cat-name').title.includes('Adulto'), q('#cat-name').title);

  // ---- 3) Reviver depois da morte ----
  const dead = { pet: { alive: false, life: { name: 'Tigre', adopted: true, gender: 'm', bornAt: Date.now() - 12 * DAY } }, profile: {} };
  ({ w, d, q, saved, errors } = await open(dead));
  ok('morto: o botão de reviver aparece (masculino)', !q('[data-command="revive"]').hidden && q('[data-command="revive"]').textContent.includes('Reviver o gatinho'), q('[data-command="revive"]').textContent);
  ok('morto: não abre a tela sozinho', q('#setup').hidden);
  q('[data-command="revive"]').click();
  ok('reviver abre a escolha com tudo preenchido', !q('#setup').hidden && q('#setup-name').value === 'Tigre' && !q('#setup-go').disabled && q('#setup-go').textContent === 'Reviver');
  ok('reviver pode ser cancelado', !q('#setup-cancel').hidden);
  q('#setup-cancel').click();
  ok('cancelar mantém o gatinho morto', q('#setup').hidden && q('[data-command="revive"]').hidden === false);
  q('[data-command="revive"]').click();
  q('#setup [data-gender="f"]').click(); type(w, q('#setup-name'), 'Nina');
  q('#setup-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  const life = saved().pet.life;
  ok('renasce como filhote com o novo nome e gênero', saved().pet.alive === true && life.name === 'Nina' && life.gender === 'f' && Date.now() - life.bornAt < 60000);
  ok('botão de reviver some depois de renascer', q('[data-command="revive"]').hidden);
  ok('conquista Fênix', !!saved().profile.achievements?.phoenix);
  ok('sem erros de execução', errors.length === 0, errors.join('; '));

  console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
  process.exit(fails ? 1 : 0);
})();
