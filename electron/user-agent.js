/**
 * Remove do "user agent" as marcas "Electron/x" e do nome do app. O YouTube (e outros sites)
 * trata melhor o que parece um Chrome comum do que um cliente desconhecido.
 */
function cleanUserAgent(userAgent) {
  return String(userAgent).replace(/\s(Electron|gatinho-pomodoro)\/\S+/gi, '');
}

module.exports = { cleanUserAgent };
