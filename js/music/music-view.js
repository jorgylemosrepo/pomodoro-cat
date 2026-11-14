/**
 * Atualiza na tela tudo que mostra a música tocando: a barrinha no palco, os botões ▶/⏸,
 * o título e o relógio no painel. Chamado a cada mudança do player.
 */
Gatinho.MusicView = {
  /** Abre um link no navegador do sistema (app de desktop) ou numa aba nova. */
  openExternal(url) {
    if (!url) return;
    if (window.desktop?.openExternal) window.desktop.openExternal(url);
    else window.open(url, '_blank', 'noopener');
  },

  render(root, music) {
    const playing = music.state === 'playing';
    const mini = root.querySelector('#music-mini');
    mini.hidden = !music.hasTrack;
    root.querySelector('#music-mini-title').textContent = music.title;
    for (const button of root.querySelectorAll('[data-music="toggle"]')) button.textContent = playing ? '⏸' : '▶';
    root.querySelector('[data-panel="music"]')?.classList.toggle('is-playing', playing);

    if (playing) {
      Gatinho.MusicPanel.problem = false; // voltou a tocar: o aviso de erro não vale mais
      const open = root.querySelector('#music-open');
      if (open) open.hidden = true;
    }
    const title = root.querySelector('#music-title'); // só existem com o painel aberto
    const time = root.querySelector('#music-time');
    if (title) title.textContent = music.title || 'Nada tocando';
    if (time) time.textContent = `${Gatinho.YouTube.formatTime(music.position)} / ${Gatinho.YouTube.formatTime(music.duration)}`;
  },
};
