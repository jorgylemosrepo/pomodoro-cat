/**
 * Testa o cenário (SVG, sujeirinhas, móveis e limites) e confere os arquivos do app: scripts que existem,
 * ids únicos, cenas que têm animação no CSS e o conserto da bochecha. Uso: node tests/scenery.js
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.window = global;
global.localStorage = { getItem() {}, setItem() {} };
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
for (const file of ['js/random', 'js/config', 'js/html', 'js/life', 'js/pet', 'js/profile', 'data/items', 'data/rare-events', 'js/wardrobe', 'js/scenery']) (0, eval)(read(`${file}.js`));
const { Scenery, Wardrobe, CONFIG, ITEMS, RARE_EVENTS } = Gatinho;
const { BOUNDS } = Scenery;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}
const duplicated = (svg) => (svg.match(/<[a-zA-Z][^>]*>/g) ?? []).filter((tag) => { const names = [...tag.matchAll(/\s([\w:-]+)=/g)].map((m) => m[1]); return new Set(names).size !== names.length; });
const lookup = (id) => Wardrobe.item(id);
const scenes = ITEMS.filter((i) => i.slot === 'scene');
const furniture = ITEMS.filter((i) => i.slot === 'furniture');
const base = { night: false, lightsOff: false, placements: [], dirt: 0, editing: false, lookup };

// ---------- Arquivos do app ----------
const html = read('index.html');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
check('index.html: ids únicos', new Set(ids).size === ids.length, ids.filter((id, i) => ids.indexOf(id) !== i).join());
const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
check('todo script do index.html existe', scripts.every((file) => fs.existsSync(path.join(ROOT, file))), scripts.filter((f) => !fs.existsSync(path.join(ROOT, f))).join());
check('nenhum script repetido', new Set(scripts).size === scripts.length);
const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => `js/${f}`).concat(fs.readdirSync(path.join(ROOT, 'js/panels')).map((f) => `js/panels/${f}`), fs.readdirSync(path.join(ROOT, 'js/music')).map((f) => `js/music/${f}`));
check('todo arquivo de js/ está carregado no index.html (nada esquecido)', jsFiles.every((file) => scripts.includes(file)), jsFiles.filter((f) => !scripts.includes(f)).join());
check('o index.html tem as camadas do cenário, do editor e da xícara', ['scenery', 'editor', 'cup', 'cat-wrap', 'slot-hat', 'slot-face', 'slot-neck', 'light-switch', 'strip-list', 'habit'].every((id) => ids.includes(id)));
check('o SVG do gatinho não tem atributos repetidos', duplicated(html.match(/<svg id="cat-stage".*?<\/svg>/s)[0]).length === 0);
check('o SVG cobre o palco inteiro (viewBox largo)', html.includes('viewBox="-203 -40 866 460"') && BOUNDS.minX === -203 && BOUNDS.maxX - BOUNDS.minX === 866);

// ---------- Bochecha girando ao brincar com a bolinha ----------
const css = read('css/cat.css');
check('bochechas e bolinha usam classes diferentes (bl = bochecha, bs = giro da bolinha)', (html.match(/class="bl"/g) ?? []).length === 1 && html.includes('<g id="ball"><g class="bs">'));
check('o giro da bolinha só mexe na bolinha (.bs), em brincar e em entediado', css.includes('.s-ball .bs{animation:bl-roll') && css.includes('.s-bored .bs{animation:bl-roll') && !/\.s-(ball|bored)\s+\.bl\b/.test(css));
check('a bochecha só anima no carinho (.s-pet .bl)', /\.s-pet \.bl\{animation:pe-blush/.test(css));

// ---------- Toda cena usada tem animação ----------
const used = new Set(['idle', 'happy', 'rip', 'dead', 'sleep', 'tired', 'coffee', 'sick', 'angry']);
Object.values(CONFIG.needs).forEach((n) => used.add(n.scene));
Object.values(CONFIG.actions).forEach((a) => used.add(a.scene));
RARE_EVENTS.forEach((e) => used.add(e.scene));
CONFIG.idleFlavor.scenes.forEach((s) => used.add(s.scene));
for (const m of read('js/main.js').matchAll(/scene: '([a-z]+)'/g)) used.add(m[1]);
check('toda cena usada no código tem animação em cat.css', [...used].every((scene) => css.includes(`.s-${scene} `) || css.includes(`.s-${scene}{`) || css.includes(`.s-${scene},`)), [...used].filter((s) => !new RegExp(`\\.s-${s}[ ,{]`).test(css)).join());
check('as cenas cansado e café existem', /\.s-tired #head/.test(css) && /\.s-coffee #cup/.test(css));

// ---------- Cenários em SVG ----------
check('há 6 cenários e todos desenham sem atributo repetido', scenes.length === 6 && scenes.every((s) => [false, true].every((night) => duplicated(Scenery.render({ ...base, scene: s, night })).length === 0)));
check('todo cenário tem janela com paisagem', scenes.every((s) => Scenery.render({ ...base, scene: s }).includes('id="sc-win"')));
const room = lookup('scene_room');
const day = Scenery.render({ ...base, scene: room });
const night = Scenery.render({ ...base, scene: room, night: true });
const dark = Scenery.render({ ...base, scene: room, night: true, lightsOff: true });
check('de dia a janela mostra o sol e as montanhas; sem escurecer o quarto', day.includes('#ffd54a') && day.includes('#9bb4d4') && !day.includes('fill-rule="evenodd"'));
check('de noite a janela mostra lua e estrelas, e o quarto escurece (mas a janela não)', night.includes('#f6f2d4') && night.includes('#2c3b66') && night.includes('fill-rule="evenodd"') && !night.includes('#ffd54a'));
const tintOf = (svg) => Number(svg.match(/fill="#070b24" opacity="([\d.]+)"/)[1]);
check('sem luz fica bem mais escuro que de noite com a luz acesa', tintOf(dark) > tintOf(night) && tintOf(dark) >= 0.6);
check('Quarto acompanha o tema; os outros têm cores próprias', day.includes('var(--stage-sky)') && Scenery.render({ ...base, scene: lookup('scene_beach') }).includes('#cfeefb'));
check('Entardecer tem céu de pôr do sol na janela de dia e Espaço é sempre escuro', Scenery.render({ ...base, scene: lookup('scene_dusk') }).includes('#ff9a76') && Scenery.render({ ...base, scene: lookup('scene_space') }).includes('#0b1431'));
check('miniaturas da tira existem para todos os cenários', scenes.every((s) => Scenery.thumbnail(s).startsWith('<svg') && duplicated(Scenery.thumbnail(s)).length === 0));

// ---------- Sujeirinhas: poucas e devagar ----------
const dirt = (h) => Scenery.dirtCount(h);
check('sem sujeira enquanto a higiene está boa (>= 60)', [100, 80, 60].every((h) => dirt(h) === 0));
check('aparecem aos poucos: <60, <45, <30, <15', dirt(59) === 1 && dirt(44) === 2 && dirt(29) === 3 && dirt(14) === 4);
check('no máximo 4 sujeirinhas, mesmo com higiene zero', dirt(0) === 4 && dirt(-10) === 4);
check('o cenário desenha tantas sujeirinhas quanto o pedido', [0, 1, 2, 3, 4].every((n) => (Scenery.render({ ...base, scene: room, dirt: n }).match(/class="dirt"/g) ?? []).length === n));
check('com a higiene em 80 min de queda lenta, a 1ª sujeira leva um bom tempo (>20 min)', (CONFIG.needs.hygiene.minutesToEmpty * (100 - 60)) / 100 > 20, `${(CONFIG.needs.hygiene.minutesToEmpty * 0.4).toFixed(0)} min`);

// ---------- Móveis: tamanho fixo, limites e posição ----------
check('todo móvel tem tamanho fixo e cabe no cenário', furniture.every((f) => f.w <= 200 && f.h <= 200 && f.w >= 40));
const extremes = [[-9999, -9999], [9999, 9999], [-9999, 9999], [9999, -9999], [0, 0]];
const inside = furniture.every((f) => extremes.every(([x, y]) => {
  const p = Scenery.clamp(f, x, y);
  const left = p.x - f.w / 2, right = p.x + f.w / 2;
  const floorOk = f.anchor !== 'floor' || (p.y >= BOUNDS.floorY && p.y <= BOUNDS.bottom - 10);
  const wallOk = f.anchor !== 'wall' || (p.y - f.h >= BOUNDS.top && p.y <= BOUNDS.floorY);
  return left >= BOUNDS.minX && right <= BOUNDS.usableMaxX + 0.01 && floorOk && wallOk;
}));
check('clamp mantém qualquer móvel dentro do cenário (chão no chão, parede na parede)', inside);
check('clamp não mexe em posições já boas e arredonda', (() => { const sofa = lookup('fur_sofa'); const p = Scenery.clamp(sofa, 100.4, 384.6); return p.x === 100 && p.y === 385; })());
check('posição inicial livre e sem sobrepor', (() => { const placed = []; for (const f of furniture.filter((x) => x.anchor === 'floor').slice(0, 4)) { const p = Scenery.defaultPosition(f, placed, lookup); placed.push({ id: f.id, ...p }); } const xs = placed.map((p) => p.x); return new Set(xs).size === xs.length; })());
const placements = [{ id: 'fur_sofa', x: 100, y: 384 }, { id: 'fur_picture', x: 300, y: 150 }];
const withFurniture = Scenery.render({ ...base, scene: room, placements });
check('móveis são desenhados na posição, atrás do gatinho, do mais ao fundo para o da frente', withFurniture.includes('translate(100 384)') && withFurniture.includes('translate(300 150)') && withFurniture.indexOf('translate(300 150)') < withFurniture.indexOf('translate(100 384)'));
check('fora da edição o móvel não captura cliques; na edição sim (área de clique)', !withFurniture.includes('fur-hit') && Scenery.render({ ...base, scene: room, placements, editing: true }).includes('class="fur-hit"'));
check('móvel desconhecido (save de versão futura) é ignorado sem quebrar', Scenery.render({ ...base, scene: room, placements: [{ id: 'fur_que_nao_existe', x: 0, y: 0 }] }).includes('id="sc-win"'));
const editor = Scenery.renderEditor({ placements, selected: 0, editing: true, lookup });
const sofa = lookup('fur_sofa');
check('transformer: caixa em volta do móvel, 4 cantos e cadeado (tamanho travado)', editor.includes('class="tf-box"') && (editor.match(/class="tf-handle"/g) ?? []).length === 4 && editor.includes('tf-lock') && editor.includes('translate(100 384)'));
check('transformer: a caixa tem o tamanho do móvel (+ margem), nunca outro', editor.includes(`width="${sofa.w + 12}"`) && editor.includes(`height="${sofa.h + 12}"`));
check('transformer só aparece editando e com algo selecionado', Scenery.renderEditor({ placements, selected: 0, editing: false, lookup }) === '' && Scenery.renderEditor({ placements, selected: null, editing: true, lookup }) === '' && Scenery.renderEditor({ placements, selected: 9, editing: true, lookup }) === '');
check('móveis e transformer sem atributos repetidos', duplicated(withFurniture + editor).length === 0);

// ---------- Cliques na tela viram pontos do SVG ----------
const fakeSvg = (box) => ({ getBoundingClientRect: () => box, getAttribute: () => '-203 -40 866 460' });
check('toSvgPoint: palco do tamanho do viewBox (escala 1)', (() => { const p = Scenery.toSvgPoint(fakeSvg({ left: 10, top: 20, width: 866, height: 460 }), 110, 120); return p.x === -103 && p.y === 60; })());
check('toSvgPoint: palco 320x170 (escala ~0,37)', (() => { const p = Scenery.toSvgPoint(fakeSvg({ left: 0, top: 0, width: 320, height: 170 }), 160, 85); return Math.abs(p.x - 230) < 1 && Math.abs(p.y - 190) < 1; })());
check('toSvgPoint: respeita as faixas laterais quando o palco é mais largo', (() => { const p = Scenery.toSvgPoint(fakeSvg({ left: 0, top: 0, width: 1000, height: 460 }), 500, 230); return Math.abs(p.x - 230) < 1; })());

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
