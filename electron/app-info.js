/**
 * Dados sobre COMO o app está rodando: instalado, portátil, AppImage ou direto do código-fonte.
 * Isso decide qual arquivo baixar numa atualização e onde ficam os dados (o portátil guarda tudo ao lado do programa).
 * Funções puras (recebem o ambiente como argumento), para poder testar sem abrir o Electron.
 */
const fs = require('fs');
const path = require('path');

/** Lê ID e ID_LIKE de um /etc/os-release e devolve tudo junto em minúsculas ("fedora", "ubuntu debian"...). */
function parseOsRelease(text) {
  return [...String(text ?? '').matchAll(/^(?:ID|ID_LIKE)=["']?([^"'\n]*)["']?$/gm)].map((m) => m[1].toLowerCase()).join(' ');
}

/**
 * 'source' | 'win-installer' | 'win-portable' | 'appimage' | 'deb' | 'rpm' | 'linux-package' | 'mac' | 'other'
 * @param {{packaged: boolean, platform: string, env: object, osRelease?: string}} options
 */
function detectKind({ packaged, platform, env, osRelease = '' }) {
  if (!packaged) return 'source';
  if (platform === 'win32') return env.PORTABLE_EXECUTABLE_DIR ? 'win-portable' : 'win-installer';
  if (platform === 'linux') {
    if (env.APPIMAGE) return 'appimage';
    const distro = parseOsRelease(osRelease);
    if (/\b(debian|ubuntu)\b/.test(distro)) return 'deb';
    if (/\b(fedora|rhel|centos|suse|opensuse)\b/.test(distro)) return 'rpm';
    return 'linux-package';
  }
  return platform === 'darwin' ? 'mac' : 'other';
}

/** O repositório declarado no package.json ("repository" como texto ou { url }). */
function readRepository(pkg) {
  const repository = pkg?.repository;
  return typeof repository === 'string' ? repository : repository?.url ?? '';
}

/** Pasta de dados da versão portátil (ao lado do programa), ou null nas versões instaladas e no código-fonte. */
function portableDataDir({ platform, env }) {
  if (platform === 'win32' && env.PORTABLE_EXECUTABLE_DIR) return path.join(env.PORTABLE_EXECUTABLE_DIR, 'gatinho-data');
  if (platform === 'linux' && env.APPIMAGE) return path.join(path.dirname(env.APPIMAGE), 'gatinho-data');
  return null;
}

/** Copia arquivos de uma pasta para outra só se ainda não existirem lá (traz o progresso para a versão portátil). */
function copyIfMissing(fromDir, toDir, files, fileSystem = fs) {
  const copied = [];
  for (const name of files) {
    const from = path.join(fromDir, name);
    const to = path.join(toDir, name);
    if (!fileSystem.existsSync(from) || fileSystem.existsSync(to)) continue;
    fileSystem.mkdirSync(toDir, { recursive: true });
    fileSystem.copyFileSync(from, to);
    copied.push(name);
  }
  return copied;
}

/** Tudo que o app (página) precisa saber sobre si mesmo. */
function buildAppInfo({ version, packaged, platform, arch, env, pkg, osRelease, hasGit }) {
  const kind = detectKind({ packaged, platform, env, osRelease });
  return { version, kind, platform, arch, repository: readRepository(pkg), canGitPull: kind === 'source' && Boolean(hasGit) };
}

module.exports = { parseOsRelease, detectKind, readRepository, portableDataDir, copyIfMissing, buildAppInfo };
