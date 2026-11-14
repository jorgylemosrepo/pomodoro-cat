/**
 * Confere a configuração de build (Windows e Linux, instalador e portátil), o ícone, a versão, o fluxo de release
 * e o que entra no pacote. Uso: node tests/build.js
 * (O empacotamento de verdade é "pnpm pack" / "pnpm dist:*": ver README.)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const build = pkg.build;
const { setVersion } = require('../scripts/set-version');
const { X11_FLAG } = require('../electron/platform');

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}
const targets = (list) => list.map((t) => (typeof t === 'string' ? t : t.target));

// ---------- Identidade e dependências ----------
check('o ponto de entrada existe', fs.existsSync(path.join(ROOT, pkg.main)));
check('appId no formato reverso (com.empresa.app) e nome do produto', /^[a-z0-9]+(\.[a-z0-9-]+)+$/i.test(build.appId) && build.productName === 'Gatinho Pomodoro');
check('electron e electron-builder são dependências de desenvolvimento', /^\^?4\d/.test(pkg.devDependencies.electron) && /^\^?2[6-9]/.test(pkg.devDependencies['electron-builder']) && !pkg.dependencies);
check('o campo "pnpm" não existe (o pnpm 11+ ignora) e o workspace decide quem roda script de instalação', !('pnpm' in pkg) && /allowBuilds:/.test(read('pnpm-workspace.yaml')) && /electron:\s*true/.test(read('pnpm-workspace.yaml')) && /electron-winstaller:\s*false/.test(read('pnpm-workspace.yaml')));
check('.deb exige autor com e-mail e a página do projeto', pkg.author?.name && /@/.test(pkg.author.email) && /^https:\/\/github\.com\//.test(pkg.homepage) && pkg.repository?.url?.includes('github.com'));
check('o repositório do package.json é o texto de exemplo até você apontar para o seu (o app avisa se faltar)', /SEU-USUARIO|github\.com\/[\w.-]+\/[\w.-]+/.test(pkg.repository.url));

// ---------- Alvos: instalador e portátil ----------
check('Windows: instalador (nsis) E portátil', ['nsis', 'portable'].every((t) => targets(build.win.target).includes(t)));
check('Linux: portátil (AppImage) E instaladores (deb e rpm)', ['AppImage', 'deb', 'rpm'].every((t) => targets(build.linux.target).includes(t)));
check('nomes dos arquivos: versão, sistema e tipo; instalador e portátil nunca iguais', (() => {
  const names = [build.nsis.artifactName, build.portable.artifactName, build.linux.artifactName];
  return names.every((n) => n.includes('${version}') && n.includes('${ext}')) && /Setup/.test(names[0]) && /Portable/.test(names[1]) && names[0] !== names[1];
})());
check('o instalador do Windows deixa escolher a pasta, não é "um clique" e NÃO apaga o progresso ao desinstalar', build.nsis.oneClick === false && build.nsis.allowToChangeInstallationDirectory === true && build.nsis.deleteAppDataOnUninstall === false);
check('o nome do binário no Linux não tem espaço e o atalho bate com ele (agrupa a janela na barra de tarefas)', build.linux.executableName === 'gatinho-pomodoro' && pkg.desktopName === `${build.linux.executableName}.desktop`);
check('o atalho do Linux já inicia em X11 (para o "sempre no topo" funcionar no Wayland)', build.linux.executableArgs.includes(X11_FLAG));
check('o nome interno do app é o mesmo em todo lugar (a pasta de dados e o progresso não mudam ao instalar)', pkg.name === 'gatinho-pomodoro' && !('productName' in pkg) && /app\.setName\('gatinho-pomodoro'\)/.test(read('electron/main.js')));

// ---------- O que entra no pacote ----------
const files = build.files;
check('só entra o que o app precisa (lista branca): sem testes, README, scripts ou workflow', ['index.html', 'css/**/*', 'js/**/*', 'data/**/*', 'electron/**/*', 'build/icon.png'].every((f) => files.includes(f)) && !files.some((f) => /tests|README|scripts|\.github|pnpm/.test(f)));
check('tudo que a lista cita existe de verdade', files.filter((f) => !f.includes('*') && f !== 'package.json').every((f) => fs.existsSync(path.join(ROOT, f))) && ['css', 'js', 'data', 'electron'].every((d) => fs.statSync(path.join(ROOT, d)).isDirectory()));
check('o servidor local só entrega o que está no pacote', (() => { const m = read('electron/main.js').match(/PUBLIC_PATHS = (\[[^\]]*\])/); return m && JSON.parse(m[1].replace(/'/g, '"')).every((p) => files.some((f) => f === p || f.startsWith(`${p}/`))); })());
check('os recursos que o app lê do pacote existem (ícone da janela, página em branco da migração)', fs.existsSync(path.join(ROOT, 'build/icon.png')) && fs.existsSync(path.join(ROOT, 'electron/blank.html')) && /build'?, 'icon\.png'/.test(read('electron/main.js').replace(/"/g, "'")));
check('o app usa o asar (código empacotado em um arquivo só)', build.asar === true && build.directories.output === 'dist' && build.directories.buildResources === 'build');

// ---------- Ícone ----------
const icon = fs.readFileSync(path.join(ROOT, 'build/icon.png'));
check('ícone: PNG de 512x512 (o electron-builder gera .ico e .icns a partir dele)', icon.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' && icon.readUInt32BE(16) === 512 && icon.readUInt32BE(20) === 512);
check('ícone: o desenho-fonte está junto (para refazer o PNG)', fs.existsSync(path.join(ROOT, 'build/icon.svg')) && build.win.icon === 'build/icon.png' && build.linux.icon === 'build/icon.png');

// ---------- Scripts ----------
const s = pkg.scripts;
const dist = Object.keys(s).filter((k) => k.startsWith('dist:'));
check('scripts de build: Windows e Linux, instalador e portátil', ['dist:win', 'dist:win:installer', 'dist:win:portable', 'dist:linux', 'dist:linux:installer', 'dist:linux:portable', 'pack'].every((k) => k in s));
check('os scripts pedem os alvos certos', /nsis/.test(s['dist:win:installer']) && /portable/.test(s['dist:win:portable']) && /nsis portable/.test(s['dist:win']) && /AppImage/.test(s['dist:linux:portable']) && /deb rpm/.test(s['dist:linux:installer']) && /AppImage deb rpm/.test(s['dist:linux']));
check('nenhum script publica sozinho (--publish never): quem publica é o fluxo de release', dist.concat('pack').every((k) => s[k].includes('--publish never')));
check('"pnpm test" roda todos os testes de lógica, incluindo atualização e build', ['simulate', 'progress', 'life', 'ambient', 'economy', 'scenery', 'extras', 'music', 'electron', 'updates', 'build'].every((t) => s.test.includes(`tests/${t}.js`)) && s['test:page'].includes('page-update.js'));
check('todo teste citado nos scripts existe', (s.test + s['test:page']).match(/tests\/[\w-]+\.js/g).every((f) => fs.existsSync(path.join(ROOT, f))));
check('o .gitignore deixa de fora node_modules, dist e a pasta de dados portátil', /node_modules/.test(read('.gitignore')) && /^dist\/?$/m.test(read('.gitignore')) && /gatinho-data/.test(read('.gitignore')));

// ---------- Fluxo de release no GitHub ----------
const workflow = read('.github/workflows/release.yml');
check('release automática: dispara em tags v*, com permissão de escrever a Release', /tags:\s*\['v\*'\]/.test(workflow) && /contents:\s*write/.test(workflow));
check('release automática: Linux e Windows, cada um no seu sistema', /ubuntu-latest/.test(workflow) && /windows-latest/.test(workflow) && /dist:linux/.test(workflow) && /dist:win/.test(workflow));
check('release automática: os scripts que ela chama existem e os arquivos publicados casam com os alvos', [...workflow.matchAll(/script: (dist:[\w:]+)/g)].every((m) => m[1] in s) && ['.exe', '.AppImage', '.deb', '.rpm'].every((ext) => workflow.includes(`dist/*${ext}`)));
check('release automática: confere que a versão do package.json é a da tag e instala o rpm no Linux', /package\.json'\)\.version/.test(workflow) && /github\.ref_name/.test(workflow) && /apt-get install -y rpm/.test(workflow));

// ---------- Versão: um só número em todo lugar ----------
check('a versão do app (js/config.js) é a mesma do package.json', /version: '([^']+)'/.exec(read('js/config.js'))[1] === pkg.version && /^\d+\.\d+\.\d+/.test(pkg.version));
(() => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gatinho-ver-'));
  fs.mkdirSync(path.join(tmp, 'js'));
  fs.copyFileSync(path.join(ROOT, 'package.json'), path.join(tmp, 'package.json'));
  fs.copyFileSync(path.join(ROOT, 'js/config.js'), path.join(tmp, 'js/config.js'));
  const before = fs.readFileSync(path.join(tmp, 'package.json'), 'utf8');
  const previous = setVersion(tmp, '9.8.7-beta.1');
  const after = JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8'));
  check('version:set muda package.json e js/config.js juntos e devolve a versão anterior', previous === pkg.version && after.version === '9.8.7-beta.1' && fs.readFileSync(path.join(tmp, 'js/config.js'), 'utf8').includes("version: '9.8.7-beta.1'") && JSON.stringify(after.build) === JSON.stringify(pkg.build));
  check('version:set mantém o resto do package.json intacto (mesma formatação)', fs.readFileSync(path.join(tmp, 'package.json'), 'utf8').replace('9.8.7-beta.1', pkg.version) === before);
  const bad = ['1.2', 'v1.2.3', '1.2.3.4', 'abc', '', undefined];
  check('version:set recusa versões inválidas sem mexer em nada', bad.every((v) => { try { setVersion(tmp, v); return false; } catch { return true; } }) && JSON.parse(fs.readFileSync(path.join(tmp, 'package.json'), 'utf8')).version === '9.8.7-beta.1');
  fs.rmSync(tmp, { recursive: true });
})();

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
