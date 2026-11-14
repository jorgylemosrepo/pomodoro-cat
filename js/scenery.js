/**
 * Cenário do gatinho desenhado em SVG: parede, chão, janela com paisagem (o dia ou a noite lá fora),
 * móveis, sujeirinhas e o escurecer da noite. Também cuida das regras de posição dos móveis.
 *
 * Coordenadas: as mesmas do SVG do gatinho (viewBox "-203 -40 866 460"). O chão começa em y = 330.
 * Quem usa: main.js chama mount() quando algo muda; furniture-editor.js usa clamp() e toSvgPoint().
 */
(function () {
  const INK = '#14213d';
  const BOUNDS = { minX: -203, maxX: 663, top: -40, bottom: 420, floorY: 330, usableMaxX: 468 };
  const WINDOW = { x: -150, y: 16, w: 200, h: 150 };
  const SKY = { day: ['#8fd3ff', '#e8f7ff'], dusk: ['#ff9a76', '#ffd9a0'], night: ['#0b1431', '#27396b'] };

  // Sujeirinhas: poucas e devagar. A cada limiar de higiene que a barra cruza, aparece mais uma (no máximo 4).
  const DIRT_BELOW = [60, 45, 30, 15];
  const DIRT_SPOTS = [
    { x: -60, y: 372, kind: 'poop' },
    { x: 350, y: 388, kind: 'crumbs' },
    { x: 8, y: 396, kind: 'paws' },
    { x: 430, y: 368, kind: 'poop' },
  ];
  const STARS = [[20, 18], [58, 30], [96, 12], [130, 40], [176, 20], [44, 70], [150, 62], [184, 88]];

  /** Paisagens da janela. Origem no canto de cima da janela (200 x 150). */
  const VIEWS = {
    mountains(night, dusk) {
      const far = night ? '#2c3b66' : dusk ? '#b46a7a' : '#9bb4d4';
      const near = night ? '#1f2c52' : dusk ? '#7a4a68' : '#6f8fb3';
      const cap = night ? '#c9d3f0' : '#ffffff';
      return `${sunMoon(night, dusk)}
        <path d="M0 104L38 58L66 86L108 40L148 82L200 62V150H0Z" fill="${far}"/><path d="M96 53L108 40L120 54L112 50L108 56L103 50Z" fill="${cap}"/>
        <path d="M0 128L52 82L92 118L142 72L200 122V150H0Z" fill="${near}"/><path d="M130 85L142 72L154 87L146 83L142 89L137 83Z" fill="${cap}"/>`;
    },
    hills(night) {
      return `${sunMoon(night)}
        <path d="M0 108Q50 78 100 102T200 96V150H0Z" fill="${night ? '#1b3f35' : '#8fd18a'}"/>
        <path d="M0 130Q60 104 120 126T200 120V150H0Z" fill="${night ? '#143228' : '#6fbf6a'}"/>
        <rect x="148" y="96" width="6" height="24" fill="${night ? '#3b2a24' : '#8a5a3a'}"/><circle cx="151" cy="88" r="17" fill="${night ? '#1f5a45' : '#4fae5a'}"/>`;
    },
    sea(night) {
      return `${sunMoon(night)}
        <rect y="86" width="200" height="64" fill="${night ? '#17305a' : '#5fb6e8'}"/>
        <path d="M0 102q12-6 24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0M0 124q12-6 24 0t24 0t24 0t24 0t24 0t24 0t24 0t24 0" fill="none" stroke="${night ? '#2b4b85' : '#b9e4f7'}" stroke-width="3"/>
        <path d="M62 98h34l-7 11H69z" fill="${night ? '#cfd8ee' : '#fff'}"/><path d="M78 98V72l16 26z" fill="${night ? '#a8506a' : '#ff6b6b'}"/>`;
    },
    snow(night) {
      return `${sunMoon(night)}
        <path d="M0 112L44 52L80 100L120 38L168 96L200 70V150H0Z" fill="${night ? '#aab8dd' : '#f4f9ff'}"/>
        <path d="M44 52L58 74L40 68ZM120 38L136 64L112 58Z" fill="${night ? '#8795bd' : '#cfe2f5'}"/>
        <rect y="124" width="200" height="26" fill="${night ? '#7a89b3' : '#ffffff'}"/>
        ${[[24, 30], [70, 46], [110, 20], [168, 40], [140, 70], [40, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.4" fill="#fff"/>`).join('')}`;
    },
    space() {
      return `${STARS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="#fff"/>`).join('')}
        <circle cx="64" cy="92" r="30" fill="#c47ad9"/><path d="M40 84q24-12 48 0" fill="none" stroke="#9a52b5" stroke-width="4"/>
        <ellipse cx="64" cy="92" rx="48" ry="9" fill="none" stroke="#ffd36e" stroke-width="4" transform="rotate(-18 64 92)"/>
        <circle cx="160" cy="40" r="9" fill="#7fd0ff"/>`;
    },
  };

  function sunMoon(night, dusk) {
    if (night) {
      return `<circle cx="150" cy="34" r="13" fill="#f6f2d4"/><circle cx="157" cy="30" r="11" fill="#1d2f5a"/>${STARS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#fff"/>`).join('')}`;
    }
    if (dusk) return '<circle cx="146" cy="96" r="26" fill="#ffb27a" opacity=".5"/><circle cx="146" cy="96" r="16" fill="#ff7a3d"/>';
    return '<circle cx="150" cy="34" r="24" fill="#fff3b0" opacity=".55"/><circle cx="150" cy="34" r="13" fill="#ffd54a"/>';
  }

  function windowSvg(scene, night) {
    const { x, y, w, h } = WINDOW;
    const space = scene.view === 'space';
    const dusk = Boolean(scene.dusk) && !night;
    const [top, bottom] = space || night ? SKY.night : dusk ? SKY.dusk : SKY.day;
    return `<defs>
        <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
        <clipPath id="sc-win"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath>
      </defs>
      <rect x="${x - 9}" y="${y - 9}" width="${w + 18}" height="${h + 18}" rx="6" fill="#f6efe0" stroke="${INK}" stroke-width="5"/>
      <g clip-path="url(#sc-win)"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#sc-sky)"/>
        <g transform="translate(${x} ${y})">${VIEWS[scene.view](night || space, dusk)}</g></g>
      <path d="M${x + w / 2} ${y}V${y + h}M${x} ${y + h / 2}H${x + w}" stroke="#f6efe0" stroke-width="9"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${INK}" stroke-width="4"/>
      <rect x="${x - 16}" y="${y + h + 9}" width="${w + 32}" height="9" rx="3" fill="#e7dcc6" stroke="${INK}" stroke-width="4"/>`;
  }

  function dirtSvg(count) {
    return DIRT_SPOTS.slice(0, count).map(({ x, y, kind }) => {
      const brown = '#7b4a2a';
      const shapes = {
        poop: `<ellipse cy="-4" rx="12" ry="6" fill="${brown}" stroke="${INK}" stroke-width="3"/><ellipse cy="-12" rx="8" ry="5" fill="${brown}" stroke="${INK}" stroke-width="3"/><ellipse cy="-18" rx="4" ry="3.5" fill="${brown}" stroke="${INK}" stroke-width="3"/>`,
        crumbs: '<ellipse cx="-8" cy="-3" rx="4" ry="3" fill="#d9a66b"/><ellipse cx="2" cy="-5" rx="3" ry="2.5" fill="#c58f52"/><ellipse cx="9" cy="-2" rx="4" ry="3" fill="#d9a66b"/><ellipse cx="-1" cy="2" rx="3" ry="2" fill="#c58f52"/>',
        paws: `<ellipse cy="-3" rx="7" ry="5" fill="${brown}" opacity=".7"/><circle cx="-8" cy="-11" r="3" fill="${brown}" opacity=".7"/><circle cx="-2" cy="-14" r="3" fill="${brown}" opacity=".7"/><circle cx="5" cy="-14" r="3" fill="${brown}" opacity=".7"/><circle cx="10" cy="-10" r="3" fill="${brown}" opacity=".7"/>`,
      };
      return `<g class="dirt" transform="translate(${x} ${y})">${shapes[kind]}</g>`;
    }).join('');
  }

  const Scenery = {
    BOUNDS,
    WINDOW,

    /** Quantas sujeirinhas mostrar para uma barra de higiene (0 a 4). */
    dirtCount(hygiene) {
      return DIRT_BELOW.filter((limit) => hygiene < limit).length;
    },

    /** Mantém o móvel dentro do cenário (tamanho fixo; só a posição muda). Móvel de chão fica no chão, de parede na parede. */
    clamp(item, x, y) {
      const half = item.w / 2;
      const cx = Math.min(BOUNDS.usableMaxX - half, Math.max(BOUNDS.minX + 8 + half, Math.round(x)));
      const [minY, maxY] = item.anchor === 'floor' ? [BOUNDS.floorY + 8, BOUNDS.floorY + 66] : [item.h - 20, BOUNDS.floorY - 14];
      return { x: cx, y: Math.min(maxY, Math.max(minY, Math.round(y))) };
    },

    /** Primeiro lugar livre para um móvel novo. */
    defaultPosition(item, placed, lookup) {
      const floor = item.anchor === 'floor';
      const xs = floor ? [-60, 400, 330, -140, 120, 440] : [260, 340, 400, 120, 190];
      const y = floor ? 384 : 220;
      const crowded = (cx) => placed.some((entry) => {
        const other = lookup(entry.id);
        return other && other.anchor === item.anchor && Math.abs(entry.x - cx) < (item.w + other.w) / 2 * 0.8;
      });
      const x = xs.find((candidate) => !crowded(candidate)) ?? xs[0];
      return this.clamp(item, x, y);
    },

    /** Converte um ponto da tela (clientX/Y) para coordenadas do SVG, respeitando o ajuste do viewBox. */
    toSvgPoint(svg, clientX, clientY) {
      const box = svg.getBoundingClientRect();
      const [vx, vy, vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      const scale = Math.min(box.width / vw, box.height / vh);
      const offsetX = (box.width - vw * scale) / 2;
      const offsetY = (box.height - vh * scale) / 2;
      return { x: vx + (clientX - box.left - offsetX) / scale, y: vy + (clientY - box.top - offsetY) / scale };
    },

    /**
     * SVG do cenário todo (vai em #scenery, atrás do gatinho).
     * @param {{scene, night, lightsOff, placements, dirt, editing, lookup}} state
     */
    render({ scene, night, lightsOff, placements = [], dirt = 0, editing = false, lookup }) {
      const { minX, maxX, top, bottom, floorY } = BOUNDS;
      const width = maxX - minX;
      const wall = scene.wall ? `fill="${scene.wall}"` : 'style="fill:var(--stage-sky)"'; // Quarto: acompanha o tema da janela
      const floor = scene.floor ? `fill="${scene.floor}"` : 'style="fill:var(--stage-floor)"';
      const furniture = placements
        .map((entry, index) => ({ entry, index, item: lookup(entry.id) }))
        .filter(({ item }) => item)
        .sort((a, b) => a.entry.y - b.entry.y)
        .map(({ entry, index, item }) => `<g class="fur" data-index="${index}" transform="translate(${entry.x} ${entry.y})">${item.svg}${editing ? `<rect class="fur-hit" x="${-item.w / 2}" y="${-item.h}" width="${item.w}" height="${item.h}"/>` : ''}</g>`)
        .join('');
      const { x, y, w, h } = WINDOW;
      const tint = lightsOff ? 0.62 : night ? 0.42 : 0; // de noite o quarto escurece; sem luz, bem mais; a janela fica clara
      return `<rect x="${minX}" y="${top}" width="${width}" height="${floorY - top}" ${wall}/>
        <rect x="${minX}" y="${floorY - 64}" width="${width}" height="64" fill="#000" opacity=".05"/>
        ${windowSvg(scene, night)}
        <rect x="${minX}" y="${floorY}" width="${width}" height="${bottom - floorY}" ${floor}/>
        <path d="M${minX} 356H${maxX}M${minX} 382H${maxX}M${minX} 408H${maxX}" stroke="#000" stroke-opacity=".1" stroke-width="2"/>
        <rect x="${minX}" y="${floorY - 8}" width="${width}" height="8" fill="#000" opacity=".12"/>
        ${furniture}${dirtSvg(dirt)}
        ${tint ? `<path fill-rule="evenodd" fill="#070b24" opacity="${tint}" d="M${minX} ${top}H${maxX}V${bottom}H${minX}ZM${x} ${y}h${w}v${h}h${-w}Z"/>` : ''}`;
    },

    /** O "transformer" do móvel selecionado (vai em #editor, na frente do gatinho): caixa e cantos travados (tamanho fixo). */
    renderEditor({ placements = [], selected = null, editing = false, lookup }) {
      const entry = editing && selected != null ? placements[selected] : null;
      const item = entry && lookup(entry.id);
      if (!item) return '';
      const pad = 6;
      const [left, topY, boxW, boxH] = [-item.w / 2 - pad, -item.h - pad, item.w + pad * 2, item.h + pad * 2];
      const corners = [[left, topY], [left + boxW, topY], [left, topY + boxH], [left + boxW, topY + boxH]]
        .map(([cx, cy]) => `<rect class="tf-handle" x="${cx - 5}" y="${cy - 5}" width="10" height="10" fill="#fff" stroke="#7c6cff" stroke-width="2"/>`).join('');
      return `<g class="transformer" transform="translate(${entry.x} ${entry.y})">
        <rect class="tf-box" x="${left}" y="${topY}" width="${boxW}" height="${boxH}" fill="none" stroke="#7c6cff" stroke-width="2" stroke-dasharray="6 4"/>${corners}
        <g class="tf-lock" transform="translate(${left + boxW + 4} ${topY - 4})"><circle r="10" fill="#fff" stroke="#7c6cff" stroke-width="2"/><rect x="-4" y="-1" width="8" height="6" rx="1" fill="#7c6cff"/><path d="M-3 -1v-3a3 3 0 0 1 6 0v3" fill="none" stroke="#7c6cff" stroke-width="2"/></g></g>`;
    },

    /** Desenha (só se algo mudou) o cenário e o transformer no SVG do gatinho. */
    mount(svg, state) {
      const sceneKey = JSON.stringify([state.scene.id, state.night, state.lightsOff, state.dirt, state.editing, state.placements]);
      if (svg.dataset.sceneryKey !== sceneKey) {
        svg.dataset.sceneryKey = sceneKey;
        svg.querySelector('#scenery').innerHTML = this.render(state);
      }
      const editorKey = JSON.stringify([state.editing, state.selected, state.placements]);
      if (svg.dataset.editorKey !== editorKey) {
        svg.dataset.editorKey = editorKey;
        svg.querySelector('#editor').innerHTML = this.renderEditor(state);
      }
    },

    /** Quadradinho do cenário para a tira abaixo do palco (HTML). */
    thumbnail(scene) {
      const wall = scene.wall ?? '#ffe9cf';
      const floor = scene.floor ?? '#f6cfa3';
      const sky = scene.view === 'space' ? '#14153a' : scene.dusk ? '#ff9a76' : '#8fd3ff';
      return `<svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true"><rect width="40" height="40" fill="${wall}"/><rect y="28" width="40" height="12" fill="${floor}"/><rect x="9" y="7" width="22" height="17" fill="${sky}" stroke="${INK}" stroke-width="2"/><path d="M9 24l7-9 5 6 4-5 6 8z" fill="${scene.view === 'sea' ? '#5fb6e8' : scene.view === 'space' ? '#c47ad9' : '#6f8fb3'}"/></svg>`;
    },
  };

  Gatinho.Scenery = Scenery;
})();
