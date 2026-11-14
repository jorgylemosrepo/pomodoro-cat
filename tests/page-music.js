/**
 * Testa o painel de música na página inteira, servida por HTTP de verdade e com um YouTube simulado
 * (não acessa a internet). Requer: pnpm add -D jsdom (ou npm i -D jsdom).
 */
const path = require('path');
let jsdom;
try { jsdom = require('jsdom'); } catch { console.log('Instale o jsdom para rodar este teste: pnpm add -D jsdom'); process.exit(0); }
const { JSDOM, VirtualConsole } = jsdom;
const { startServer } = require('../electron/static-server');

const KEY = 'gatinho-pomodoro:v1';
const SAVE = { pet: { life: { name: 'Mingau', adopted: true, gender: 'm', bornAt: Date.now() - 20 * 86400000 } }, profile: { coins: 10 } };
let fails = 0;
const ok = (name, cond, extra = '') => { if (!cond) fails++; console.log(`${cond ? 'OK   ' : 'FALHA'} ${name}${extra ? ` (${extra})` : ''}`); };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Espera a condição ficar verdadeira (até 10 s). Evita depender de um tempo fixo para a página carregar. */
async function waitFor(condition, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (condition()) return true;
    await wait(25);
  }
  return false;
}

/** YouTube de mentira: guarda as chamadas e deixa o teste disparar os eventos do player. */
function fakeYouTube(w) {
  const fake = { instance: null };
  w.YT = { Player: class {
    constructor(id, options) { this.id = id; this.options = options; this.calls = []; this.title = ''; fake.instance = this; w.setTimeout(() => options.events.onReady(), 0); }
    loadVideoById(id) { this.calls.push(['video', id]); }
    loadPlaylist(arg) { this.calls.push(['playlist', arg]); }
    playVideo() { this.calls.push(['play']); } pauseVideo() { this.calls.push(['pause']); }
    nextVideo() { this.calls.push(['next']); } previousVideo() { this.calls.push(['prev']); }
    setVolume(v) { this.calls.push(['volume', v]); }
    getVideoData() { return { title: this.title }; } getCurrentTime() { return 75; } getDuration() { return 200; }
    emitState(code, title = this.title) { this.title = title; this.options.events.onStateChange({ data: code }); }
    emitError(code) { this.options.events.onError({ data: code }); }
  } };
  return fake;
}

async function open(url, { desktop, save = SAVE } = {}) {
  const errors = []; const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push(e.message)); vc.on('error', (e) => errors.push(String(e)));
  const store = { [KEY]: JSON.stringify(save) };
  let fake;
  const dom = await JSDOM.fromURL(url, {
    runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      Object.defineProperty(w, 'localStorage', { value: { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v) } });
      fake = fakeYouTube(w);
      if (desktop) w.desktop = desktop;
    },
  });
  const d = dom.window.document;
  await waitFor(() => d.querySelector('[data-panel="settings"]') && d.querySelector('#cat-name')?.textContent === 'Mingau');
  return { w: dom.window, d, q: (s) => d.querySelector(s), qa: (s) => [...d.querySelectorAll(s)], fake, errors, saved: () => JSON.parse(store[KEY]) };
}
const submit = (w, q, text) => { q('#music-q').value = text; q('#music-form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true })); };

(async () => {
  const server = await startServer({ root: path.join(__dirname, '..'), publicPaths: ['index.html', 'css', 'js', 'data'], port: 0 });
  const url = `http://127.0.0.1:${server.port}/`;
  const found = [
    { id: 'AAAAAAAAAAA', title: 'Primeira', channel: 'Canal A', duration: '3:10', thumb: '' },
    { id: 'BBBBBBBBBBB', title: 'Segunda <b>x</b>', channel: 'Canal B', duration: '4:00', thumb: '' },
  ];
  const searched = [];
  let { w, d, q, qa, fake, errors, saved } = await open(url, { desktop: { searchYouTube: async (text) => { searched.push(text); return found; } } });

  ok('painel de música está na barra', qa('#toolbar [data-panel]').map((b) => b.dataset.panel).includes('music'));
  q('[data-panel="music"]').click();
  ok('abre embaixo, com formulário e espaço do vídeo', !q('#panel').hidden && q('#panel-title').textContent === 'Música' && !!q('#music-form') && !!q('#music-slot'));
  ok('o vídeo é posicionado sobre o espaço reservado', q('#music-host').classList.contains('is-visible'));
  ok('painel de música é alto (não rola) e não cobre a barra de ícones', q('#panel').classList.contains('panel--tall') && !q('#panel').classList.contains('panel--full'));
  q('[data-panel="shop"]').click();
  ok('os outros painéis continuam no tamanho normal', !q('#panel').classList.contains('panel--tall'));
  q('[data-panel="music"]').click();
  ok('mini player escondido sem música', q('#music-mini').hidden);

  // link de música
  submit(w, q, 'https://youtu.be/dQw4w9WgXcQ?si=x');
  await wait(50);
  ok('link de música: cria o player e toca o vídeo', fake.instance?.id === 'music-mount' && fake.instance.calls.some((c) => c[0] === 'video' && c[1] === 'dQw4w9WgXcQ'), JSON.stringify(fake.instance?.calls));
  ok('volume inicial aplicado', fake.instance.calls.some((c) => c[0] === 'volume' && c[1] === 60));
  fake.instance.emitState(1, 'Never Gonna Give You Up');
  ok('tocando: mini player aparece com o título', !q('#music-mini').hidden && q('#music-mini-title').textContent === 'Never Gonna Give You Up');
  ok('botões mostram ⏸ e o ícone pulsa', q('#music-mini [data-music="toggle"]').textContent === '⏸' && q('[data-panel="music"]').classList.contains('is-playing'));
  ok('painel mostra título e tempo', q('#music-title').textContent === 'Never Gonna Give You Up' && q('#music-time').textContent === '1:15 / 3:20');

  // controles
  q('#music-mini [data-music="toggle"]').click();
  ok('⏯ pausa', fake.instance.calls.at(-1)[0] === 'pause');
  fake.instance.emitState(2);
  ok('pausado: botão volta para ▶ e para de pulsar', q('#music-mini [data-music="toggle"]').textContent === '▶' && !q('[data-panel="music"]').classList.contains('is-playing'));
  q('#music-mini [data-music="toggle"]').click();
  ok('▶ retoma', fake.instance.calls.at(-1)[0] === 'play');
  q('[data-music="next"]').click(); q('[data-music="prev"]').click();
  ok('⏭ e ⏮', fake.instance.calls.slice(-2).map((c) => c[0]).join() === 'next,prev');

  // playlist
  submit(w, q, 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  await wait(30);
  ok('link de playlist: carrega a playlist inteira', fake.instance.calls.at(-1)[0] === 'playlist' && fake.instance.calls.at(-1)[1].list === 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf' && fake.instance.calls.at(-1)[1].listType === 'playlist');
  submit(w, q, 'https://www.youtube.com/');
  ok('link do YouTube sem música é recusado', q('#music-status').textContent.includes('Não reconheci'));

  // busca por nome
  submit(w, q, 'lofi para programar');
  await wait(50);
  ok('busca pelo nome usa o app de desktop', searched[0] === 'lofi para programar' && qa('.music__item').length === 2, qa('.music__item').length);
  ok('resultado com HTML é mostrado como texto', !qa('.music__item b').length && q('.music__results').textContent.includes('Segunda <b>x</b>'));
  qa('.music__item')[1].click();
  await wait(30);
  ok('clicar no resultado toca a fila a partir dele', fake.instance.calls.at(-1)[0] === 'playlist' && fake.instance.calls.at(-1)[1].index === 1 && fake.instance.calls.at(-1)[1].playlist.join() === 'AAAAAAAAAAA,BBBBBBBBBBB');

  // volume e chave
  q('#music-vol').value = '35'; q('#music-vol').dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('volume muda o player e é salvo', fake.instance.calls.at(-1).join() === 'volume,35' && saved().profile.settings.musicVolume === 35);
  q('#music-key').value = '  ABC123  '; q('#music-key').dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('chave da API é salva sem espaços', saved().profile.settings.youtubeApiKey === 'ABC123');

  // erros
  fake.instance.emitError(153);
  ok('erro 153 explica o que fazer', q('#message').textContent.includes('recusou a origem'), q('#message').textContent);
  const before = fake.instance.calls.length;
  fake.instance.emitError(150);
  ok('vídeo bloqueado pula para a próxima', fake.instance.calls.slice(before).some((c) => c[0] === 'next'));

  // o erro aparece DENTRO do painel (a fala do gatinho fica escondida atrás dele) e oferece uma saída
  ok('erro aparece no painel com o código (o último foi o 150)', q('#music-status').textContent.includes('fora do YouTube') && q('#music-status').textContent.includes('código 150'), q('#music-status').textContent);
  ok('erro oferece abrir no YouTube', !q('#music-open').hidden);
  let opened = null;
  w.open = (...args) => { opened = args; };
  q('#music-open').click();
  ok('abrir no YouTube usa a música atual', opened?.[0] === 'https://www.youtube.com/watch?v=BBBBBBBBBBB' && opened[2] === 'noopener', JSON.stringify(opened));
  fake.instance.emitState(1, 'Voltou a tocar');
  ok('voltou a tocar: o aviso e o botão somem', q('#music-open').hidden);

  // o YouTube às vezes mostra "Ocorreu um erro" sem avisar: o app detecta que não começou
  w.Gatinho.CONFIG.music.startTimeoutMs = 80;
  submit(w, q, 'https://youtu.be/dQw4w9WgXcQ');
  await wait(250);
  ok('vídeo que não inicia: avisa e oferece o link', q('#music-status').textContent.includes('não iniciou') && !q('#music-open').hidden, q('#music-status').textContent);
  submit(w, q, 'https://youtu.be/9bZkp7q19f0');
  await wait(20);
  fake.instance.emitState(1, 'Rápido');
  await wait(250);
  ok('vídeo que inicia a tempo não gera aviso', !q('#music-status').textContent.includes('não iniciou'));
  w.Gatinho.CONFIG.music.startTimeoutMs = 12000;

  // fechar e trocar de painel: a música continua
  q('[data-panel="music"]').click();
  ok('fechar o painel esconde o vídeo mas não pausa', !q('#music-host').classList.contains('is-visible') && !fake.instance.calls.slice(-3).some((c) => c[0] === 'pause'));
  ok('o mini player continua com os controles', !q('#music-mini').hidden);
  q('[data-panel="music"]').click(); q('[data-panel="shop"]').click();
  ok('trocar de painel também esconde o vídeo', !q('#music-host').classList.contains('is-visible'));
  q('[data-panel="music"]').click();
  ok('reabrir mostra o título atual e o vídeo de novo', q('#music-host').classList.contains('is-visible') && q('#music-title').textContent !== '');
  ok('sem erros de execução', errors.length === 0, errors.join('; '));

  // busca sem desktop e sem chave
  ({ w, q, errors } = await open(url));
  q('[data-panel="music"]').click();
  submit(w, q, 'qualquer coisa'); await wait(50);
  ok('sem desktop e sem chave: explica como buscar', q('#music-status').textContent.includes('app de desktop') && q('#music-status').textContent.includes('chave'));

  // busca pela API com chave
  ({ w, q, errors } = await open(url, { save: { ...SAVE, profile: { settings: { youtubeApiKey: 'K' } } } }));
  w.fetch = async () => ({ ok: true, json: async () => ({ items: [{ id: { videoId: 'CCCCCCCCCCC' }, snippet: { title: 'Via API &amp; cia', channelTitle: 'X' } }] }) });
  q('[data-panel="music"]').click();
  submit(w, q, 'api'); await wait(50);
  ok('com chave: busca pela API oficial', q('.music__item') && q('.music__item span').textContent === 'Via API & cia');
  server.close();

  // aberto direto do disco (file://): avisa em vez de tentar tocar
  ({ w, q, errors } = await (async () => {
    const vc = new VirtualConsole(); const errs = [];
    vc.on('jsdomError', (e) => errs.push(e.message));
    const dom = await JSDOM.fromFile(path.join(__dirname, '..', 'index.html'), { runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(x) { Object.defineProperty(x, 'localStorage', { value: { getItem: () => JSON.stringify(SAVE), setItem() {} } }); } });
    await waitFor(() => dom.window.document.querySelector('[data-panel="music"]'));
    return { w: dom.window, q: (s) => dom.window.document.querySelector(s), errors: errs };
  })());
  q('[data-panel="music"]').click();
  ok('file://: o painel explica o servidor local e não tenta tocar', q('#panel-body').textContent.includes('servidor local') && !q('#music-form') && errors.length === 0, errors.join('; '));

  console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
  process.exit(fails ? 1 : 0);
})();
