/**
 * Cópia do progresso em um arquivo da pasta de dados do app. O navegador interno guarda o progresso
 * por endereço (origem); se o endereço mudar, o arquivo traz tudo de volta.
 */
const fs = require('fs');

const MAX_BYTES = 5 * 1024 * 1024;

/** Só aceita texto que seja um objeto JSON e de tamanho razoável (vem da página, então não confiamos cegamente). */
function isValidSave(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_BYTES) return false;
  try {
    const data = JSON.parse(text);
    return typeof data === 'object' && data !== null && !Array.isArray(data);
  } catch {
    return false;
  }
}

/** Escreve num arquivo temporário e troca de nome: uma queda no meio da escrita não corrompe o save. */
function writeSave(file, text) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

function readSave(file) {
  try {
    return fs.readFileSync(file, 'utf8') || null;
  } catch {
    return null;
  }
}

module.exports = { isValidSave, writeSave, readSave };
