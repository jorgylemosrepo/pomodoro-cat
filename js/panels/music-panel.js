/**
 * Painel "Música": digite o nome de uma música (busca no YouTube) ou cole o link de uma
 * música ou playlist. O vídeo aparece no quadrinho; ao fechar o painel o som continua
 * e o player sai da vista. Os botões ⏮ ▶ ⏭ usam data-music (tratados em main.js).
 */
Gatinho.MusicPanel = {
  id: 'music',
  icon: 'music',
  title: 'Música',
  tall: true, // precisa de altura para a busca, o vídeo e os controles caberem sem rolar
  results: [],
  status: '',
  problem: false, // true = a última tentativa falhou (mostra o botão "Abrir no YouTube")

  render(body, { profile, music, save, root }) {
    const { html, YouTube } = Gatinho;
    const wrap = document.createElement('div');
    wrap.className = 'music';

    if (!music.supported) {
      wrap.innerHTML = '<p class="note">Para tocar músicas, abra pelo app de desktop (<code>pnpm start</code>) ou sirva a pasta por um servidor local (ex.: <code>npx serve</code>). O YouTube não toca em arquivos abertos direto do disco.</p>';
      body.append(wrap);
      return;
    }

    wrap.innerHTML = `
      <form id="music-form" class="music__search">
        <input id="music-q" class="field field--grow" type="text" placeholder="Nome da música ou link do YouTube" autocomplete="off">
        <button type="submit" class="btn btn--primary" title="Buscar ou tocar">🔍</button>
      </form>
      <p id="music-status" class="music__status"></p>
      <button type="button" class="btn btn--small" id="music-open" hidden>↗ Abrir no YouTube</button>
      <ul id="music-results" class="list music__results"></ul>
      <div class="music__now">
        <div id="music-slot" class="music__slot"></div>
        <div class="music__side"><b id="music-title" class="music__title"></b><small id="music-time"></small></div>
      </div>
      <div class="music__controls">
        <button type="button" class="btn btn--icon" data-music="prev" title="Anterior">⏮</button>
        <button type="button" class="btn btn--icon" data-music="toggle" title="Tocar/pausar">▶</button>
        <button type="button" class="btn btn--icon" data-music="next" title="Próxima">⏭</button>
        <input id="music-vol" type="range" min="0" max="100" value="${profile.settings.musicVolume}" aria-label="Volume">
      </div>
      <details class="music__key"><summary>Chave da API do YouTube (opcional)</summary>
        <input id="music-key" class="field" type="password" placeholder="Cole a chave aqui" value="${html.escape(profile.settings.youtubeApiKey)}" autocomplete="off">
        <small>Sem chave, o app de desktop busca direto no YouTube. A chave (YouTube Data API v3) serve para buscar pelo navegador.</small>
      </details>`;
    body.append(wrap);

    const $ = (selector) => wrap.querySelector(selector);
    const showStatus = (text) => { this.status = text; $('#music-status').textContent = text; this.place(); };
    const showResults = () => {
      $('#music-results').innerHTML = this.results
        .map((r, i) => `<li><button type="button" class="music__item" data-index="${i}"><span class="ellipsis">${html.escape(r.title)}</span><small>${html.escape(r.channel)}${r.duration ? ` · ${html.escape(r.duration)}` : ''}</small></button></li>`)
        .join('');
      this.place(); // a lista mudou de tamanho: o vídeo precisa acompanhar
    };
    showStatus(this.status);
    showResults();
    this.statusEl = $('#music-status');
    this.openButton = $('#music-open');
    this.openButton.hidden = !this.problem;
    this.openButton.addEventListener('click', () => Gatinho.MusicView.openExternal(music.externalUrl()));

    $('#music-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const parsed = YouTube.parse($('#music-q').value);
      this.problem = false;
      this.openButton.hidden = true;
      if (!parsed) return showStatus('Não reconheci esse link do YouTube.');
      if (parsed.type !== 'search') {
        showStatus(parsed.type === 'playlist' ? 'Tocando a playlist…' : 'Tocando…');
        return music.play(parsed);
      }
      showStatus('Buscando…');
      try {
        this.results = await YouTube.search(parsed.query, profile.settings.youtubeApiKey);
        if (!wrap.isConnected) return;
        showStatus(this.results.length ? 'Escolha uma música:' : 'Nada encontrado.');
        showResults();
      } catch (error) {
        if (wrap.isConnected) showStatus(error.message === 'NO_SEARCH'
          ? 'Para buscar pelo nome, use o app de desktop ou informe a chave da API abaixo. Você também pode colar o link de uma música ou playlist.'
          : `Não deu para buscar: ${error.message}`);
      }
    });

    $('#music-results').addEventListener('click', (event) => {
      const item = event.target.closest('[data-index]');
      if (item) music.play({ type: 'queue', ids: this.results.map((r) => r.id), index: Number(item.dataset.index) });
    });
    $('#music-vol').addEventListener('input', (event) => {
      music.setVolume(Number(event.target.value));
      profile.settings.musicVolume = music.volume;
      save();
    });
    $('#music-key').addEventListener('change', (event) => {
      profile.settings.youtubeApiKey = event.target.value.trim();
      save();
    });

    // O vídeo fica fora do app (para não recarregar ao abrir/fechar painéis); aqui só reservamos o espaço.
    this.slot = $('#music-slot');
    this.music = music;
    this.body = body;
    this.onResize = () => this.place();
    window.removeEventListener('resize', this.onResize);
    window.addEventListener('resize', this.onResize);
    body.addEventListener('scroll', this.onResize); // mesma função: não acumula
    this.observer?.disconnect();
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(() => this.place());
      this.observer.observe(wrap);
    }
    this.place();
    setTimeout(() => this.place(), 220); // depois da animação de abertura do painel
    Gatinho.MusicView.render(root, music); // já mostra a faixa atual e o ▶/⏸ certo
  },

  /** Mostra um problema do player dentro do painel (a fala do gatinho fica escondida atrás dele). */
  notify(text) {
    this.status = text;
    this.problem = true;
    if (!this.statusEl?.isConnected) return;
    this.statusEl.textContent = text;
    this.openButton.hidden = false;
  },

  /** Coloca o vídeo exatamente sobre o espaço reservado (ou o esconde se o app está na janela flutuante). */
  place() {
    const host = this.music?.host;
    if (!host) return;
    if (!this.slot?.isConnected || this.slot.ownerDocument !== host.ownerDocument) return this.hide();
    const box = this.slot.getBoundingClientRect();
    const view = this.body.getBoundingClientRect();
    if (box.top < view.top - 1 || box.bottom > view.bottom + 1) return this.hide(); // rolou para fora: não deixa o vídeo flutuando
    Object.assign(host.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    host.classList.add('is-visible');
  },

  hide() {
    const host = this.music?.host;
    if (!host) return;
    host.classList.remove('is-visible');
    for (const property of ['left', 'top', 'width', 'height']) host.style.removeProperty(property);
  },

  /** O painel fechou: o som continua, mas o vídeo sai da vista. */
  onClose() {
    window.removeEventListener('resize', this.onResize);
    this.body?.removeEventListener('scroll', this.onResize);
    this.observer?.disconnect();
    this.hide();
    this.slot = null;
  },
};
