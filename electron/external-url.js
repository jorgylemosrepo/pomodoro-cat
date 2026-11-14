/** Só deixa abrir no navegador do sistema links do YouTube (https), nunca outros endereços. */
const ALLOWED_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'music.youtube.com', 'youtu.be']);

function isAllowedExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/** Links que a atualização pode abrir: só páginas e arquivos DO repositório configurado, em github.com (https). */
function isAllowedGithubUrl(value, repo) {
  if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) return false;
  try {
    const url = new URL(value);
    const base = `/${repo.toLowerCase()}`;
    const path = url.pathname.toLowerCase();
    return url.protocol === 'https:' && url.hostname === 'github.com' && (path === base || path.startsWith(`${base}/`));
  } catch {
    return false;
  }
}

module.exports = { isAllowedExternalUrl, isAllowedGithubUrl };
