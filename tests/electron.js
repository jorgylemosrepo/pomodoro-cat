/**
 * Testa as peças do app de desktop que não dependem de abrir o Electron: identificação do navegador,
 * links permitidos, cópia do progresso em arquivo. Uso: node tests/electron.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cleanUserAgent } = require('../electron/user-agent');
const { isAllowedExternalUrl } = require('../electron/external-url');
const { isValidSave, writeSave, readSave } = require('../electron/save-mirror');
const { needsX11Relaunch, X11_FLAG } = require('../electron/platform');
const { parseOsRelease, detectKind, readRepository, portableDataDir, copyIfMissing, buildAppInfo } = require('../electron/app-info');
const { isAllowedGithubUrl } = require('../electron/external-url');

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}

// ---- User agent ----
const raw = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) gatinho-pomodoro/1.0.0 Chrome/152.0.7977.167 Electron/44.9.3 Safari/537.36';
const clean = cleanUserAgent(raw);
check('user agent: tira Electron e o nome do app', !/Electron|gatinho/i.test(clean), clean);
check('user agent: continua parecendo um Chrome', clean === 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.167 Safari/537.36');
check('user agent: sem as marcas, não muda nada', cleanUserAgent(clean) === clean);

// ---- Links externos ----
const ok = ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://youtu.be/dQw4w9WgXcQ', 'https://music.youtube.com/watch?v=x', 'https://www.youtube.com/playlist?list=PLabc'];
const bad = ['http://www.youtube.com/watch?v=x', 'https://evil.com/?u=youtube.com', 'https://www.youtube.com.evil.com/x', 'file:///etc/passwd', 'javascript:alert(1)', 'ftp://youtube.com', 'youtube.com/watch', '', null, undefined, 42, 'https://youtube.com@evil.com/'];
check('links do YouTube são permitidos', ok.every(isAllowedExternalUrl));
check('outros endereços e esquemas são recusados', bad.every((u) => !isAllowedExternalUrl(u)), bad.filter(isAllowedExternalUrl).join());

// ---- Wayland x X11 ----
const base = { platform: 'linux', env: { XDG_SESSION_TYPE: 'wayland', WAYLAND_DISPLAY: 'wayland-0' }, hasOzoneSwitch: false };
check('Wayland sem o pedido de X11: reabre', needsX11Relaunch(base) === true);
check('Wayland detectado só por WAYLAND_DISPLAY também reabre', needsX11Relaunch({ ...base, env: { WAYLAND_DISPLAY: 'wayland-1' } }) === true);
check('já iniciado com --ozone-platform: não reabre (evita laço infinito)', needsX11Relaunch({ ...base, hasOzoneSwitch: true }) === false);
check('sessão X11: não reabre', needsX11Relaunch({ ...base, env: { XDG_SESSION_TYPE: 'x11' } }) === false && needsX11Relaunch({ ...base, env: {} }) === false);
check('Windows e macOS: nunca reabre', needsX11Relaunch({ ...base, platform: 'win32' }) === false && needsX11Relaunch({ ...base, platform: 'darwin' }) === false);
check('o pedido é o argumento certo e o "start" o usa', X11_FLAG === '--ozone-platform=x11' && JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).scripts.start.includes(X11_FLAG));
check('package.json não usa o campo "pnpm" (o pnpm 11+ ignora) e o workspace libera o Electron', !('pnpm' in JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))) && /allowBuilds:\s*\n\s+electron:\s*true/.test(fs.readFileSync(path.join(__dirname, '..', 'pnpm-workspace.yaml'), 'utf8')));

// ---- Cópia do save ----
check('save válido: objeto JSON', isValidSave('{"pet":{},"profile":{}}'));
check('save inválido: lixo, lista, vazio, número, grande demais', ['', '[]', 'null', '123', '{quebrado', undefined, {}, 'x'.repeat(5 * 1024 * 1024 + 1)].every((v) => !isValidSave(v)));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gatinho-'));
const file = path.join(dir, 'save-mirror.json');
check('ler arquivo que não existe devolve null', readSave(file) === null);
writeSave(file, '{"a":1}');
check('escreve e lê de volta', readSave(file) === '{"a":1}');
writeSave(file, '{"a":2}');
check('sobrescrever não deixa arquivo temporário', readSave(file) === '{"a":2}' && !fs.existsSync(`${file}.tmp`) && fs.readdirSync(dir).length === 1);
check('arquivo vazio conta como sem save', (fs.writeFileSync(file, ''), readSave(file) === null));
fs.rmSync(dir, { recursive: true });

// ---- Tipo de instalação (decide qual arquivo baixar na atualização) ----
const UBUNTU = 'NAME="Ubuntu"\nID=ubuntu\nID_LIKE=debian\nVERSION_ID="24.04"';
const FEDORA = 'NAME="Fedora Linux"\nID=fedora\nVERSION_ID=44';
const SUSE = 'ID="opensuse-tumbleweed"\nID_LIKE="opensuse suse"';
check('os-release: junta ID e ID_LIKE, sem aspas e em minúsculas', parseOsRelease(UBUNTU) === 'ubuntu debian' && parseOsRelease(FEDORA) === 'fedora' && parseOsRelease(SUSE) === 'opensuse-tumbleweed opensuse suse' && parseOsRelease(undefined) === '');
const kind = (over) => detectKind({ packaged: true, platform: 'linux', env: {}, osRelease: '', ...over });
check('rodando do código-fonte (pnpm start): "source", em qualquer sistema', kind({ packaged: false }) === 'source' && kind({ packaged: false, platform: 'win32' }) === 'source');
check('Windows: instalado, ou portátil quando o launcher define PORTABLE_EXECUTABLE_DIR', kind({ platform: 'win32' }) === 'win-installer' && kind({ platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: 'C:\\x' } }) === 'win-portable');
check('Linux: AppImage (variável APPIMAGE) vence a distribuição', kind({ env: { APPIMAGE: '/x/a.AppImage' }, osRelease: UBUNTU }) === 'appimage');
check('Linux instalado: Ubuntu/Debian → deb; Fedora/openSUSE → rpm; outra → genérico', kind({ osRelease: UBUNTU }) === 'deb' && kind({ osRelease: FEDORA }) === 'rpm' && kind({ osRelease: SUSE }) === 'rpm' && kind({ osRelease: 'ID=arch' }) === 'linux-package' && kind({ osRelease: '' }) === 'linux-package');
check('macOS e outros sistemas', kind({ platform: 'darwin' }) === 'mac' && kind({ platform: 'freebsd' }) === 'other');
check('repositório do package.json: texto ou objeto', readRepository({ repository: 'https://github.com/a/b' }) === 'https://github.com/a/b' && readRepository({ repository: { url: 'git+https://github.com/a/b.git' } }) === 'git+https://github.com/a/b.git' && readRepository({}) === '' && readRepository(null) === '');
check('dados do app: git pull só no código-fonte e só se há repositório git', buildAppInfo({ version: '1.0.0', packaged: false, platform: 'linux', arch: 'x64', env: {}, pkg: {}, hasGit: true }).canGitPull === true && buildAppInfo({ version: '1.0.0', packaged: false, platform: 'linux', arch: 'x64', env: {}, pkg: {}, hasGit: false }).canGitPull === false && buildAppInfo({ version: '1.0.0', packaged: true, platform: 'linux', arch: 'x64', env: {}, pkg: {}, hasGit: true }).canGitPull === false);
check('dados do app: versão, tipo, arquitetura e repositório', (() => { const i = buildAppInfo({ version: '2.1.0', packaged: true, platform: 'win32', arch: 'arm64', env: {}, pkg: { repository: 'x/y' } }); return i.version === '2.1.0' && i.kind === 'win-installer' && i.arch === 'arm64' && i.repository === 'x/y'; })());

// ---- Versão portátil: dados ao lado do programa ----
check('portátil Windows: pasta gatinho-data ao lado do .exe', portableDataDir({ platform: 'win32', env: { PORTABLE_EXECUTABLE_DIR: '/d/apps' } }) === path.join('/d/apps', 'gatinho-data'));
check('portátil Linux: pasta gatinho-data ao lado do AppImage', portableDataDir({ platform: 'linux', env: { APPIMAGE: '/home/u/Downloads/Gatinho.AppImage' } }) === path.join('/home/u/Downloads', 'gatinho-data'));
check('instalado e código-fonte NÃO são portáteis (usam a pasta de dados do sistema)', portableDataDir({ platform: 'win32', env: {} }) === null && portableDataDir({ platform: 'linux', env: {} }) === null && portableDataDir({ platform: 'darwin', env: { APPIMAGE: '/x' } }) === null);
const seedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gatinho-seed-'));
const from = path.join(seedDir, 'instalado'); const to = path.join(seedDir, 'portatil', 'gatinho-data');
fs.mkdirSync(from, { recursive: true }); fs.writeFileSync(path.join(from, 'save-mirror.json'), '{"a":1}'); fs.writeFileSync(path.join(from, 'outro.txt'), 'x');
check('traz o progresso para o portátil (só os arquivos pedidos) e cria a pasta', copyIfMissing(from, to, ['save-mirror.json', 'legacy-save.json']).join() === 'save-mirror.json' && fs.readFileSync(path.join(to, 'save-mirror.json'), 'utf8') === '{"a":1}' && !fs.existsSync(path.join(to, 'outro.txt')));
fs.writeFileSync(path.join(from, 'save-mirror.json'), '{"a":2}');
check('NUNCA sobrescreve o progresso que o portátil já tem', copyIfMissing(from, to, ['save-mirror.json']).length === 0 && fs.readFileSync(path.join(to, 'save-mirror.json'), 'utf8') === '{"a":1}');
check('sem nada para copiar, não cria pasta', copyIfMissing(path.join(seedDir, 'nao-existe'), path.join(seedDir, 'novo'), ['save-mirror.json']).length === 0 && !fs.existsSync(path.join(seedDir, 'novo')));
fs.rmSync(seedDir, { recursive: true });

// ---- Links que a atualização pode abrir ----
const gh = (url, repo = 'dono/projeto') => isAllowedGithubUrl(url, repo);
check('atualização: abre só páginas e arquivos do repositório configurado', gh('https://github.com/dono/projeto/releases/tag/v1.2.0') && gh('https://github.com/dono/projeto/releases/download/v1.2.0/G-Setup.exe') && gh('https://github.com/dono/projeto') && gh('https://GitHub.com/Dono/Projeto/releases'));
check('atualização: recusa outro repositório, prefixo parecido, outro site, http e esquemas perigosos', ['https://github.com/dono/outro/releases', 'https://github.com/dono/projeto-falso/x', 'https://github.com/outro/projeto/x', 'http://github.com/dono/projeto/x', 'https://github.com.evil.com/dono/projeto/x', 'https://github.com@evil.com/dono/projeto/x', 'https://evil.com/dono/projeto/', 'javascript:alert(1)', 'file:///etc/passwd', '', null, 42].every((url) => !gh(url)), ['https://github.com/dono/projeto-falso/x', 'https://github.com@evil.com/dono/projeto/x'].filter(gh).join());
check('atualização: o nome do repositório também é validado', [null, undefined, '', 'x', 'a/b/c', '../x', 'a b/c', 42].every((repo) => !gh('https://github.com/a/b/x', repo)));

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
