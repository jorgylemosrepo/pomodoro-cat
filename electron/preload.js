/** Ponte segura entre o app (página) e o processo principal do Electron. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  /** Progresso guardado fora do navegador interno (texto JSON ou null). */
  legacySave: ipcRenderer.sendSync('legacy-save'),
  /** Sobre o app: { version, kind, platform, arch, repository, canGitPull } (ver electron/app-info.js). */
  appInfo: ipcRenderer.sendSync('app-info'),
  /** Guarda uma cópia do progresso em arquivo. */
  saveMirror: (text) => ipcRenderer.send('save-mirror', text),
  /** Busca músicas no YouTube pelo nome. */
  searchYouTube: (query) => ipcRenderer.invoke('youtube-search', query),
  /** Abre um link do YouTube no navegador do sistema. */
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  /** Abre uma página ou arquivo do repositório de atualização (github.com/<repo>/...) no navegador. */
  openUpdateUrl: (url, repo) => ipcRenderer.invoke('open-update-url', url, repo),
  /** Só no código-fonte: roda "git pull --ff-only" na pasta do app. Retorna { ok, output }. */
  gitPull: () => ipcRenderer.invoke('git-pull'),
  /** Reinicia o app (depois de atualizar). */
  relaunch: () => ipcRenderer.invoke('relaunch'),
  /** Avisa o tema da janela para o Electron pintar o que é dele ({ scheme: 'light'|'dark'|'system', background: '#rrggbb' }). */
  setWindowTheme: (theme) => ipcRenderer.send('window-theme', theme),
});
