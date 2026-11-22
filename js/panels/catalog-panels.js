/**
 * Painéis "Loja" e "Inventário": a mesma tela de catálogo, com botões diferentes.
 * Abrem só na parte de baixo para o gatinho continuar visível enquanto você escolhe.
 * As regras (preço, posse, equipar, estoque) ficam em Profile; aqui só desenhamos e repassamos os cliques.
 *
 * Tipos de item: cores/roupas/temas/cenários (compra única e equipar), móveis (compra única; colocar e guardar
 * no cenário atual) e suprimentos (consumíveis: compram-se de novo quando acabam).
 */
(function () {
  function createCatalogPanel({ id, icon, title, mode }) {
    return {
      id,
      icon,
      title,
      slot: 'coat', // aba atual
      note: '',     // último aviso ("Comprou...", "Faltam...")

      render(body, { profile, actions, refresh }) {
        const { html, SLOTS, ITEMS, Wardrobe, CONFIG } = Gatinho;
        const sceneId = profile.equipped.scene;
        // suprimentos aparecem no inventário mesmo sem "posse": mostram o estoque
        const items = ITEMS.filter((item) => item.slot === this.slot && (mode === 'shop' || item.slot === 'supply' || profile.owns(item.id)));

        const supplyKey = (item) => Object.keys(item.grants ?? {})[0];
        const button = (item) => {
          if (item.slot === 'supply') {
            if (mode === 'inventory') return '';
            const key = supplyKey(item);
            const full = profile.supplies[key] + item.grants[key] > CONFIG.supplies.cap[key] + 0.001;
            const ok = profile.coins >= item.price && !full;
            return `<button type="button" class="btn btn--small btn--primary" data-buy="${item.id}" ${ok ? '' : 'disabled'}>${full ? 'Estoque cheio' : `🪙 ${item.price}`}</button>`;
          }
          if (mode === 'shop') {
            if (profile.owns(item.id)) return '<button type="button" class="btn btn--small" disabled>Comprado ✓</button>';
            return `<button type="button" class="btn btn--small btn--primary" data-buy="${item.id}" ${profile.coins >= item.price ? '' : 'disabled'}>🪙 ${item.price}</button>`;
          }
          if (item.slot === 'furniture') {
            const placed = profile.placed(sceneId).some((entry) => entry.id === item.id);
            return placed
              ? `<button type="button" class="btn btn--small" data-store="${item.id}">Guardar</button>`
              : `<button type="button" class="btn btn--small" data-place="${item.id}">Colocar</button>`;
          }
          if (profile.equipped[item.slot] !== item.id) return `<button type="button" class="btn btn--small" data-equip="${item.id}">Equipar</button>`;
          if (['coat', 'theme', 'scene'].includes(item.slot)) return '<button type="button" class="btn btn--small" disabled>Em uso</button>';
          return `<button type="button" class="btn btn--small" data-unequip="${item.slot}">Tirar</button>`;
        };

        const stock = (item) => (item.slot === 'supply' ? `<small>Você tem: ${profile.supplyCount(supplyKey(item))} / ${CONFIG.supplies.cap[supplyKey(item)]}</small>` : '');
        const highlighted = (item) => (mode === 'inventory' && profile.equipped[item.slot] === item.id) || (item.slot === 'furniture' && mode === 'inventory' && profile.placed(sceneId).some((entry) => entry.id === item.id));
        const card = (item) => `
          <li class="gcard ${highlighted(item) ? 'gcard--on' : ''}">
            ${Wardrobe.preview(item)}
            <span class="gcard__name">${html.escape(item.name)}</span>
            ${stock(item)}${button(item)}
          </li>`;

        const empty = mode === 'shop' ? 'Nada nesta aba.' : 'Você ainda não tem nada aqui. Visite a loja 🛍️';
        const wrap = document.createElement('div');
        wrap.className = 'catalog';
        wrap.innerHTML = `
          <div class="row">
            <span class="tabs">${SLOTS.map((s) => `<button type="button" class="btn btn--small" data-slot="${s.id}" aria-pressed="${s.id === this.slot}">${s.label}</button>`).join('')}</span>
            <b>🪙 ${profile.coins}</b>
          </div>
          ${this.note ? `<p class="note">${html.escape(this.note)}</p>` : ''}
          <ul class="grid">${items.length ? items.map(card).join('') : `<li class="empty">${empty}</li>`}</ul>`;

        wrap.addEventListener('click', (event) => {
          const target = event.target.closest('button');
          if (!target || target.disabled) return;
          const { slot, buy, equip, unequip, place, store } = target.dataset;
          if (slot) this.note = '';
          else if (buy) this.note = actions.buy(buy);
          else if (equip) this.note = actions.equip(equip);
          else if (unequip) this.note = actions.unequip(unequip);
          else if (place) this.note = actions.place(place);
          else if (store) this.note = actions.store(store);
          if (slot) this.slot = slot;
          refresh();
        });
        body.append(wrap);
      },
    };
  }

  Gatinho.ShopPanel = createCatalogPanel({ id: 'shop', icon: 'bag', title: 'Loja', mode: 'shop' });
  Gatinho.InventoryPanel = createCatalogPanel({ id: 'inventory', icon: 'box', title: 'Inventário', mode: 'inventory' });
})();
