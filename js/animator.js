/**
 * Controla qual cena (animação) o gatinho mostra.
 *  - Cena base: decidida pelo estado do jogo (resolveBase).
 *  - Sequência: cenas temporárias, ex.: comer -> comemorar. Depois volta à base.
 */
Gatinho.Animator = class Animator {
  /**
   * @param {SVGElement} svg           o SVG do gatinho
   * @param {() => string} resolveBase retorna o nome da cena base atual
   */
  constructor(svg, resolveBase) {
    this.svg = svg;
    this.resolveBase = resolveBase;
    this.queue = [];
    this.busy = false;
    this.timer = null;
    this.current = null;
  }

  /** Toca uma sequência [{ scene, ms }] e depois volta à cena base. */
  play(steps) {
    clearTimeout(this.timer);
    this.queue = [...steps];
    this._next();
  }

  /** Reavalia a cena base (ignorado enquanto uma sequência está tocando). */
  refresh() {
    if (!this.busy) this._show(this.resolveBase());
  }

  _next() {
      const step = this.queue.shift();
      if (!step) {
        this.busy = false;
        this._show(this.resolveBase(), true);
        return;
      }
      this._show(step.scene, true);
      this.timer = setTimeout(() => this._next(), step.ms);
    }

  _show(scene, restart = false) {
    if (this.current === scene && !restart) return;
    if (restart) {
      this.svg.setAttribute('class', '');
      void this.svg.getBoundingClientRect(); // força o navegador a reiniciar a animação
    }
    this.svg.setAttribute('class', `s-${scene}`);
    this.current = scene;
  }
};
