/**
 * Servidor local mínimo: entrega só os arquivos do app (index.html, css, js, data) em
 * http://127.0.0.1:<porta>. O YouTube não toca em páginas abertas direto do disco (file://),
 * então o app de desktop abre o jogo por aqui.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * @param {{root: string, publicPaths: string[], port?: number}} options
 *   port fixo mantém o progresso salvo (o armazenamento do navegador é por endereço);
 *   se estiver ocupada, usa outra porta qualquer.
 * @returns {Promise<{port: number, close: () => void}>}
 */
function startServer({ root, publicPaths, port = 0 }) {
  const allowed = publicPaths.map((entry) => path.join(root, entry));

  const server = http.createServer((request, response) => {
    const send = (status, body, type) => { response.writeHead(status, type ? { 'Content-Type': type } : {}); response.end(body); };
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      return send(400);
    }
    if (pathname.includes('\0')) return send(400); // byte nulo faria o fs lançar exceção e derrubar o app
    const file = path.join(root, pathname === '/' ? 'index.html' : pathname);
    const isPublic = allowed.some((entry) => file === entry || file.startsWith(entry + path.sep));
    if (!isPublic) return send(404);
    try {
      fs.readFile(file, (error, data) => (error ? send(404) : send(200, data, MIME[path.extname(file)] ?? 'application/octet-stream')));
    } catch {
      send(400);
    }
  });

  return new Promise((resolve, reject) => {
    const onListening = () => resolve({ port: server.address().port, close: () => server.close() });
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE' && port !== 0) server.listen(0, '127.0.0.1', onListening);
      else reject(error);
    });
    server.listen(port, '127.0.0.1', onListening);
  });
}

module.exports = { startServer };
