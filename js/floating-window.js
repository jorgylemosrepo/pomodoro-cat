/**
 * Janela flutuante que fica acima de todas as outras.
 * Usa a API "Document Picture-in-Picture" (Chrome e Edge 116+).
 * O elemento do app é movido para a janela flutuante e volta ao fechá-la.
 */
Gatinho.FloatingWindow = {
  pip: null,

  get supported() {
    return 'documentPictureInPicture' in window;
  },

  /** Abre se estiver fechada, fecha se estiver aberta. Precisa de um clique do usuário. */
  async toggle(root) {
    if (this.pip) {
      this.pip.close();
      return;
    }
    const { width, height } = Gatinho.CONFIG.floatingWindow;
    const pip = await documentPictureInPicture.requestWindow({ width, height });

    // A janela nova começa sem estilos: copia os mesmos CSS da página.
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
      const copy = pip.document.createElement('link');
      copy.rel = 'stylesheet';
      copy.href = link.href;
      pip.document.head.append(copy);
    }

    pip.document.body.append(root);
    document.body.classList.add('is-floating');
    pip.addEventListener('pagehide', () => {
      document.body.append(root);
      document.body.classList.remove('is-floating');
      this.pip = null;
    });
    this.pip = pip;
  },

  close() {
    this.pip?.close();
  },
};
