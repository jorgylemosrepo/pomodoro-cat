/**
 * Testa a parte de música que não precisa do YouTube de verdade: leitura de links, busca,
 * extração dos resultados e o servidor local do app de desktop. Uso: node tests/music.js
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
global.window = global;
global.Gatinho = {};
(0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', 'music', 'youtube.js'), 'utf8'));
const { YouTube } = Gatinho;
const { parseSearchResults, searchUrl } = require('../electron/youtube-search');
const { startServer } = require('../electron/static-server');

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const get = (port, url) => new Promise((resolve) => http.get({ host: '127.0.0.1', port, path: url }, (res) => {
  let body = ''; res.on('data', (c) => (body += c)); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
}));

(async () => {
  // ---- Links ----
  const ID = 'dQw4w9WgXcQ', LIST = 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf';
  check('link normal', same(YouTube.parse(`https://www.youtube.com/watch?v=${ID}`), { type: 'video', id: ID }));
  check('link com tempo e outros parâmetros', same(YouTube.parse(`https://www.youtube.com/watch?v=${ID}&t=42s&feature=share`), { type: 'video', id: ID }));
  check('link curto youtu.be', same(YouTube.parse(`https://youtu.be/${ID}?si=abc`), { type: 'video', id: ID }));
  check('YouTube Music', same(YouTube.parse(`https://music.youtube.com/watch?v=${ID}`), { type: 'video', id: ID }));
  check('shorts e embed', same(YouTube.parse(`https://www.youtube.com/shorts/${ID}`), { type: 'video', id: ID }) && same(YouTube.parse(`https://www.youtube.com/embed/${ID}`), { type: 'video', id: ID }));
  check('sem https', same(YouTube.parse(`youtube.com/watch?v=${ID}`), { type: 'video', id: ID }));
  check('link de playlist', same(YouTube.parse(`https://www.youtube.com/playlist?list=${LIST}`), { type: 'playlist', id: LIST }));
  check('vídeo dentro de playlist toca a playlist', same(YouTube.parse(`https://www.youtube.com/watch?v=${ID}&list=${LIST}&index=2`), { type: 'playlist', id: LIST }));
  check('mix automático (RD) toca só o vídeo', same(YouTube.parse(`https://www.youtube.com/watch?v=${ID}&list=RDdQw4w9WgXcQ`), { type: 'video', id: ID }));
  check('código de playlist puro', same(YouTube.parse(LIST), { type: 'playlist', id: LIST }));
  check('texto vira busca', same(YouTube.parse('  daft punk one more time '), { type: 'search', query: 'daft punk one more time' }));
  check('palavra solta vira busca (nunca um ID)', same(YouTube.parse('radiohead'), { type: 'search', query: 'radiohead' }) && same(YouTube.parse('supermassive'), { type: 'search', query: 'supermassive' }));
  check('link do YouTube sem música é recusado', YouTube.parse('https://www.youtube.com/') === null && YouTube.parse('https://www.youtube.com/@canal') === null);
  check('link de outro site vira busca, não é aberto', YouTube.parse('https://exemplo.com/watch?v=' + ID).type === 'search');
  check('vazio', YouTube.parse('   ') === null && YouTube.parse(undefined) === null);

  // ---- Tempo e textos ----
  check('formatTime', YouTube.formatTime(0) === '0:00' && YouTube.formatTime(75) === '1:15' && YouTube.formatTime(3725) === '1:02:05' && YouTube.formatTime(NaN) === '0:00');
  check('decodifica títulos da API', YouTube.decode('Rock &amp; Roll &quot;ao vivo&quot; &#39;99') === `Rock & Roll "ao vivo" '99`);

  // ---- Busca pela API oficial (resposta simulada) ----
  const apiJson = { items: [
    { id: { videoId: 'AAAAAAAAAAA' }, snippet: { title: 'Lofi &amp; Chill', channelTitle: 'Canal', thumbnails: { default: { url: 'http://x/a.jpg' } } } },
    { id: { kind: 'youtube#channel', channelId: 'C1' }, snippet: { title: 'Um canal' } },
    { id: { videoId: 'BBBBBBBBBBB' }, snippet: { title: 'Outra', channelTitle: 'Outro' } },
  ] };
  const mapped = YouTube.fromApi(apiJson);
  check('API: só vídeos, com título decodificado', mapped.length === 2 && mapped[0].title === 'Lofi & Chill' && mapped[1].id === 'BBBBBBBBBBB');
  let requested;
  global.fetch = async (url) => { requested = url; return { ok: true, json: async () => apiJson }; };
  const viaApi = await YouTube.search('lofi hip hop', 'CHAVE&?');
  check('busca com chave usa a API e escapa os parâmetros', viaApi.length === 2 && requested.includes('q=lofi%20hip%20hop') && requested.includes('key=CHAVE%26%3F') && requested.includes('videoEmbeddable=true'));
  global.fetch = async () => ({ ok: false, json: async () => ({ error: { message: 'quotaExceeded' } }) });
  check('erro da API chega como mensagem', await YouTube.search('x', 'k').then(() => false, (e) => e.message === 'quotaExceeded'));
  global.desktop = { searchYouTube: async (q) => [{ id: 'CCCCCCCCCCC', title: q, channel: '', duration: '3:00', thumb: '' }] };
  check('sem chave, usa a busca do app de desktop', (await YouTube.search('teste'))[0].title === 'teste');
  delete global.desktop;
  check('sem chave e sem desktop avisa NO_SEARCH', await YouTube.search('teste').then(() => false, (e) => e.message === 'NO_SEARCH'));

  // ---- Extração dos resultados da página do YouTube (formato simulado) ----
  const data = { contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [
    { itemSectionRenderer: { contents: [
      { videoRenderer: { videoId: 'AAAAAAAAAAA', title: { runs: [{ text: 'One More ' }, { text: 'Time' }] }, ownerText: { runs: [{ text: 'Daft Punk' }] }, lengthText: { simpleText: '5:20' }, thumbnail: { thumbnails: [{ url: 'http://t/a.jpg' }] } } },
      { shelfRenderer: { title: 'ignorado' } },
      { videoRenderer: { videoId: 'BBBBBBBBBBB', title: { runs: [{ text: 'Sem duração' }] } } },
    ] } },
    { continuationItemRenderer: {} },
  ] } } } } };
  const page = `<html><script>var ytInitialData = ${JSON.stringify(data)};</script></html>`;
  const found = parseSearchResults(page);
  check('resultados: lê só os vídeos', found.length === 2 && found[0].id === 'AAAAAAAAAAA' && found[0].title === 'One More Time' && found[0].channel === 'Daft Punk' && found[0].duration === '5:20');
  check('resultados: campos ausentes viram texto vazio', found[1].channel === '' && found[1].duration === '' && found[1].thumb === '');
  check('página diferente do esperado volta vazia (sem quebrar)', parseSearchResults('<html>nada</html>').length === 0 && parseSearchResults('var ytInitialData = {quebrado};</script>').length === 0 && parseSearchResults(undefined).length === 0);
  check('limita a 10 resultados', parseSearchResults(`<script>var ytInitialData = ${JSON.stringify({ contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: Array.from({ length: 25 }, (_, i) => ({ videoRenderer: { videoId: `V${i}` } })) } }] } } } } })};</script>`).length === 10);
  check('URL da busca escapa o texto', searchUrl('rock & roll?').includes('search_query=rock%20%26%20roll%3F'));

  // ---- Servidor local do app de desktop (HTTP de verdade) ----
  const root = path.join(__dirname, '..');
  const server = await startServer({ root, publicPaths: ['index.html', 'css', 'js', 'data'], port: 0 });
  const base = server.port;
  let res = await get(base, '/');
  check('/ entrega o index.html', res.status === 200 && res.type.startsWith('text/html') && res.body.includes('Gatinho Pomodoro'));
  res = await get(base, '/js/main.js');
  check('entrega scripts com o tipo certo', res.status === 200 && res.type.startsWith('text/javascript'));
  res = await get(base, '/css/app.css');
  check('entrega css', res.status === 200 && res.type.startsWith('text/css'));
  check('não entrega arquivos de fora do app', (await Promise.all(['/package.json', '/electron/main.js', '/tests/music.js', '/README.md', '/node_modules/x'].map((u) => get(base, u)))).every((r) => r.status === 404));
  check('bloqueia ../ e variações codificadas', (await Promise.all(['/../package.json', '/js/../package.json', '/%2e%2e/package.json', '/js/..%2f..%2fpackage.json', '/js/%00'].map((u) => get(base, u)))).every((r) => r.status === 404 || r.status === 400));
  check('endereço malformado não derruba o servidor', (await get(base, '/%E0%A4%A')).status === 400 && (await get(base, '/')).status === 200);
  server.close();
  const taken = await startServer({ root, publicPaths: ['index.html'], port: 0 });
  const busy = await startServer({ root, publicPaths: ['index.html'], port: taken.port });
  check('porta ocupada: usa outra em vez de falhar', busy.port !== taken.port && busy.port > 0);
  busy.close(); taken.close();

  console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
  process.exit(failures ? 1 : 0);
})();
