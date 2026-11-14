/**
 * Player de música: envolve o player incorporado do YouTube (IFrame API).
 * Eventos: "change" (estado, faixa ou tempo mudou) e "error" (detail = texto para o jogador).
 *
 * O YouTube só aceita ser incorporado em páginas servidas por http(s). Abrindo o index.html direto
 * do disco (file://) ele recusa; o app de desktop já serve a pasta por http://127.0.0.1.
 */
Gatinho.MusicPlayer = class MusicPlayer extends EventTarget {
  /** @param {HTMLElement} host  contém <div id="music-mount">, onde o YouTube cria o iframe */
  constructor(host, volume = 60) {
    super();
    this.host = host;
    this.volume = volume;
    this.player = null;
    this.loading = null;
    this.state = 'idle'; // idle | buffering | playing | paused | ended
    this.title = '';
    this.lastSource = null;
    this.watchdog = null;
    setInterval(() => this.state === 'playing' && this._emit('change'), 1000); // atualiza o relógio da faixa
  }

  get supported() {
    return location.protocol !== 'file:';
  }

  get hasTrack() {
    return this.state !== 'idle';
  }

  get position() {
    return this.player?.getCurrentTime?.() ?? 0;
  }

  get duration() {
    return this.player?.getDuration?.() ?? 0;
  }

  /** source: { type: 'video', id } | { type: 'playlist', id } | { type: 'queue', ids, index } */
  async play(source) {
    try {
      await this._ensurePlayer();
    } catch (error) {
      this._emit('error', error.message);
      return;
    }
    this.lastSource = source;
    this.state = 'buffering'; // uma música nova foi pedida: não está mais "tocando" até o YouTube confirmar
    if (source.type === 'video') this.player.loadVideoById(source.id);
    else if (source.type === 'playlist') this.player.loadPlaylist({ listType: 'playlist', list: source.id });
    else this.player.loadPlaylist({ playlist: source.ids, index: source.index ?? 0 });
    this._watch();
  }

  /** Endereço da música atual no YouTube (para abrir no navegador), ou null. */
  externalUrl() {
    const source = this.lastSource;
    if (source?.type === 'playlist') return `https://www.youtube.com/playlist?list=${source.id}`;
    const id = this.player?.getVideoData?.().video_id || (source?.type === 'video' ? source.id : source?.ids?.[source.index ?? 0]);
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
  }

  toggle() {
    if (this.state === 'playing') this.player?.pauseVideo();
    else this.player?.playVideo();
  }

  next() {
    this.player?.nextVideo();
  }

  prev() {
    this.player?.previousVideo();
  }

  setVolume(value) {
    this.volume = value;
    this.player?.setVolume(value);
  }

  /** Carrega a API do YouTube uma única vez e cria o player. */
  _ensurePlayer() {
    this.loading ??= new Promise((resolve, reject) => {
      const create = () => {
        this.player = new YT.Player('music-mount', {
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
          events: {
            onReady: () => { this.player.setVolume(this.volume); resolve(); },
            onStateChange: (event) => this._onState(event.data),
            onError: (event) => this._onError(event.data),
          },
        });
      };
      if (window.YT?.Player) return create();
      window.onYouTubeIframeAPIReady = create;
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.onerror = () => { this.loading = null; reject(new Error('Sem conexão com o YouTube.')); };
      document.head.append(script);
    });
    return this.loading;
  }

  /** Se o vídeo não começar a tocar a tempo, avisa (o player do YouTube às vezes mostra um erro e não diz nada). */
  _watch() {
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => {
      if (this.state === 'playing' || this.state === 'paused') return;
      this._emit('error', 'O YouTube não iniciou o vídeo. Tente outro ou abra no YouTube.');
    }, Gatinho.CONFIG.music.startTimeoutMs);
  }

  _onState(code) {
    if (code === 1) clearTimeout(this.watchdog);
    const states = { '-1': 'buffering', 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'paused' };
    this.state = states[code] ?? this.state;
    this.title = this.player.getVideoData?.().title ?? this.title;
    this._emit('change');
  }

  _onError(code) {
    const messages = {
      2: 'Link inválido.',
      5: 'Erro no player do YouTube.',
      100: 'Esse vídeo não está disponível.',
      101: 'O dono não permite tocar este vídeo fora do YouTube.',
      150: 'O dono não permite tocar este vídeo fora do YouTube.',
      153: 'O YouTube recusou a origem do app. Abra pelo app de desktop ou por um servidor local.',
    };
    clearTimeout(this.watchdog);
    this._emit('error', `${messages[code] ?? 'Não foi possível tocar.'} (código ${code})`);
    if ([100, 101, 150].includes(code)) this.next(); // pula para a próxima da fila, se houver
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }
};
