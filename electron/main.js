/** Abre o app numa janela pequena que fica SEMPRE acima das outras (inclusive no Linux). */
const { app, BrowserWindow, ipcMain, nativeTheme, net, session, shell } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const pkg = require('../package.json');
const { startServer } = require('./static-server');
const { parseSearchResults, searchUrl } = require('./youtube-search');
const { cleanUserAgent } = require('./user-agent');
const { isAllowedExternalUrl, isAllowedGithubUrl } = require('./external-url');
const { isValidSave, writeSave, readSave } = require('./save-mirror');
const { needsX11Relaunch, X11_FLAG } = require('./platform');
const { buildAppInfo, portableDataDir, copyIfMissing } = require('./app-info');

const ROOT = path.join(__dirname, '..');
const PUBLIC_PATHS = ['index.html', 'css', 'js', 'data']; // só isso é entregue pelo servidor local
const PORT = 47633;
const STORAGE_KEY = 'gatinho-pomodoro:v1'; // mesmo valor de CONFIG.storageKey (js/config.js)

// O mesmo nome no código-fonte e nos instaladores: assim a pasta de dados (e o seu progresso) é a mesma.
app.setName('gatinho-pomodoro');

// Versão portátil (Windows .exe portátil ou AppImage): os dados ficam numa pasta ao lado do programa,
// para levar tudo junto. Quem já jogava instalado tem o progresso copiado na primeira vez.
const portableDir = portableDataDir({ platform: process.platform, env: process.env });
if (portableDir) {
  const installedDir = app.getPath('userData');
  app.setPath('userData', portableDir);
  copyIfMissing(installedDir, portableDir, ['save-mirror.json', 'legacy-save.json']);
}
const mirrorFile = () => path.join(app.getPath('userData'), 'save-mirror.json');

// O app é leve: sem aceleração por GPU ele usa menos memória e não gera os avisos
// "libva error" / "GetVSyncParametersIfAvailable" de alguns drivers. Para ligar: GATINHO_GPU=1 pnpm start
if (!process.env.GATINHO_GPU) app.disableHardwareAcceleration();

// Linux: o "sempre no topo" só funciona em X11 (XWayland). O "pnpm start" já inicia o Electron pedindo X11;
// se o app foi aberto de outro jeito numa sessão Wayland, reabre sozinho com o pedido (ver electron/platform.js).
const relaunching = needsX11Relaunch({
  platform: process.platform,
  env: process.env,
  hasOzoneSwitch: app.commandLine.hasSwitch('ozone-platform'),
});
if (relaunching) {
  app.relaunch({ execPath: process.env.APPIMAGE || process.execPath, args: [...process.argv.slice(1), X11_FLAG] });
  app.exit(0);
}

let legacySave = null;
let mainWindow = null; // só depois de existir é que fechar todas as janelas deve encerrar o app

/**
 * O app passou a abrir por http://127.0.0.1 (o YouTube exige), e o navegador guarda os dados por
 * endereço. Para não perder o progresso de quem jogava abrindo por arquivo, lê o save antigo uma vez.
 */
async function readLegacySave() {
  const cache = path.join(app.getPath('userData'), 'legacy-save.json');
  if (fs.existsSync(cache)) return readSave(cache);
  const probe = new BrowserWindow({ show: false });
  try {
    await probe.loadFile(path.join(__dirname, 'blank.html'));
    const raw = await probe.webContents.executeJavaScript(`localStorage.getItem(${JSON.stringify(STORAGE_KEY)})`);
    fs.writeFileSync(cache, raw ?? '');
    return raw || null;
  } catch {
    return null;
  } finally {
    probe.destroy();
  }
}

function readOsRelease() {
  try {
    return fs.readFileSync('/etc/os-release', 'utf8');
  } catch {
    return '';
  }
}

// A cópia em arquivo vale mais que o save antigo: é sempre a mais recente.
ipcMain.on('legacy-save', (event) => { event.returnValue = readSave(mirrorFile()) ?? legacySave; });

ipcMain.on('app-info', (event) => {
  event.returnValue = buildAppInfo({
    version: app.getVersion(),
    packaged: app.isPackaged,
    platform: process.platform,
    arch: process.arch,
    env: process.env,
    pkg,
    osRelease: readOsRelease(),
    hasGit: fs.existsSync(path.join(ROOT, '.git')),
  });
});

ipcMain.on('save-mirror', (_event, text) => {
  if (!isValidSave(text)) return;
  try {
    writeSave(mirrorFile(), text);
  } catch {
    /* disco cheio ou sem permissão: o jogo continua salvando no navegador */
  }
});

ipcMain.on('window-theme', (event, theme) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;
  nativeTheme.themeSource = ['light', 'dark', 'system'].includes(theme?.scheme) ? theme.scheme : 'system';
  if (/^#[0-9a-f]{6}$/i.test(theme?.background)) win.setBackgroundColor(theme.background);
});

ipcMain.handle('open-external', (_event, url) => (isAllowedExternalUrl(url) ? shell.openExternal(url).then(() => true) : false));
ipcMain.handle('open-update-url', (_event, url, repo) => (isAllowedGithubUrl(url, repo) ? shell.openExternal(url).then(() => true) : false));

/** Atualização do código-fonte: só "git pull --ff-only" (nunca apaga nem sobrescreve o que você mudou). */
ipcMain.handle('git-pull', () => new Promise((resolve) => {
  if (app.isPackaged || !fs.existsSync(path.join(ROOT, '.git'))) {
    resolve({ ok: false, output: 'Esta pasta não é um repositório git (ou o app está instalado).' });
    return;
  }
  execFile('git', ['pull', '--ff-only'], { cwd: ROOT, timeout: 60000, windowsHide: true }, (error, stdout, stderr) => {
    resolve({ ok: !error, output: String(stdout || stderr || error?.message || '').trim().slice(-2000) });
  });
}));

ipcMain.handle('relaunch', () => {
  app.relaunch({ execPath: process.env.APPIMAGE || process.execPath, args: process.argv.slice(1) });
  app.exit(0);
});

ipcMain.handle('youtube-search', async (_event, query) => {
  if (typeof query !== 'string' || !query.trim()) return [];
  const response = await net.fetch(searchUrl(query.trim().slice(0, 120)), {
    headers: { 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1' },
  });
  if (!response.ok) throw new Error(`O YouTube respondeu ${response.status}.`);
  return parseSearchResults(await response.text());
});

async function createWindow() {
  legacySave = await readLegacySave();

  // Para o YouTube o app é um navegador comum (sem "Electron/x" no user agent)
  const ses = session.defaultSession;
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()));

  const win = new BrowserWindow({
    title: 'Gatinho Pomodoro',
    icon: path.join(ROOT, 'build', 'icon.png'),
    width: 340,
    height: 620,
    useContentSize: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required', // a música continua entre faixas da playlist
    },
  });
  mainWindow = win;
  win.setAlwaysOnTop(true, 'screen-saver');
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  try {
    const server = await startServer({ root: ROOT, publicPaths: PUBLIC_PATHS, port: PORT });
    const origin = `http://127.0.0.1:${server.port}`;
    win.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(origin)) event.preventDefault(); });
    app.on('before-quit', () => server.close());
    win.loadURL(`${origin}/`);
  } catch {
    win.loadFile(path.join(ROOT, 'index.html')); // sem servidor: o jogo funciona, só a música não
  }
}

// Uma instância só: a porta do servidor local e os dados são únicos. Abrir de novo traz a janela para a frente.
const gotLock = relaunching || app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else if (!relaunching) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(createWindow);
}
// Sem essa checagem, fechar a janela escondida que lê o save antigo encerrava o app na primeira execução.
app.on('window-all-closed', () => { if (mainWindow) app.quit(); });
