/**
 * Editor de móveis no palco: clique num móvel para selecioná-lo (aparece o "transformer": caixa com
 * cantos TRAVADOS, porque o tamanho dos móveis é fixo), arraste para mudar de lugar e use as setas para
 * ajustar. Delete guarda o móvel de volta no inventário e Esc sai da edição.
 * Só mexe nas posições; salvar e redesenhar é com o main.js (callbacks).
 */
Gatinho.FurnitureEditor = class FurnitureEditor {
  /**
   * @param {SVGElement} svg
   * @param {{getPlacements: () => object[], lookup: (id) => object, onChange: () => void, onStore: (index: number) => void, onToggle: (editing: boolean) => void}} hooks
   */
  constructor(svg, hooks) {
    this.svg = svg;
    this.hooks = hooks;
    this.editing = false;
    this.selected = null;
    this.drag = null;

    svg.addEventListener('pointerdown', (event) => this._down(event));
    svg.addEventListener('pointermove', (event) => this._move(event));
    svg.addEventListener('pointerup', () => this._up());
    svg.addEventListener('pointercancel', () => this._up());
    svg.ownerDocument.addEventListener('keydown', (event) => this._key(event));
  }

  setEditing(editing) {
    this.editing = editing;
    this.selected = null;
    this.drag = null;
    this.hooks.onToggle(editing);
  }

  select(index) {
    this.selected = index;
  }

  _down(event) {
    if (!this.editing) return;
    if (event.target.closest?.('.transformer')) { // cantos e cadeado: o tamanho é fixo, então não fazem nada (e não desmarcam)
      event.preventDefault();
      return;
    }
    const furniture = event.target.closest?.('.fur');
    if (!furniture) {
      this.selected = null;
      this.hooks.onChange(false);
      return;
    }
    const index = Number(furniture.dataset.index);
    const entry = this.hooks.getPlacements()[index];
    const point = Gatinho.Scenery.toSvgPoint(this.svg, event.clientX, event.clientY);
    this.selected = index;
    this.drag = { index, dx: point.x - entry.x, dy: point.y - entry.y, moved: false };
    this.svg.setPointerCapture?.(event.pointerId);
    this.hooks.onChange(false); // mostra o transformer já no clique
    event.preventDefault();
  }

  _move(event) {
    if (!this.drag) return;
    const { index, dx, dy } = this.drag;
    const entry = this.hooks.getPlacements()[index];
    const point = Gatinho.Scenery.toSvgPoint(this.svg, event.clientX, event.clientY);
    this._moveTo(index, entry, point.x - dx, point.y - dy);
    this.drag.moved = true;
  }

  _up() {
    const moved = this.drag?.moved;
    this.drag = null;
    if (moved) this.hooks.onChange(true); // soltou: salva
  }

  _key(event) {
    if (!this.editing) return;
    if (event.key === 'Escape') {
      this.setEditing(false);
      this.hooks.onChange(true);
      return;
    }
    if (this.selected == null) return;
    if (event.key === 'Delete' || event.key === 'Backspace') {
      this.hooks.onStore(this.selected);
      event.preventDefault();
      return;
    }
    const step = event.shiftKey ? 16 : 4;
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!delta) return;
    const entry = this.hooks.getPlacements()[this.selected];
    this._moveTo(this.selected, entry, entry.x + delta[0], entry.y + delta[1]);
    this.hooks.onChange(true);
    event.preventDefault();
  }

  /** Move respeitando os limites do cenário e já atualiza o desenho (sem esperar o redesenho completo). */
  _moveTo(index, entry, x, y) {
    const item = this.hooks.lookup(entry.id);
    Object.assign(entry, Gatinho.Scenery.clamp(item, x, y));
    const transform = `translate(${entry.x} ${entry.y})`;
    this.svg.querySelector(`.fur[data-index="${index}"]`)?.setAttribute('transform', transform);
    this.svg.querySelector('.transformer')?.setAttribute('transform', transform);
  }
};
