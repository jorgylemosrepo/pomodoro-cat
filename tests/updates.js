/**
 * Testa as atualizações pelo GitHub: ler o repositório, comparar versões, escolher o arquivo certo,
 * consultar a API (simulada) e o controlador com estado. Uso: node tests/updates.js
 */
const fs = require('fs');
const path = require('path');
global.window = global;
global.Gatinho = {};
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'updates.js'), 'utf8'));
const { Updater, Updates } = Gatinho;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}

// ================= Repositório =================
const same = Updater.parseRepo.bind(Updater);
check('repo: usuario/repo', same('dono/projeto') === 'dono/projeto');
check('repo: URL do GitHub (com e sem https, www, .git, barra final, páginas internas)', ['https://github.com/dono/projeto', 'http://www.github.com/dono/projeto', 'github.com/dono/projeto', 'https://github.com/dono/projeto.git', 'https://github.com/dono/projeto/', 'https://github.com/dono/projeto/releases/tag/v1.0.0', 'https://github.com/dono/projeto/tree/main?x=1'].every((t) => same(t) === 'dono/projeto'));
check('repo: endereços git', ['git+https://github.com/dono/projeto.git', 'git@github.com:dono/projeto.git', 'ssh://git@github.com/dono/projeto.git'].every((t) => same(t) === 'dono/projeto'));
check('repo: nomes com ponto, hífen e sublinhado', same('meu-dono/proj.eto_1') === 'meu-dono/proj.eto_1' && same('https://github.com/a.b/c-d.js.git') === 'a.b/c-d.js');
check('repo: o texto de exemplo do package.json não vale (é só um lembrete)', same('SEU-USUARIO/gatinho-pomodoro') === null && same('git+https://github.com/SEU-USUARIO/gatinho-pomodoro.git') === null);
check('repo: lixo, vazio e outros sites são recusados', ['', '   ', 'abc', 'a b/c', '../x', './x', 'https://gitlab.com/dono/projeto', '/dono', null, undefined, 42].every((t) => same(t) === null), ['', 'abc', 'https://gitlab.com/dono/projeto'].filter((t) => same(t)).join());

// ================= Versões =================
const cmp = (a, b) => Updater.compare(a, b);
check('versão: maior, menor e igual', cmp('1.2.3', '1.2.2') === 1 && cmp('1.2.2', '1.2.3') === -1 && cmp('1.2.3', '1.2.3') === 0);
check('versão: compara como número, não como texto (1.10 > 1.9)', cmp('1.10.0', '1.9.0') === 1 && cmp('2.0.0', '10.0.0') === -1);
check('versão: aceita o v da tag', cmp('v2.0.0', '1.9.9') === 1 && cmp('v1.0.0', '1.0.0') === 0);
check('versão: pré-lançamento vale menos que a final', cmp('1.0.0-beta.1', '1.0.0') === -1 && cmp('1.0.0', '1.0.0-rc.1') === 1);
check('versão: entre pré-lançamentos compara números (beta.2 < beta.10)', cmp('1.0.0-beta.2', '1.0.0-beta.10') === -1 && cmp('1.0.0-alpha', '1.0.0-beta') === -1);
check('versão: ignora o "+build"', cmp('1.0.0+abc', '1.0.0') === 0);
check('versão: o que não é versão dá null (e nunca é "mais nova")', ['abc', '1.0', '1', '', null, 'latest', '1.0.0.0'].every((v) => cmp(v, '1.0.0') === null && !Updater.isNewer(v, '1.0.0')));
check('isNewer: só a versão estritamente maior', Updater.isNewer('1.0.1', '1.0.0') && !Updater.isNewer('1.0.0', '1.0.0') && !Updater.isNewer('0.9.9', '1.0.0'));

// ================= Arquivo certo =================
const assets = ['GatinhoPomodoro-1.1.0-win-x64-Setup.exe', 'GatinhoPomodoro-1.1.0-win-x64-Portable.exe', 'GatinhoPomodoro-1.1.0-linux-x86_64.AppImage', 'GatinhoPomodoro-1.1.0-linux-amd64.deb', 'GatinhoPomodoro-1.1.0-linux-x86_64.rpm', 'latest-linux.yml', 'x.AppImage.blockmap'].map((name) => ({ name, url: `https://github.com/d/p/releases/download/v1.1.0/${name}`, size: 1 }));
const pick = (kind, arch) => Updater.pickAsset(assets, kind, arch)?.name;
check('arquivo: Windows instalado → Setup, portátil → Portable', pick('win-installer') === assets[0].name && pick('win-portable') === assets[1].name);
check('arquivo: AppImage, deb e rpm (aceita amd64 e x86_64 como x64)', pick('appimage') === assets[2].name && pick('deb') === assets[3].name && pick('rpm') === assets[4].name);
check('arquivo: o instalador nunca é confundido com o portátil', !/portable/i.test(pick('win-installer')) && /portable/i.test(pick('win-portable')));
check('arquivo: sem tipo conhecido ou sem arquivo, devolve null (aí abre a página da versão)', Updater.pickAsset(assets, 'source') === null && Updater.pickAsset(assets, 'browser') === null && Updater.pickAsset(assets, 'linux-package') === null && Updater.pickAsset([], 'deb') === null && Updater.pickAsset(undefined, 'deb') === null);
check('arquivo: prefere a arquitetura do computador', (() => { const two = [{ name: 'a-arm64.AppImage' }, { name: 'a-x86_64.AppImage' }]; return Updater.pickAsset(two, 'appimage', 'arm64').name === 'a-arm64.AppImage' && Updater.pickAsset(two, 'appimage', 'x64').name === 'a-x86_64.AppImage'; })());
check('arquivo: se não há a arquitetura, usa o que existe', Updater.pickAsset([{ name: 'a-x86_64.deb' }], 'deb', 'arm64')?.name === 'a-x86_64.deb');

// ================= Consulta ao GitHub (simulada) =================
/** routes: { sufixo da URL: resposta }. Resposta = { status, json } ou uma função. Anota as chamadas. */
function mockFetch(routes) {
  const calls = [];
  const fn = async (url, options) => {
    calls.push({ url, options });
    const key = Object.keys(routes).find((k) => url.endsWith(k));
    if (!key) return { ok: false, status: 404, json: async () => ({}) };
    const route = typeof routes[key] === 'function' ? routes[key]() : routes[key];
    if (route instanceof Error) throw route;
    return { ok: route.status >= 200 && route.status < 300, status: route.status, json: async () => route.json ?? {} };
  };
  fn.calls = calls;
  return fn;
}
const release = { status: 200, json: { tag_name: 'v1.2.0', html_url: 'https://github.com/d/p/releases/tag/v1.2.0', body: '## Novidades\n- coisa nova', published_at: '2026-10-26T12:00:00Z', assets: assets.map((a) => ({ name: a.name, browser_download_url: a.url, size: 123 })) } };
const meta = { status: 200, json: { default_branch: 'develop', html_url: 'https://github.com/d/p' } };
const pkgJson = (version) => ({ status: 200, json: { name: 'x', version } });
const noRelease = { status: 404 };
const limit = { status: 403 };

let f = mockFetch({ '/repos/d/p/releases/latest': release });
let r;
(async () => {
  r = await Updater.check('d/p', f);
  check('release: lê versão (sem o v), notas, página e data', r.ok && r.latest.version === '1.2.0' && r.latest.source === 'release' && r.latest.url.endsWith('/v1.2.0') && r.latest.notes.includes('Novidades') && r.latest.publishedAt === '2026-10-26T12:00:00Z');
  check('release: lista os arquivos com nome, endereço e tamanho', r.latest.assets.length === assets.length && r.latest.assets[0].url.includes('/releases/download/') && r.latest.assets[0].size === 123);
  check('release: pede o JSON do GitHub (Accept) e consulta só a API', f.calls.length === 1 && f.calls[0].options.headers.Accept.includes('github'));
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': { status: 200, json: { tag_name: 'nightly' } } }));
  check('release com tag que não é versão: explica', !r.ok && r.reason.includes('1.2.3') && r.reason.includes('nightly'));

  f = mockFetch({ '/releases/latest': noRelease, '/repos/d/p': meta, '/develop/package.json': pkgJson('1.5.0') });
  r = await Updater.check('d/p', f);
  check('sem releases: lê o package.json da branch principal (descobre a branch)', r.ok && r.latest.version === '1.5.0' && r.latest.source === 'branch' && r.latest.assets.length === 0 && r.latest.url === 'https://github.com/d/p');
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': noRelease, '/repos/d/p': { status: 404 } }));
  check('repositório inexistente ou privado: explica', !r.ok && r.reason.includes('Não encontrei'));
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': noRelease, '/repos/d/p': meta }));
  check('sem releases e sem package.json: explica', !r.ok && r.reason.includes('não tem releases'));
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': noRelease, '/repos/d/p': meta, '/develop/package.json': pkgJson('bagunça') }));
  check('package.json com versão inválida: explica', !r.ok && r.reason.includes('package.json'));

  f = mockFetch({ '/releases/latest': limit, '/main/package.json': pkgJson('1.4.0') });
  r = await Updater.check('d/p', f);
  check('API limitada (403): cai para o raw.githubusercontent.com, que não tem esse limite', r.ok && r.latest.version === '1.4.0' && !f.calls.some((c) => /\/repos\/d\/p$/.test(c.url)));
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': { status: 429 }, '/master/package.json': pkgJson('1.3.0') }));
  check('limite (429) e a branch se chama master: tenta main e depois master', r.ok && r.latest.version === '1.3.0');
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': limit }));
  check('limitada e sem como ler o package.json: pede para tentar mais tarde', !r.ok && r.reason.includes('limitou'));
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': { status: 500 } }));
  check('erro do GitHub (500): mostra o código', !r.ok && r.reason.includes('500'));
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': () => new Error('rede caiu') }));
  check('sem internet: avisa sem quebrar', !r.ok && r.reason.includes('Sem conexão'));
  r = await Updater.check('d/p', mockFetch({ '/releases/latest': noRelease, '/repos/d/p': () => new Error('rede caiu') }));
  check('internet cai no meio da consulta: avisa sem quebrar', !r.ok && r.reason.includes('Sem conexão'));

  // ================= Controlador =================
  const make = (over = {}, info = {}, fetchFn = mockFetch({ '/releases/latest': release })) => {
    const settings = { repo: '', auto: true, lastCheck: 0, latest: null, ...over };
    const u = new Updates({ settings, info: { version: '1.0.0', kind: 'win-installer', arch: 'x64', repository: '', canGitPull: false, ...info }, fetchFn, now: () => 1_700_000_000_000 });
    return { u, settings };
  };
  check('repositório: o das configurações vale mais que o do package.json', make({ repo: 'a/b' }, { repository: 'git+https://github.com/c/d.git' }).u.repo === 'a/b' && make({}, { repository: 'git+https://github.com/c/d.git' }).u.repo === 'c/d');
  check('repositório: sem nada (ou só o texto de exemplo) fica vazio', make().u.repo === null && make({}, { repository: 'git+https://github.com/SEU-USUARIO/x.git' }).u.repo === null);
  let { u, settings } = make();
  await u.check();
  check('verificar sem repositório: pede para informar', u.state.status === 'error' && u.state.message.includes('Informe o repositório'));
  ({ u, settings } = make({ repo: 'd/p' }));
  let changes = 0; u.addEventListener('change', () => changes++);
  await u.check();
  check('versão nova: estado "available", guarda a consulta e escolhe o arquivo do seu sistema', u.state.status === 'available' && u.available && settings.latest.version === '1.2.0' && settings.lastCheck === 1_700_000_000_000 && u.asset.name.endsWith('Setup.exe') && u.state.message.includes('1.2.0'));
  check('avisa a tela (checking → resultado = 2 mudanças)', changes === 2, `${changes}`);
  const reopened = new Updates({ settings, info: u.info, fetchFn: mockFetch({}), now: () => 0 });
  check('depois de reabrir o app, a versão nova continua marcada (vem da consulta guardada)', reopened.available && reopened.asset.name.endsWith('Setup.exe'));
  ({ u } = make({ repo: 'd/p' }, { version: '1.2.0' }));
  await u.check();
  check('já está na versão mais nova: avisa e não marca nada', u.state.status === 'uptodate' && !u.available && u.state.message.includes('1.2.0'));
  ({ u } = make({ repo: 'd/p' }, { version: '2.0.0' }));
  await u.check();
  check('versão do app maior que a do GitHub (desenvolvimento): não oferece "atualizar"', !u.available && u.state.status === 'uptodate');
  ({ u, settings } = make({ repo: 'd/p' }, {}, mockFetch({ '/releases/latest': () => new Error('x') })));
  await u.check();
  check('falha na consulta: estado "error" e a consulta anterior não é perdida nem marcada', u.state.status === 'error' && settings.latest === null && settings.lastCheck === 0);
  ({ u } = make({ repo: 'd/p' }, { kind: 'appimage' }));
  await u.check();
  check('o tipo da instalação escolhe o arquivo (AppImage)', u.asset.name.endsWith('.AppImage'));
  ({ u } = make({ repo: 'd/p' }, { kind: 'source' }));
  await u.check();
  check('código-fonte: não há arquivo para baixar (usa git pull ou a página)', u.available && u.asset === null);

  // verificação automática: 1x por dia
  const DAY = 86400000, NOW = 1_700_000_000_000;
  check('automático: vence depois de 24 h', make({ repo: 'd/p', lastCheck: NOW - DAY - 1 }).u.shouldAutoCheck(NOW) && make({ repo: 'd/p', lastCheck: 0 }).u.shouldAutoCheck(NOW));
  check('automático: não repete dentro de 24 h', !make({ repo: 'd/p', lastCheck: NOW - DAY + 60000 }).u.shouldAutoCheck(NOW));
  check('automático: desligado ou sem repositório, nunca consulta sozinho', !make({ repo: 'd/p', auto: false }).u.shouldAutoCheck(NOW) && !make({ auto: true }).u.shouldAutoCheck(NOW));

  // trocar o repositório
  ({ u, settings } = make({ repo: 'd/p', lastCheck: 5, latest: { version: '9.9.9' } }));
  check('trocar de repositório limpa a consulta antiga (para não mostrar versão de outro projeto)', u.setRepo('https://github.com/x/y').ok && settings.repo === 'x/y' && settings.latest === null && settings.lastCheck === 0 && !u.available);
  check('repositório inválido é recusado e não muda nada', (() => { const before = settings.repo; const res = u.setRepo('isso não é um repo'); return !res.ok && res.reason.includes('usuario/repositorio') && settings.repo === before; })());
  check('deixar vazio volta ao repositório do projeto', u.setRepo('   ').ok && settings.repo === '');

  console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
  process.exit(failures ? 1 : 0);
})();
