/** Notificações do sistema (timer terminou, conquista...). Só com permissão do jogador. */
Gatinho.Notify = {
  enabled: false,

  get supported() {
    return typeof Notification !== 'undefined';
  },

  get permitted() {
    return this.supported && Notification.permission === 'granted';
  },

  /** Liga as notificações, pedindo permissão se for preciso. Retorna { ok, reason }. */
  async enable() {
    if (!this.supported) return { ok: false, reason: 'Este navegador não tem notificações.' };
    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    this.enabled = permission === 'granted';
    return this.enabled ? { ok: true } : { ok: false, reason: 'A permissão foi negada. Libere nas configurações do sistema.' };
  },

  disable() {
    this.enabled = false;
  },

  show(title, body) {
    if (!this.enabled || !this.permitted) return;
    try {
      new Notification(title, { body, silent: true }); // o som é nosso (Gatinho.Sound)
    } catch {
      /* algumas plataformas bloqueiam: sem problema */
    }
  },
};
