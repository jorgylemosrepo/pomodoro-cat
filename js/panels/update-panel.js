/**
 * Painel "Atualizações" (abre pelo botão 🔄 do cabeçalho): versão instalada, repositório do GitHub,
 * verificar agora, o que mudou na versão nova e como atualizar:
 *   - app instalado ou portátil: baixa o arquivo certo para o seu sistema (abre no navegador);
 *   - código-fonte (pnpm start): "git pull" com um clique, se a pasta for um repositório git.
 */
Gatinho.UpdatePanel = {
  id: 'update',
  title: 'Atualizações',
  rail: false, // não tem ícone na barra lateral: abre pelo botão 🔄 do cabeçalho
  note: '',
  pulling: false,
  pulled: null, // resultado do último git pull: { ok, output }

  KINDS: {
    source: 'Código-fonte (pnpm start)', 'win-installer': 'Instalado (Windows)', 'win-portable': 'Portátil (Windows)',
    appimage: 'Portátil (AppImage)', deb: 'Instalado (.deb)', rpm: 'Instalado (.rpm)', 'linux-package': 'Instalado (Linux)',
    mac: 'macOS', browser: 'Navegador',
  },

  render(body, { updates, actions, refresh }) {
    const { html } = Gatinho;
    const { status, message } = updates.state;
    const latest = updates.latest;
    const available = updates.available;
    const asset = updates.asset;
    const canPull = updates.info.canGitPull;
    const last = updates.settings.lastCheck ? new Date(updates.settings.lastCheck).toLocaleString('pt-BR') : 'nunca';
    const date = latest?.publishedAt ? new Date(latest.publishedAt).toLocaleDateString('pt-BR') : '';
    const kind = this.KINDS[updates.info.kind] ?? updates.info.kind;

    const release = available ? `
      <div class="card update__release">
        <div class="row"><b>Versão ${html.escape(latest.version)}</b><small>${html.escape(date)}</small></div>
        ${latest.notes ? `<pre class="update__notes">${html.escape(latest.notes.trim().slice(0, 900))}</pre>` : '<small>Sem notas de versão.</small>'}
        <div class="update__buttons">
          ${asset ? `<button type="button" class="btn btn--primary" data-url="${html.escape(asset.url)}">⬇ Baixar ${html.escape(asset.name)}</button>` : ''}
          ${canPull ? `<button type="button" class="btn btn--primary" id="up-pull" ${this.pulling ? 'disabled' : ''}>${this.pulling ? 'Atualizando…' : '⬇ Atualizar agora (git pull)'}</button>` : ''}
          <button type="button" class="btn" data-url="${html.escape(latest.url)}">Abrir a página da versão</button>
        </div>
        ${!asset && !canPull ? `<small>${latest.source === 'release' ? 'Não achei um arquivo para o seu sistema nessa versão: abra a página e baixe de lá.' : 'Esse repositório não tem releases: baixe o projeto pela página do GitHub.'}</small>` : ''}
        ${this.pulled ? `<pre class="update__notes ${this.pulled.ok ? '' : 'update__notes--error'}">${html.escape(this.pulled.output || (this.pulled.ok ? 'Pronto.' : 'Não deu certo.'))}</pre>` : ''}
        ${this.pulled?.ok ? '<small>Se as dependências mudaram, rode <code>pnpm install</code>. Reinicie o app para usar a versão nova.</small><button type="button" class="btn btn--primary" id="up-restart">↻ Reiniciar agora</button>' : ''}
      </div>` : '';

    const wrap = document.createElement('div');
    wrap.className = 'update';
    wrap.innerHTML = `
      ${this.note ? `<p class="note">${html.escape(this.note)}</p>` : ''}
      <div class="card">
        <div class="row"><b>Versão instalada</b><span>${html.escape(updates.current)}</span></div>
        <div class="row"><small>Tipo</small><small>${html.escape(kind)}</small></div>
      </div>
      <div class="card">
        <b>Repositório no GitHub</b>
        <div class="row"><input id="up-repo" class="field field--grow" type="text" placeholder="usuario/repositorio" value="${html.escape(updates.settings.repo)}" autocomplete="off"><button type="button" class="btn btn--small" id="up-save">Salvar</button></div>
        <small>${updates.repo ? `Verificando <b>${html.escape(updates.repo)}</b>. Cole <i>usuario/repositorio</i> ou o endereço do GitHub para trocar.` : 'Informe o repositório do projeto (usuario/repositorio ou o endereço do GitHub). Precisa ser público.'}</small>
      </div>
      <div class="card">
        <div class="row"><button type="button" class="btn btn--primary" id="up-check" ${status === 'checking' || !updates.repo ? 'disabled' : ''}>🔄 Verificar agora</button><small>Última: ${html.escape(last)}</small></div>
        ${message ? `<p class="update__status update__status--${status}">${html.escape(message)}</p>` : ''}
      </div>
      ${release}
      <label class="card row"><b>Verificar sozinho (1x por dia)</b><input type="checkbox" id="up-auto" ${updates.settings.auto ? 'checked' : ''}></label>`;

    const $ = (selector) => wrap.querySelector(selector);
    $('#up-save').addEventListener('click', () => { this.note = actions.saveRepo($('#up-repo').value); refresh(); });
    $('#up-repo').addEventListener('keydown', (event) => { if (event.key === 'Enter') $('#up-save').click(); });
    $('#up-check').addEventListener('click', () => { this.note = ''; this.pulled = null; actions.checkUpdates(); });
    $('#up-auto').addEventListener('change', (event) => actions.setAutoUpdate(event.target.checked));
    wrap.addEventListener('click', (event) => {
      const link = event.target.closest('[data-url]');
      if (link) actions.openUpdateUrl(link.dataset.url);
    });
    $('#up-pull')?.addEventListener('click', async () => {
      this.pulling = true;
      this.pulled = null;
      refresh();
      this.pulled = await actions.gitPull();
      this.pulling = false;
      refresh();
    });
    $('#up-restart')?.addEventListener('click', () => actions.restartApp());
    body.append(wrap);
  },
};
