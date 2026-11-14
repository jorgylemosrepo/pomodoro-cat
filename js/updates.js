/**
 * Atualizações pelo GitHub. Duas peças:
 *   Gatinho.Updater  funções puras: ler o repositório, comparar versões, escolher o arquivo certo, consultar o GitHub.
 *   Gatinho.Updates  o controlador com estado (o que o botão e o painel de atualização usam).
 *
 * Como descobre a versão mais nova: primeiro a última *release* do repositório (é de onde saem os instaladores);
 * se o repositório não tem releases, lê a versão do package.json da branch principal.
 * Só consulta repositórios públicos (a API do GitHub aceita 60 consultas por hora sem login: sobra).
 */
(function () {
  const DAY_MS = 86400000;
  const PLACEHOLDER_OWNER = 'SEU-USUARIO'; // o que vem escrito no package.json até você apontar para o seu repositório
  const REPO_PATTERN = /^(?:git\+)?(?:(?:(?:https?:\/\/)?(?:www\.)?github\.com\/)|(?:git@github\.com:)|(?:ssh:\/\/git@github\.com\/))?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i;
  const ASSET_PATTERNS = { 'win-portable': /portable.*\.exe$/i, 'win-installer': /setup.*\.exe$/i, appimage: /\.appimage$/i, deb: /\.deb$/i, rpm: /\.rpm$/i };
  const ARCH_PATTERNS = { x64: /(x64|x86_64|amd64)/i, arm64: /(arm64|aarch64)/i, ia32: /(ia32|i386)/i };

  const Updater = {
    /** "usuario/repo" a partir de "usuario/repo", da URL do GitHub ou do endereço git. Retorna null se não der. */
    parseRepo(input) {
      const match = String(input ?? '').trim().match(REPO_PATTERN);
      if (!match) return null;
      const [, owner, name] = match;
      if (/^\.+$/.test(owner) || /^\.+$/.test(name) || owner.toUpperCase() === PLACEHOLDER_OWNER) return null;
      return `${owner}/${name}`;
    },

    /** Lê "v1.2.3" ou "1.2.3-beta.1". Retorna null se não for uma versão. */
    parseVersion(text) {
      const match = String(text ?? '').trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+.*)?$/);
      return match ? { numbers: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? null } : null;
    },

    /** 1 se a é mais nova que b, -1 se mais velha, 0 se iguais; null se alguma não é uma versão. Pré-lançamento vale menos que a final. */
    compare(a, b) {
      const x = this.parseVersion(a);
      const y = this.parseVersion(b);
      if (!x || !y) return null;
      for (let i = 0; i < 3; i++) if (x.numbers[i] !== y.numbers[i]) return x.numbers[i] > y.numbers[i] ? 1 : -1;
      if (x.pre === y.pre) return 0;
      if (x.pre === null) return 1;
      if (y.pre === null) return -1;
      return x.pre.localeCompare(y.pre, 'en', { numeric: true }) > 0 ? 1 : -1;
    },

    isNewer(latest, current) {
      return this.compare(latest, current) === 1;
    },

    /** Escolhe, entre os arquivos da release, o que serve para este computador (kind e arch vêm do app: ver electron/app-info.js). */
    pickAsset(assets, kind, arch = 'x64') {
      const pattern = ASSET_PATTERNS[kind];
      if (!pattern) return null;
      const matches = (assets ?? []).filter((asset) => pattern.test(asset.name));
      return matches.find((asset) => ARCH_PATTERNS[arch]?.test(asset.name)) ?? matches[0] ?? null;
    },

    /**
     * Pergunta ao GitHub qual é a versão mais nova.
     * @returns {Promise<{ok: true, latest: {version, url, notes, assets, publishedAt, source}} | {ok: false, reason: string}>}
     */
    async check(repo, fetchFn = (...args) => fetch(...args)) {
      const api = `https://api.github.com/repos/${repo}`;
      const json = { headers: { Accept: 'application/vnd.github+json' } };
      let limited = false;
      try {
        const release = await fetchFn(`${api}/releases/latest`, json);
        if (release.ok) {
          const data = await release.json();
          const version = String(data.tag_name ?? '').replace(/^v/i, '');
          if (!this.parseVersion(version)) return { ok: false, reason: `A última versão do GitHub ("${data.tag_name}") não tem o formato 1.2.3.` };
          return {
            ok: true,
            latest: {
              version, source: 'release', url: data.html_url, notes: data.body ?? '', publishedAt: data.published_at ?? null,
              assets: (data.assets ?? []).map((a) => ({ name: a.name, url: a.browser_download_url, size: a.size })),
            },
          };
        }
        limited = release.status === 403 || release.status === 429; // 60 consultas/hora por internet, sem login
        if (!limited && release.status !== 404) return { ok: false, reason: `O GitHub respondeu ${release.status}.` };
      } catch {
        return { ok: false, reason: 'Sem conexão com o GitHub.' };
      }

      // Sem releases (ou API limitada): lê a versão do package.json da branch principal (o raw não tem esse limite)
      try {
        let branches = ['main', 'master'];
        let url = `https://github.com/${repo}`;
        if (!limited) {
          const meta = await fetchFn(api, json);
          if (!meta.ok) return { ok: false, reason: 'Não encontrei esse repositório no GitHub. Ele é público e o nome está certo?' };
          const data = await meta.json();
          branches = [data.default_branch ?? 'main'];
          url = data.html_url ?? url;
        }
        for (const branch of branches) {
          const raw = await fetchFn(`https://raw.githubusercontent.com/${repo}/${branch}/package.json`);
          if (!raw.ok) continue;
          const version = String((await raw.json()).version ?? '');
          if (!this.parseVersion(version)) return { ok: false, reason: 'Não consegui ler a versão do package.json do repositório.' };
          return { ok: true, latest: { version, source: 'branch', url, notes: '', publishedAt: null, assets: [] } };
        }
        return { ok: false, reason: limited ? 'O GitHub limitou as consultas por agora. Tente de novo mais tarde.' : 'O repositório não tem releases nem um package.json na branch principal.' };
      } catch {
        return { ok: false, reason: 'Sem conexão com o GitHub.' };
      }
    },
  };

  /**
   * Estado das atualizações: repositório escolhido, última consulta (guardada), se há versão nova.
   * Emite "change" quando o estado muda. settings = profile.settings.update; info = dados do app (electron/app-info.js).
   */
  class Updates extends EventTarget {
    constructor({ settings, info, fetchFn, now = Date.now }) {
      super();
      this.settings = settings;
      this.info = info;
      this.fetchFn = fetchFn;
      this.now = now;
      this.state = { status: 'idle', message: '' }; // idle | checking | uptodate | available | error
    }

    /** O repositório escolhido nas configurações; senão, o do package.json. */
    get repo() {
      return Updater.parseRepo(this.settings.repo) ?? Updater.parseRepo(this.info.repository);
    }

    get current() {
      return this.info.version;
    }

    get latest() {
      return this.settings.latest;
    }

    /** Há versão nova (usa a última consulta guardada, então vale também depois de reabrir o app). */
    get available() {
      return Boolean(this.latest) && Updater.isNewer(this.latest.version, this.current);
    }

    /** O arquivo da release que serve para este computador (ou null: então abre a página da versão). */
    get asset() {
      return Updater.pickAsset(this.latest?.assets, this.info.kind, this.info.arch);
    }

    shouldAutoCheck(now = this.now()) {
      return Boolean(this.settings.auto) && Boolean(this.repo) && now - this.settings.lastCheck > DAY_MS;
    }

    async check() {
      const repo = this.repo;
      if (!repo) return this._set('error', 'Informe o repositório do GitHub (usuario/repositorio).');
      this._set('checking', 'Consultando o GitHub…');
      const result = await Updater.check(repo, this.fetchFn);
      if (!result.ok) return this._set('error', result.reason);
      this.settings.latest = result.latest;
      this.settings.lastCheck = this.now();
      return this.available
        ? this._set('available', `Nova versão ${result.latest.version} disponível!`)
        : this._set('uptodate', `Você está na versão mais nova (${this.current}). ✓`);
    }

    /** Troca o repositório. Texto vazio volta ao do package.json. Retorna { ok, reason? }. */
    setRepo(text) {
      const trimmed = String(text ?? '').trim();
      const repo = Updater.parseRepo(trimmed);
      if (trimmed && !repo) return { ok: false, reason: 'Use o formato usuario/repositorio ou cole o endereço do GitHub.' };
      this.settings.repo = repo ?? '';
      this.settings.latest = null;
      this.settings.lastCheck = 0;
      this._set('idle', '');
      return { ok: true };
    }

    _set(status, message) {
      this.state = { status, message };
      this.dispatchEvent(new Event('change'));
      return this.state;
    }
  }

  Gatinho.Updater = Updater;
  Gatinho.Updates = Updates;
})();
