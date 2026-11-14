/** Guarda-roupa: encontra itens do catálogo e aplica cor, roupinhas e tema da janela (o cenário é desenhado por Gatinho.Scenery). */
Gatinho.Wardrobe = {
  item(id) {
    return Gatinho.ITEMS.find((item) => item.id === id);
  },

  /** Encaixes de roupinha desenhados dentro do SVG do gatinho. */
  slots: ['hat', 'face', 'neck'],

  /** Variáveis CSS que um tema da janela pode mudar (ver data/items.js). */
  themeVars: ['--bg', '--fg', '--surface', '--muted', '--line', '--accent', '--stage-sky', '--stage-floor'],

  /**
   * Desenha o visual escolhido no gatinho.
   * @param {SVGElement} svg      o SVG do gatinho
   * @param {object} equipped     { coat, hat, face, neck } com ids de itens (ou null)
   */
  apply(svg, equipped) {
    const coat = this.item(equipped.coat) ?? this.item(Gatinho.CONFIG.defaultCoat);
    svg.style.setProperty('--coat', coat.coat);
    svg.style.setProperty('--ear', coat.ear);
    for (const slot of this.slots) {
      svg.querySelector(`#slot-${slot}`).innerHTML = this.item(equipped[slot])?.svg ?? '';
    }
  },

  /**
   * Pinta a janela inteira com o tema escolhido: cores da interface, do palco, barras de rolagem e campos.
   * As variáveis vão no #app e no <html> do documento onde ele está (na janela flutuante é outro documento;
   * chame de novo depois de mover). Tema padrão = remove tudo e volta a seguir o claro/escuro do sistema.
   * Retorna o tema aplicado.
   */
  applyTheme(root, equipped) {
    const theme = this.item(equipped.theme) ?? this.item(Gatinho.CONFIG.defaultTheme);
    for (const target of [root, root.ownerDocument.documentElement]) {
      for (const name of this.themeVars) {
        if (theme.vars[name]) target.style.setProperty(name, theme.vars[name]);
        else target.style.removeProperty(name);
      }
      target.style.colorScheme = theme.scheme ?? '';
    }
    return theme;
  },

  /** "dark" se o fundo do palco é escuro (noite ou luz apagada): o gatinho ganha um contorno claro para não sumir. */
  stageTone(equipped, dark, prefersDark = false) {
    if (dark) return 'dark';
    const scene = this.item(equipped.scene) ?? this.item(Gatinho.CONFIG.defaultScene);
    if (scene.id !== Gatinho.CONFIG.defaultScene) return scene.dark ? 'dark' : 'light';
    const theme = this.item(equipped.theme) ?? this.item(Gatinho.CONFIG.defaultTheme);
    return (theme.dark ?? (theme.scheme ? false : prefersDark)) ? 'dark' : 'light';
  },

  /** HTML da prévia de um item (bolinha de cor, tema, cenário ou desenho recortado). */
  preview(item) {
    if (item.slot === 'coat') return `<span class="swatch" style="--c:${item.coat}"></span>`;
    if (item.slot === 'theme') return `<span class="swatch" style="--c:linear-gradient(135deg, ${item.swatch[0]} 50%, ${item.swatch[1]} 50%)"></span>`;
    if (item.slot === 'scene') {
      const [wall, floor] = item.wall ? [item.wall, item.floor] : ['#ffe9cf', '#f6cfa3'];
      return `<span class="swatch" style="--c:linear-gradient(180deg, ${wall} 60%, ${floor} 60%)"></span>`;
    }
    if (item.slot === 'supply') return `<span class="supply-icon">${item.icon}</span>`;
    if (item.slot === 'furniture') {
      const pad = 6;
      return `<svg class="preview" viewBox="${-item.w / 2 - pad} ${-item.h - pad} ${item.w + pad * 2} ${item.h + pad * 2}" aria-hidden="true">${item.svg}</svg>`;
    }
    const { viewBox } = Gatinho.SLOTS.find((slot) => slot.id === item.slot);
    return `<svg class="preview" viewBox="${viewBox}" aria-hidden="true">${item.svg}</svg>`;
  },
};
