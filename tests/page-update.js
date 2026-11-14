/**
 * Testa o botão 🔄 e o painel de Atualizações na página inteira, com um GitHub simulado e uma ponte
 * "window.desktop" de mentira. Requer: pnpm add -D jsdom (ou npm i -D jsdom).
 */
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); } catch { console.log('Instale o jsdom para rodar este teste: pnpm add -D jsdom'); process.exit(0); }
const { JSDOM, VirtualConsole } = jsdom;
const { ready, wait } = require('./page-helpers');

const KEY = 'gatinho-pomodoro:v1';
const DAY = 86400000;
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALHA'} ${name}${extra ? ` (${extra})` : ''}`); };
async function waitFor(condition, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (condition()) return true; await wait(25); }
  return false;
}

const ASSETS = ['G-1.2.0-win-x64-Setup.exe', 'G-1.2.0-win-x64-Portable.exe', 'G-1.2.0-linux-x86_64.AppImage', 'G-1.2.0-linux-amd64.deb', 'G-1.2.0-linux-x86_64.rpm']
  .map((name) => ({ name, browser_download_url: `https://github.com/dono/projeto/releases/download/v1.2.0/${name}`, size: 1 }));
const RELEASE = (tag = 'v1.2.0') => ({ status: 200, json: { tag_name: tag, html_url: `https://github.com/dono/projeto/releases/tag/${tag}`, body: '## Novidades\n- cenários novos\n- correções', published_at: '2026-10-26T12:00:00Z', assets: ASSETS } });

/** GitHub de mentira: routes = { sufixo da URL: { status, json } | () => Error }. Anota as chamadas. */
function github(routes) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    const route = typeof routes[key] === 'function' ? routes[key]() : routes[key];
    if (route instanceof Error) throw route;
    return { ok: route.status < 300, status: route.status, json: async () => route.json ?? {} };
  };
  fn.calls = calls;
  return fn;
}

/** Abre o app. info = ponte do desktop (ou null = navegador). */
async function open({ update = {}, info = null, fetchImpl = github({}), bridge = {} } = {}) {
  const errors = []; const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (e) => errors.push(String(e)));
  const store = { [KEY]: JSON.stringify({ savedAt: Date.now(), pet: { life: { name: 'Mingau', adopted: true, gender: 'm', bornAt: Date.now() - 20 * DAY } }, profile: { settings: { update } } }) };
  const calls = { open: [], relaunch: 0, pull: 0 };
  const dom = await JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } });
      w.fetch = fetchImpl;
      if (info) {
        w.desktop = {
          appInfo: info, legacySave: null, setWindowTheme() {}, saveMirror() {},
          openUpdateUrl: async (url, repo) => { calls.open.push([url, repo]); return true; },
          gitPull: async () => { calls.pull++; return bridge.pull ?? { ok: true, output: 'Updating abc..def\n 3 files changed' }; },
          relaunch: async () => { calls.relaunch++; },
        };
      }
    },
  });
  await ready(dom);
  const d = dom.window.document;
  const page = { w: dom.window, d, q: (s) => d.querySelector(s), qa: (s) => [...d.querySelectorAll(s)], errors, calls, fetch: fetchImpl, saved: () => JSON.parse(store[KEY]) };
  page.status = () => page.q('.update__status')?.textContent ?? '';
  page.openPanel = () => page.q('header [data-panel="update"]').click();
  page.setRepo = (text) => { page.q('#up-repo').value = text; page.q('#up-save').click(); };
  page.check = async () => { page.q('#up-check').click(); await waitFor(() => page.status() && !page.status().includes('Consultando')); };
  return page;
}
const INFO = (over = {}) => ({ version: '1.0.0', kind: 'win-installer', platform: 'win32', arch: 'x64', repository: '', canGitPull: false, ...over });

(async () => {
  // ================= Navegador (sem o app de desktop) =================
  let p = await open();
  ok('o botão 🔄 está no cabeçalho, sem selo', !!p.q('header [data-panel="update"]') && p.q('header [data-panel="update"] .badge').hidden);
  ok('no navegador o botão de fixar continua aparecendo (no desktop some)', !p.q('[data-command="pin"]').hidden);
  p.openPanel();
  ok('o painel abre com a versão do app e o tipo', p.q('#panel-title').textContent === 'Atualizações' && p.q('#panel-body .row span').textContent === '1.0.0' && p.q('#panel-body').textContent.includes('Navegador'));
  ok('sem repositório: explica e não deixa verificar', p.q('#up-check').disabled && p.q('#panel-body').textContent.includes('Informe o repositório'));
  ok('verificação automática começa ligada', p.q('#up-auto').checked && p.saved().profile.settings.update.auto !== false);
  ok('o botão de atualização não aparece na barra lateral de painéis (só no cabeçalho)', p.qa('#toolbar [data-panel]').length === 10 && !p.q('#toolbar [data-panel="update"]'));
  p.openPanel();
  ok('clicar de novo no 🔄 fecha o painel', p.q('#panel').hidden);

  // ================= App de desktop instalado: repositório, verificação, download =================
  const gh = github({ '/releases/latest': RELEASE() });
  p = await open({ info: INFO(), fetchImpl: gh });
  ok('no app de desktop o botão de fixar some (a janela já fica no topo)', p.q('[data-command="pin"]').hidden);
  p.openPanel();
  ok('mostra o tipo da instalação', p.q('#panel-body').textContent.includes('Instalado (Windows)'));
  p.setRepo('isso não é um repo');
  ok('repositório inválido: avisa e não salva', p.q('.note').textContent.includes('usuario/repositorio') && !p.saved().profile.settings.update.repo);
  p.setRepo('https://github.com/dono/projeto.git');
  ok('repositório válido: aceita a URL inteira e guarda só usuario/repositorio', p.q('.note').textContent.includes('salvo') && p.q('#up-repo').value === 'dono/projeto' && p.saved().profile.settings.update.repo === 'dono/projeto');
  ok('com repositório o botão de verificar liga', !p.q('#up-check').disabled && p.q('#panel-body').textContent.includes('dono/projeto'));
  await p.check();
  ok('versão nova: aviso em destaque e as notas da versão', p.status() === 'Nova versão 1.2.0 disponível!' && p.q('.update__status--available') && p.q('.update__notes').textContent.includes('cenários novos'));
  ok('mostra o botão do arquivo CERTO para este sistema (instalador do Windows)', p.q('[data-url$="Setup.exe"]') && p.q('.update__buttons').textContent.includes('Baixar G-1.2.0-win-x64-Setup.exe') && !p.q('[data-url$="Portable.exe"]'));
  ok('o 🔄 ganha um selo "!"', !p.q('header [data-panel="update"] .badge').hidden && p.q('header [data-panel="update"] .badge').textContent === '!');
  ok('a última consulta fica guardada', p.saved().profile.settings.update.latest.version === '1.2.0' && p.saved().profile.settings.update.lastCheck > 0);
  p.q('[data-url$="Setup.exe"]').click();
  ok('baixar abre o arquivo no navegador do sistema, validando o repositório', p.calls.open.length === 1 && p.calls.open[0][0].endsWith('/v1.2.0/G-1.2.0-win-x64-Setup.exe') && p.calls.open[0][1] === 'dono/projeto', JSON.stringify(p.calls.open));
  p.qa('.update__buttons .btn').find((b) => b.textContent.includes('página')).click();
  ok('"Abrir a página da versão" abre a página da release', p.calls.open[1][0].endsWith('/releases/tag/v1.2.0'));
  ok('sem erros de execução', p.errors.length === 0, p.errors.join('; '));

  // ================= Já está na versão mais nova / erros =================
  p = await open({ info: INFO(), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': RELEASE('v1.0.0') }) });
  p.openPanel(); await p.check();
  ok('mesma versão: "versão mais nova", em verde, sem selo e sem cartão de download', p.status().includes('mais nova') && !!p.q('.update__status--uptodate') && !p.q('.update__release') && p.q('header [data-panel="update"] .badge').hidden);
  p = await open({ info: INFO(), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': () => new Error('rede') }) });
  p.openPanel(); await p.check();
  ok('sem internet: avisa em vermelho e não quebra', p.status().includes('Sem conexão') && !!p.q('.update__status--error') && p.q('header [data-panel="update"] .badge').hidden);
  p = await open({ info: INFO(), update: { repo: 'nao/existe', auto: false }, fetchImpl: github({ '/releases/latest': { status: 404 }, '/repos/nao/existe': { status: 404 } }) });
  p.openPanel(); await p.check();
  ok('repositório que não existe: explica', p.status().includes('Não encontrei'));
  p = await open({ info: INFO(), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': { status: 404 }, '/repos/dono/projeto': { status: 200, json: { default_branch: 'main', html_url: 'https://github.com/dono/projeto' } }, '/main/package.json': { status: 200, json: { version: '1.5.0' } } }) });
  p.openPanel(); await p.check();
  ok('repositório sem releases: usa o package.json e manda baixar pela página (não há arquivo)', p.status().includes('1.5.0') && p.q('.update__release').textContent.includes('não tem releases') && !p.q('[data-url$=".exe"]') && !!p.q('[data-url="https://github.com/dono/projeto"]'));

  // ================= Verificação automática, 1x por dia =================
  let g = github({ '/releases/latest': RELEASE() });
  p = await open({ info: INFO(), update: { repo: 'dono/projeto', auto: true, lastCheck: 0 }, fetchImpl: g });
  await waitFor(() => !p.q('header [data-panel="update"] .badge').hidden);
  ok('ao abrir, se faz mais de um dia, consulta sozinho (uma vez) e avisa', g.calls.length === 1 && p.q('#message').textContent.includes('Nova versão 1.2.0') && !p.q('header [data-panel="update"] .badge').hidden, `${g.calls.length} consultas`);
  ok('e guarda quando consultou', Date.now() - p.saved().profile.settings.update.lastCheck < 20000);
  g = github({ '/releases/latest': RELEASE() });
  p = await open({ info: INFO(), update: { repo: 'dono/projeto', auto: true, lastCheck: Date.now() - 3600000 }, fetchImpl: g });
  await wait(300);
  ok('consultou há 1 hora: não consulta de novo', g.calls.length === 0);
  g = github({ '/releases/latest': RELEASE() });
  p = await open({ info: INFO(), update: { repo: 'dono/projeto', auto: true, lastCheck: Date.now() - 3600000, latest: { version: '1.2.0', url: 'u', notes: '', assets: [] } }, fetchImpl: g });
  ok('a versão nova da última consulta continua avisada com o selo, sem nova consulta', !p.q('header [data-panel="update"] .badge').hidden && g.calls.length === 0);
  g = github({ '/releases/latest': RELEASE() });
  p = await open({ info: INFO(), update: { repo: 'dono/projeto', auto: false, lastCheck: 0 }, fetchImpl: g });
  await wait(300);
  ok('automático desligado: nunca consulta sozinho', g.calls.length === 0);
  g = github({ '/releases/latest': RELEASE() });
  p = await open({ info: INFO(), update: { auto: true, lastCheck: 0 }, fetchImpl: g });
  await wait(300);
  ok('sem repositório: nada é consultado', g.calls.length === 0);
  p.openPanel(); p.q('#up-auto').checked = false; p.q('#up-auto').dispatchEvent(new p.w.Event('change', { bubbles: true }));
  ok('desligar o automático fica salvo', p.saved().profile.settings.update.auto === false);

  // ================= Código-fonte: git pull =================
  p = await open({ info: INFO({ kind: 'source', platform: 'linux', canGitPull: true }), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': RELEASE() }) });
  p.openPanel(); await p.check();
  ok('código-fonte com git: oferece "Atualizar agora (git pull)" (e não um arquivo para baixar)', !!p.q('#up-pull') && !p.q('[data-url$=".exe"]') && !p.q('[data-url$=".AppImage"]') && p.q('#panel-body').textContent.includes('Código-fonte'));
  p.q('#up-pull').click();
  await waitFor(() => p.q('.update__notes + small, #up-restart'));
  ok('mostra o que o git respondeu e o botão de reiniciar', p.calls.pull === 1 && p.qa('.update__notes').some((n) => n.textContent.includes('3 files changed')) && !!p.q('#up-restart') && p.q('#panel-body').textContent.includes('pnpm install'));
  p.q('#up-restart').click();
  ok('reiniciar chama o app de desktop', p.calls.relaunch === 1);
  p = await open({ info: INFO({ kind: 'source', platform: 'linux', canGitPull: true }), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': RELEASE() }), bridge: { pull: { ok: false, output: 'error: divergent branches' } } });
  p.openPanel(); await p.check(); p.q('#up-pull').click();
  await waitFor(() => p.q('.update__notes--error'));
  ok('git pull que falha: mostra o erro em vermelho e NÃO oferece reiniciar', p.q('.update__notes--error').textContent.includes('divergent') && !p.q('#up-restart'));
  p = await open({ info: INFO({ kind: 'source', platform: 'linux', canGitPull: false }), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': RELEASE() }) });
  p.openPanel(); await p.check();
  ok('código-fonte sem git: não oferece git pull e manda abrir a página', !p.q('#up-pull') && p.q('.update__release').textContent.includes('abra a página'));

  // ================= Outros tipos de instalação =================
  p = await open({ info: INFO({ kind: 'appimage', platform: 'linux' }), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': RELEASE() }) });
  p.openPanel(); await p.check();
  ok('AppImage (portátil): oferece o .AppImage', p.q('#panel-body').textContent.includes('Portátil (AppImage)') && p.q('[data-url$=".AppImage"]') && !p.q('[data-url$=".deb"]'));
  p = await open({ info: INFO({ kind: 'win-portable' }), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': RELEASE() }) });
  p.openPanel(); await p.check();
  ok('Windows portátil: oferece o Portable.exe', p.q('[data-url$="Portable.exe"]') && !p.q('[data-url$="Setup.exe"]'));
  p = await open({ info: INFO({ kind: 'deb', platform: 'linux' }), update: { repo: 'dono/projeto', auto: false }, fetchImpl: github({ '/releases/latest': RELEASE() }) });
  p.openPanel(); await p.check();
  ok('Linux instalado (.deb): oferece o .deb', p.q('[data-url$=".deb"]') && p.q('#panel-body').textContent.includes('.deb'));

  console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
  process.exit(fails ? 1 : 0);
})();
