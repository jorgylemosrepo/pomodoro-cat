/**
 * Ajudas para o YouTube: entender o que o jogador digitou (link de música, link de playlist
 * ou nome para buscar), buscar músicas e formatar tempos. Sem acesso à tela.
 */
(function () {
  const HOSTS = /(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i;
  const VIDEO_ID = /^[\w-]{11}$/;
  const LIST_ID = /^[\w-]{12,}$/;
  const RAW_PLAYLIST = /^(PL|OLAK5uy_|UU|FL|LL)[\w-]{10,}$/;
  const ENTITIES = { '&amp;': '&', '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>' };

  Gatinho.YouTube = {
    /**
     * Classifica o que foi digitado:
     *   { type: 'video', id } | { type: 'playlist', id } | { type: 'search', query } | null (link do YouTube sem música)
     */
    parse(input) {
      const text = String(input ?? '').trim();
      if (!text) return null;
      if (RAW_PLAYLIST.test(text)) return { type: 'playlist', id: text };

      const url = this._toUrl(text);
      if (!url) return { type: 'search', query: text };

      const list = url.searchParams.get('list');
      // "RD..." é um mix automático do YouTube: não toca em player incorporado, então tocamos só o vídeo
      if (list && LIST_ID.test(list) && !list.startsWith('RD')) return { type: 'playlist', id: list };
      const video = this._videoId(url);
      return video ? { type: 'video', id: video } : null;
    },

    /** Busca pelo nome. Usa a API oficial se houver chave; senão a busca do app de desktop (Electron). */
    async search(query, apiKey = '') {
      if (apiKey) {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=10&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
        const response = await fetch(url);
        const json = await response.json();
        if (!response.ok) throw new Error(json.error?.message ?? 'Erro na busca do YouTube.');
        return this.fromApi(json);
      }
      if (window.desktop?.searchYouTube) return window.desktop.searchYouTube(query);
      throw new Error('NO_SEARCH');
    },

    /** Resposta da API oficial -> [{ id, title, channel, duration, thumb }]. */
    fromApi(json) {
      return (json.items ?? [])
        .filter((item) => item.id?.videoId)
        .map((item) => ({
          id: item.id.videoId,
          title: this.decode(item.snippet?.title),
          channel: this.decode(item.snippet?.channelTitle),
          duration: '',
          thumb: item.snippet?.thumbnails?.default?.url ?? '',
        }));
    },

    decode(text = '') {
      return String(text).replace(/&(amp|quot|#39|lt|gt);/g, (entity) => ENTITIES[entity]);
    },

    /** 75 -> "1:15"; 3725 -> "1:02:05". */
    formatTime(seconds) {
      const total = Math.max(0, Math.floor(seconds || 0));
      const h = Math.floor(total / 3600);
      const m = Math.floor((total % 3600) / 60);
      const s = String(total % 60).padStart(2, '0');
      return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    },

    _toUrl(text) {
      if (/\s/.test(text)) return null;
      const known = /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i;
      const withScheme = /^https?:\/\//i.test(text) ? text : known.test(text) ? `https://${text}` : null;
      if (!withScheme) return null;
      try {
        const url = new URL(withScheme);
        return HOSTS.test(url.hostname) ? url : null;
      } catch {
        return null;
      }
    },

    _videoId(url) {
      const fromQuery = url.searchParams.get('v');
      if (fromQuery && VIDEO_ID.test(fromQuery)) return fromQuery;
      const [first, second] = url.pathname.split('/').filter(Boolean);
      const candidate = url.hostname.endsWith('youtu.be') ? first : ['embed', 'shorts', 'live', 'v'].includes(first) ? second : null;
      return candidate && VIDEO_ID.test(candidate) ? candidate : null;
    },
  };
})();
