/**
 * Gerencia as "janelinhas" (painéis) do app: histórico, conquistas, e as próximas (loja, inventário...).
 * Só uma fica aberta por vez, por cima do conteúdo, dentro da mesma janela do app.
 * Clicar no ícone da barra abre/fecha; ✕ e Esc também fecham.
 *
 * Para criar um painel novo:
 *   Gatinho.MeuPainel = { id: 'meu', icon: 'star', title: 'Meu painel', render(body, context) { body.innerHTML = '...'; } };
 *   e registre em main.js: panels.register(Gatinho.MeuPainel);
 * Por padrão o painel abre só na parte de baixo, deixando o gatinho e a barra de ícones visíveis.
 * Com rail: false ele não ganha ícone na barra (abre por um botão com data-panel="id" em qualquer lugar).
 * Com tall: true ele fica mais alto (cobre a parte de baixo do palco, mas não a barra de ícones).
 * Com full: true ele ocupa a janela quase toda.
 * "context" dá acesso a root, profile, pet, music, actions, save(), refresh() e updateBadges().
 * Um painel pode ter onClose(context), chamado quando ele fecha ou outro painel abre.
 */
Gatinho.PanelManager = class PanelManager {
  constructor(root, context) {
    this.root = root;
    this.context = context;
    this.panels = new Map();
    this.openId = null;
    this.toolbar = root.querySelector('#toolbar');
    this.host = root.querySelector('#panel');
    this.title = root.querySelector('#panel-title');
    this.body = root.querySelector('#panel-body');

    root.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-panel]');
      if (toggle) this.toggle(toggle.dataset.panel);
      if (event.target.closest('[data-panel-close]')) this.close();
    });
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') this.close();
    });
  }

  register(panel) {
    this.panels.set(panel.id, panel);
    if (panel.rail === false) return; // abre por outro botão (ex.: 🔄 do cabeçalho)
    this.toolbar.insertAdjacentHTML(
      'beforeend',
      `<button type="button" class="btn btn--icon" data-panel="${panel.id}" title="${panel.title}" aria-pressed="false">${Gatinho.html.icon(panel.icon, 18)}<i class="badge" hidden></i></button>`
    );
  }

  toggle(id) {
    if (this.openId === id) this.close();
    else this.open(id);
  }

  open(id) {
    this.panels.get(this.openId)?.onClose?.(this.context); // trocando de painel: avisa o anterior
    const panel = this.panels.get(id);
    this.openId = id;
    this.title.textContent = panel.title;
    this.host.classList.toggle('panel--full', Boolean(panel.full)); // padrão: abre embaixo, deixando o gatinho visível
    this.host.classList.toggle('panel--tall', Boolean(panel.tall)); // mais alto, mas sem cobrir a barra de ícones
    this.host.hidden = false;
    this._render();
    this._syncButtons();
    this.host.focus(); // para o Esc funcionar
  }

  close() {
    if (!this.openId) return;
    this.panels.get(this.openId).onClose?.(this.context);
    this.openId = null;
    this.host.hidden = true;
    this.body.replaceChildren();
    this._syncButtons();
  }

  /** Redesenha o painel aberto (use depois que os dados mudarem). */
  refresh() {
    if (this.openId) this._render();
  }

  /** Bolinha vermelha com número em cima do ícone (0 esconde). */
  setBadge(id, count) {
    const badge = this.root.querySelector(`[data-panel="${id}"] .badge`);
    if (!badge) return;
    badge.hidden = !count;
    badge.textContent = count;
  }

  _render() {
    this.body.replaceChildren();
    this.panels.get(this.openId).render(this.body, this.context);
  }

  _syncButtons() {
    for (const button of this.root.querySelectorAll('[data-panel]')) {
      button.setAttribute('aria-pressed', button.dataset.panel === this.openId);
    }
  }
};
