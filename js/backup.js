/** Backup do progresso: gera e lê o arquivo .json (o mesmo texto que fica salvo no navegador, com um cabeçalho). */
Gatinho.Backup = {
  VERSION: 1,
  MAX_CHARS: 5 * 1024 * 1024,

  serialize(save, now = Date.now()) {
    return JSON.stringify({ app: 'gatinho-pomodoro', version: this.VERSION, exportedAt: new Date(now).toISOString(), data: save }, null, 2);
  },

  fileName(now = Date.now()) {
    return `gatinho-backup-${new Date(now).toISOString().slice(0, 10)}.json`;
  },

  /** Lê um backup (com cabeçalho) ou um save puro. Retorna { ok, data } ou { ok: false, reason }. */
  parse(text) {
    if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'O arquivo está vazio.' };
    if (text.length > this.MAX_CHARS) return { ok: false, reason: 'O arquivo é grande demais.' };
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'Isso não parece um backup do Gatinho (JSON inválido).' };
    }
    const data = json?.app === 'gatinho-pomodoro' ? json.data : json;
    const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
    if (!isObject(data) || !(isObject(data.pet) || isObject(data.profile))) return { ok: false, reason: 'Não encontrei o progresso do gatinho nesse arquivo.' };
    if (json?.version > this.VERSION) return { ok: false, reason: 'Esse backup é de uma versão mais nova do app.' };
    return { ok: true, data };
  },

  /** Baixa o arquivo (no documento onde o app está: na janela flutuante é outro). */
  download(text, name, doc = document) {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const link = doc.createElement('a');
    link.href = url;
    link.download = name;
    doc.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
