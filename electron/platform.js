/**
 * Wayland x X11. O "sempre no topo" só funciona em janelas X11 (XWayland). A partir do Electron 38, numa
 * sessão Wayland ele escolhe Wayland sozinho ANTES de o código do app rodar, então pedir X11 de dentro do
 * app (app.commandLine.appendSwitch) chega tarde: a janela quebra ("XGetWindowAttributes failed for window 1").
 * O pedido precisa estar na linha de comando que inicia o Electron (o script "start" já faz isso) ou o app
 * se reabre sozinho com ele.
 */
const X11_FLAG = '--ozone-platform=x11';

/** O app abriu sem o pedido de X11 numa sessão Wayland? Então precisa reabrir com ele. */
function needsX11Relaunch({ platform, env, hasOzoneSwitch }) {
  if (platform !== 'linux' || hasOzoneSwitch) return false;
  return env.XDG_SESSION_TYPE === 'wayland' || Boolean(env.WAYLAND_DISPLAY);
}

module.exports = { X11_FLAG, needsX11Relaunch };
