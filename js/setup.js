/**
 * Tela de escolha do felino: gênero e nome. Aparece antes do jogo (primeiro uso)
 * e também ao reviver o gatinho. Só desenha e valida o preenchimento; quem decide o que
 * fazer com a escolha é o main.js (callback onConfirm).
 */
Gatinho.Setup = class Setup {
  constructor(root) {
    this.el = root.querySelector('#setup');
    this.gender = null;
    this.onConfirm = null;

    this.el.addEventListener('click', (event) => {
      const gender = event.target.closest('[data-gender]');
      if (gender) this._pick(gender.dataset.gender);
      if (event.target.closest('#setup-dice')) this._suggestName();
      if (event.target.closest('#setup-cancel')) this.close();
    });
    this.$('#setup-name').addEventListener('input', () => this._sync());
    this.$('#setup-form').addEventListener('submit', (event) => {
      event.preventDefault();
      this._confirm();
    });
  }

  $(selector) {
    return this.el.querySelector(selector);
  }

  /**
   * @param {{title: string, name?: string, gender?: 'm'|'f'|null, confirmLabel?: string, cancellable?: boolean}} options
   * @param {({name, gender}) => ({ok: boolean, reason?: string})} onConfirm  deve retornar { ok } ou { ok: false, reason }
   */
  open({ title, name = '', gender = null, confirmLabel = 'Começar', cancellable = false }, onConfirm) {
    this.onConfirm = onConfirm;
    this.$('#setup-title').textContent = title;
    this.$('#setup-name').value = name;
    this.$('#setup-go').textContent = confirmLabel;
    this.$('#setup-cancel').hidden = !cancellable;
    this.$('#setup-error').textContent = '';
    this._pick(gender);
    this.el.hidden = false;
    this.$('#setup-name').focus();
  }

  close() {
    this.el.hidden = true;
  }

  _pick(gender) {
    this.gender = gender;
    for (const button of this.el.querySelectorAll('[data-gender]')) button.setAttribute('aria-pressed', button.dataset.gender === gender);
    this._sync();
  }

  /** O botão só liga com gênero escolhido e nome preenchido. */
  _sync() {
    this.$('#setup-go').disabled = !(this.gender && this.$('#setup-name').value.trim());
  }

  _suggestName() {
    const { names } = Gatinho.CONFIG.life;
    const list = this.gender ? names[this.gender] : [...names.m, ...names.f];
    this.$('#setup-name').value = Gatinho.random.pick(list);
    this._sync();
  }

  _confirm() {
    if (this.$('#setup-go').disabled) return;
    const result = this.onConfirm({ name: this.$('#setup-name').value, gender: this.gender });
    if (result?.ok === false) this.$('#setup-error').textContent = result.reason;
    else this.close();
  }
};
