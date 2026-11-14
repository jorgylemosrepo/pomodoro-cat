/** Testa tema da janela (global, inclui o palco) e cenários. Requer: pnpm add -D jsdom (ou npm i -D jsdom). */
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); } catch { console.log('Instale o jsdom para rodar este teste: pnpm add -D jsdom'); process.exit(0); }
const { JSDOM, VirtualConsole } = jsdom;
const { ready } = require('./page-helpers');
const KEY = 'gatinho-pomodoro:v1';
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALHA'} ${name}${extra ? ` (${extra})` : ''}`); };

(async () => {
  const errors = []; const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (e) => errors.push(String(e)));
  const store = { [KEY]: JSON.stringify({ pet: { life: { name: 'Mingau', adopted: true, gender: 'm', bornAt: Date.now() - 20 * 86400000 } }, profile: { coins: 1000 } }) };
  const themeCalls = [];
  const dom = await JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } });
      w.desktop = { setWindowTheme: (t) => themeCalls.push(t) };
    },
  });
  await ready(dom);
  const d = dom.window.document, q = (s) => d.querySelector(s), qa = (s) => [...d.querySelectorAll(s)];
  const app = q('#app').style, html = d.documentElement.style;
  const night = q('.stage').dataset.time === 'night'; // de noite o palco é escuro em qualquer cenário claro
  const lightTone = night ? 'dark' : 'light';

  ok('começa com o tema da janela avisando o Electron', themeCalls.length > 0 && themeCalls.at(-1).scheme === 'system');
  q('[data-panel="shop"]').click();
  ok('loja tem as abas Temas, Cenários, Móveis e Suprimentos', qa('[data-slot]').map((b) => b.textContent).join() === 'Cores,Chapéus,Rosto,Pescoço,Temas,Cenários,Móveis,Suprimentos');

  // ---- Cenários (desenhados em SVG atrás do gatinho) ----
  const scenery = () => q('#scenery').innerHTML;
  q('[data-slot="scene"]').click();
  ok('loja lista os 6 cenários', qa('.gcard').length === 6, qa('.gcard').length);
  q('[data-buy="scene_garden"]').click(); q('[data-buy="scene_space"]').click();
  ok('cenário padrão (Quarto) acompanha o tema da janela', scenery().includes('var(--stage-sky)') && scenery().includes('id="sc-win"'));
  ok('a janela tem montanhas', scenery().includes('#9bb4d4') || scenery().includes('#2c3b66'));
  q('[data-panel="inventory"]').click(); q('[data-slot="scene"]').click();
  ok('inventário: cenário padrão + 2 comprados', qa('.gcard').length === 3);
  q('[data-equip="scene_garden"]').click();
  ok('Jardim: troca a parede e o chão', scenery().includes('#d8f0c8') && scenery().includes('#9bcf8d') && !scenery().includes('var(--stage-sky)'));
  ok('Jardim: a janela mostra colinas', scenery().includes('#8fd18a') || scenery().includes('#1b3f35'));
  ok(`Jardim é claro de dia (agora é ${night ? 'noite' : 'dia'})`, q('.stage').dataset.tone === lightTone);
  q('[data-equip="scene_space"]').click();
  ok('Espaço: palco escuro (textos claros e gatinho com contorno)', q('.stage').dataset.tone === 'dark' && scenery().includes('#c47ad9'));
  ok('tira de cenários marca o cenário atual', q('[data-scene="scene_space"]').getAttribute('aria-pressed') === 'true' && qa('.strip__item').length === 3);
  q('[data-equip="scene_room"]').click();
  ok('voltar ao Quarto devolve as cores do tema', scenery().includes('var(--stage-sky)'));
  ok('o cenário não mexe no SVG do gatinho (ele não muda de cor)', !q('#cat-stage').style.getPropertyValue('--scene-sky'));

  // ---- Tema global da janela ----
  q('[data-panel="shop"]').click(); q('[data-slot="theme"]').click();
  q('[data-buy="theme_night"]').click();
  q('[data-panel="inventory"]').click(); q('[data-slot="theme"]').click();
  q('[data-equip="theme_night"]').click();
  ok('tema escuro pinta a interface E o palco', app.getPropertyValue('--bg') === '#14172b' && app.getPropertyValue('--stage-sky') === '#1f2447' && app.getPropertyValue('--stage-floor') === '#2c3260');
  ok('tema vale para o <html> inteiro e define o esquema escuro', html.getPropertyValue('--bg') === '#14172b' && html.colorScheme === 'dark');
  ok('palco acompanha o tema escuro', q('.stage').dataset.tone === 'dark');
  ok('avisa o Electron (esquema escuro e cor do fundo)', themeCalls.at(-1).scheme === 'dark' && (!themeCalls.at(-1).background || themeCalls.at(-1).background === '#14172b'), JSON.stringify(themeCalls.at(-1)));
  q('[data-equip="theme_default"]').click();
  ok('tema padrão: limpa tudo e volta a seguir o sistema', !app.getPropertyValue('--bg') && !app.getPropertyValue('--stage-sky') && html.colorScheme === '' && themeCalls.at(-1).scheme === 'system');

  // ---- Persistência e conquistas ----
  const saved = JSON.parse(store[KEY]).profile;
  ok('save guarda tema e cenário', saved.equipped.theme === 'theme_default' && saved.equipped.scene === 'scene_room' && saved.counters.themeChanges === 2 && saved.counters.sceneChanges === 3);
  ok('conquistas Decorador e Diretor de cena', !!saved.achievements.decorator && !!saved.achievements.stage_manager);
  ok('sem erros de execução', errors.length === 0, errors.join('; '));
  console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
  process.exit(fails ? 1 : 0);
})();
