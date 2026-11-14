/** Painel "Gatinho": nome, fase da vida, personalidade, saúde e cemitério. */
Gatinho.CatPanel = {
  id: 'cat',
  icon: 'paw',
  title: 'Gatinho',
  note: '',

  render(body, { pet, profile, actions, refresh }) {
    const { html, CONFIG, Life } = Gatinho;
    const now = Date.now();
    const { life } = pet;
    const stage = life.stage(now);
    const next = life.nextStage(now);
    const trait = life.trait();
    const days = life.ageDays(now);
    const recordDays = Math.max(profile.counter('bestLifeDays'), pet.alive ? days : 0);
    const plural = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`;

    const graves = profile.graveyard.slice(0, 6).map((g) => `
      <li class="row"><span class="ellipsis">🪦 ${html.escape(g.name)}</span>
        <small>${plural(g.days)} · ${html.escape(g.cause)} · ${new Date(g.at).toLocaleDateString('pt-BR')}</small></li>`).join('');

    body.innerHTML = `
      <div class="card">
        <label class="row"><b>Nome</b>
          <input id="cat-name-input" class="field" type="text" maxlength="${CONFIG.life.maxNameLength}" value="${html.escape(life.name)}" aria-label="Nome do gatinho">
        </label>
        ${this.note ? `<p class="note">${html.escape(this.note)}</p>` : ''}
      </div>

      <div class="card">
        <div class="row"><b>Gênero</b><span>${life.gender === 'f' ? '♀ Fêmea' : '♂ Macho'}</span></div>
        <div class="row"><b>Fase</b><span>${stage.label} · ${plural(days)}</span></div>
        <small>${next ? `Vira ${next.stage.label.toLowerCase()} em ${plural(next.inDays)}.` : Life.speak('Já {ele} é {um} {gatinho} experiente.', life.gender)}
          ${stage.id === 'kitten' ? ' Filhotes precisam de mais cuidados.' : ''}</small>
        <div class="row"><b>Personalidade</b><span>${trait.label}</span></div>
        <small>${html.escape(trait.desc)}</small>
        <div class="row"><b>Saúde</b><span>${!pet.alive ? 'Virou anjinho 😇' : pet.sick ? 'Doente 🤒' : 'Saudável 😺'}</span></div>
        <div class="row"><b>Recorde de vida</b><span>${plural(recordDays)}</span></div>
      </div>

      <div class="card">
        <b>Cemitério</b>
        ${graves ? `<ul class="list">${graves}</ul>` : '<p class="empty">Nenhum gatinho se despediu ainda 💗</p>'}
      </div>`;

    body.querySelector('#cat-name-input').addEventListener('change', (event) => {
      this.note = actions.rename(event.target.value);
      refresh();
    });
  },
};
