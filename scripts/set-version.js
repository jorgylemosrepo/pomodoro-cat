/**
 * Muda a versão do app em todos os lugares de uma vez (package.json e js/config.js).
 * Uso: pnpm version:set 1.2.3
 * Um teste (tests/build.js) confere que os dois continuam iguais.
 */
const fs = require('fs');
const path = require('path');

const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** Atualiza os dois arquivos em `root`. Retorna a versão anterior. */
function setVersion(root, version) {
  if (!VERSION.test(version ?? '')) throw new Error('Use o formato 1.2.3 (ou 1.2.3-beta.1).');
  const packageFile = path.join(root, 'package.json');
  const configFile = path.join(root, 'js', 'config.js');

  const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
  const previous = pkg.version;
  pkg.version = version;

  const config = fs.readFileSync(configFile, 'utf8');
  if (!/version: '[^']*'/.test(config)) throw new Error('Não achei "version" em js/config.js.');

  fs.writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);
  fs.writeFileSync(configFile, config.replace(/version: '[^']*'/, `version: '${version}'`));
  return previous;
}

if (require.main === module) {
  try {
    const previous = setVersion(path.join(__dirname, '..'), process.argv[2]);
    console.log(`Versão ${previous} -> ${process.argv[2]}`);
    console.log(`Para publicar: git commit -am "v${process.argv[2]}" && git tag v${process.argv[2]} && git push --follow-tags`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { setVersion, VERSION };
