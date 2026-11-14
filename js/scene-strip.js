/**
 * Tira de cenários abaixo do palco: um quadradinho para cada cenário que o jogador tem.
 * Se não couberem, aparecem setinhas nas pontas para rolar. Clicar num quadradinho troca o cenário.
 */
Gatinho.SceneStrip = class SceneStrip {
  /** @param {HTMLElement} root  elemento #app   @param {{onPick: (sceneId: string) => void}} handlers */
  constructor(root, { onPick }) {
    this.list = root.querySelector('#strip-list');
    this.arrows = [...root.querySelectorAll('[data-strip]')];
    this.key = '';
    root.addEventListener('click', (event) => {
      const scene = event.target.closest('[data-scene]');
      if (scene) onPick(scene.dataset.scene);
      const arrow = event.target.closest('[data-strip]');
      if (arrow) this.scroll(Number(arrow.dataset.strip));
    });
    this.list.addEventListener('scroll', () => this._updateArrows());
  }

  /** Desenha de novo só se os cenários ou o escolhido mudaram. */
  render(profile) {
    const owned = Gatinho.ITEMS.filter((item) => item.slot === 'scene' && profile.owns(item.id));
    const key = `${owned.map((item) => item.id)}|${profile.equipped.scene}`;
    if (key !== this.key) {
      this.key = key;
      this.list.innerHTML = owned
        .map((item) => `<button type="button" class="strip__item" data-scene="${item.id}" title="${Gatinho.html.escape(item.name)}" aria-pressed="${item.id === profile.equipped.scene}">${Gatinho.Scenery.thumbnail(item)}</button>`)
        .join('');
    }
    this._updateArrows();
  }

  /** Rola de 3 em 3 quadradinhos (direction: -1 ou 1). */
  scroll(direction) {
    this.list.scrollBy({ left: direction * 3 * 36, behavior: 'smooth' });
  }

  _updateArrows() {
    const { scrollLeft, scrollWidth, clientWidth } = this.list;
    const overflow = scrollWidth > clientWidth + 1;
    for (const arrow of this.arrows) {
      arrow.hidden = !overflow;
      arrow.disabled = Number(arrow.dataset.strip) < 0 ? scrollLeft <= 0 : scrollLeft + clientWidth >= scrollWidth - 1;
    }
  }
};
