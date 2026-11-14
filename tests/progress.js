/**
 * Testa moedas, meta diária, sequência, combo e conquistas (sem navegador).
 * Uso: node tests/progress.js
 */
const fs = require('fs');
const path = require('path');
global.window = global;
global.localStorage = { getItem() {}, setItem() {} };
for (const file of ['random', 'config', 'html', 'life', 'pet', 'profile', '../data/achievements', '../data/items', '../data/missions', 'achievements', 'wardrobe', 'missions', 'care']) {
  (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`).replace('js/../', ''), 'utf8'));
}
const { Profile, Achievements, ACHIEVEMENTS, CONFIG, html } = Gatinho;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}

// Dias fixos para o teste não depender do relógio (meio-dia, fuso local)
const day = (n) => new Date(2026, 9, 1 + n, 12, 0).getTime();

// ---- Dados das conquistas ----
const ids = ACHIEVEMENTS.map((a) => a.id);
check('pelo menos 20 conquistas', ACHIEVEMENTS.length >= 20, `${ACHIEVEMENTS.length}`);
check('ids únicos', new Set(ids).size === ids.length);
check('ícones existem', ACHIEVEMENTS.every((a) => html.ICONS[a.icon]), ACHIEVEMENTS.filter((a) => !html.ICONS[a.icon]).map((a) => a.id).join());
check('campos obrigatórios', ACHIEVEMENTS.every((a) => a.title && a.desc && a.coins > 0 && a.when?.counter && a.when.atLeast > 0));

// ---- Foco, moedas e combo ----
let p = new Profile();
let r = p.recordFocus({ task: ' Estudar  JS ', minutes: 25 }, day(0));
check('foco rende 1 moeda/min', r.coins === 25, `${r.coins}`);
check('tarefa normalizada', p.sessions[0].task === 'Estudar JS');
check('1º foco: combo 1 sem bônus', r.combo === 1 && r.bonusPoints === 0);
r = p.recordFocus({ task: 'estudar js', minutes: 25 }, day(0) + 30 * 60000);
check('2º foco seguido: combo 2 com bônus', r.combo === 2 && r.bonusPoints === CONFIG.progress.comboPointsPerStep);
p.recordCancel();
check('cancelar quebra o combo', p.currentCombo(day(0) + 31 * 60000) === 0);
r = p.recordFocus({ task: 'x', minutes: 5 }, day(0) + 60 * 60000);
check('combo recomeça em 1 depois do cancelamento', r.combo === 1);
r = p.recordFocus({ task: 'x', minutes: 5 }, day(0) + 60 * 60000 + (CONFIG.progress.comboWindowMinutes + 1) * 60000);
check('combo zera depois da janela de tempo', r.combo === 1);
check('tarefas iguais (maiúsc./espaços) agrupam', p.taskTotals(0, day(1))[0].task === 'Estudar JS' && p.taskTotals(0, day(1))[0].minutes === 50);

// ---- Meta diária e sequência ----
p = new Profile(); p.goalMinutes = 50;
r = p.recordFocus({ task: 'a', minutes: 25 }, day(0));
check('meta não bate com metade', !r.goalMet);
r = p.recordFocus({ task: 'a', minutes: 25 }, day(0) + 3600000);
check('meta bate ao completar', r.goalMet && r.streak === 1);
const before = p.coins;
r = p.recordFocus({ task: 'a', minutes: 25 }, day(0) + 7200000);
check('bônus da meta só uma vez por dia', !r.goalMet && p.coins - before === 25);
p.recordFocus({ task: 'a', minutes: 50 }, day(1));
p.recordFocus({ task: 'a', minutes: 50 }, day(2));
check('sequência de 3 dias', p.streak.count === 3 && p.counter('bestStreak') === 3);
check('streak vale hoje e amanhã', p.currentStreak(day(2)) === 3 && p.currentStreak(day(3)) === 3);
check('streak quebra se pular um dia', p.currentStreak(day(4)) === 0);
p.recordFocus({ task: 'a', minutes: 50 }, day(5));
check('nova sequência recomeça em 1 (recorde mantido)', p.streak.count === 1 && p.counter('bestStreak') === 3);
check('bônus de sequência de 3 dias pago', ((q) => { q.goalMinutes = 10; [0, 1, 2].forEach((d) => q.recordFocus({ task: 'a', minutes: 10 }, day(d))); return q.counter('coinsEarned') === 30 + 3 * 20 + CONFIG.progress.streakBonus[3]; })(new Profile()));

// ---- Relatórios ----
p = new Profile();
p.recordFocus({ task: 'a', minutes: 30 }, day(0)); p.recordFocus({ task: 'b', minutes: 10 }, day(6));
const week = p.minutesPerDay(7, day(6));
check('relatório de 7 dias', week.length === 7 && week[0].minutes === 30 && week[6].minutes === 10);
check('por tarefa limitado ao período', p.taskTotals(3, day(6)).length === 1 && p.taskTotals(0, day(6)).length === 2);

// ---- Cuidados ----
p = new Profile();
check('cuidado normal (brincar): 3 moedas', p.recordCare('play', { urgent: false, critical: false }) === 3);
check('cuidado urgente (carinho): 6 moedas', p.recordCare('pet', { urgent: true, critical: false }) === 6);
check('ração, água e remédio não rendem moedas (já custam doses)', p.recordCare('feed', { urgent: true, critical: true }) === 0 && p.recordCare('water', { urgent: false }) === 0 && p.recordCare('medicine', { urgent: true }) === 0);
check('contadores de cuidado', p.counter('careTotal') === 5 && p.counter('care:feed') === 1 && p.counter('care:play') === 1 && p.counter('urgentSaves') === 1);

// ---- Conquistas ----
p = new Profile();
check('nada desbloqueado no começo', Achievements.check(p).length === 0);
p.recordFocus({ task: 'a', minutes: 25 }, day(0));
let fresh = Achievements.check(p, day(0));
check('primeiro foco desbloqueia', fresh.map((a) => a.id).join() === 'first_focus');
check('recompensa em moedas e aviso pendente', p.coins === 25 + 10 && p.unseen.length === 1);
check('não desbloqueia duas vezes', Achievements.check(p).length === 0);
p.markSeen(); check('markSeen limpa avisos', p.unseen.length === 0);
p.recordRevive(); check('fênix', Achievements.check(p).some((a) => a.id === 'phoenix'));
check('progresso limitado ao alvo', Achievements.progress(ACHIEVEMENTS.find((a) => a.id === 'minutes_100'), p) === 25);
check('salva e carrega igual', JSON.stringify(new Profile(JSON.parse(JSON.stringify(p)))) === JSON.stringify(p));
check('html.escape protege', html.escape('<b>"x"&</b>') === '&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;');

// ---- Loja e guarda-roupa ----
const { ITEMS, SLOTS, Wardrobe } = Gatinho;
const itemIds = ITEMS.map((i) => i.id);
check('itens: ids únicos', new Set(itemIds).size === itemIds.length);
check('itens: slots válidos', ITEMS.every((i) => SLOTS.some((s) => s.id === i.slot)));
check('itens: preços válidos', ITEMS.every((i) => Number.isInteger(i.price) && i.price >= 0));
check('itens: cada tipo tem os campos certos', ITEMS.every((i) => ({ coat: () => i.coat && i.ear, theme: () => i.swatch?.length === 2 && i.vars, scene: () => ['mountains', 'hills', 'sea', 'snow', 'space'].includes(i.view) && (i.price === 0 || (i.wall && i.floor)), furniture: () => i.w > 0 && i.h > 0 && ['floor', 'wall'].includes(i.anchor) && i.svg, supply: () => i.icon && Object.keys(i.grants).length === 1 && CONFIG.supplies.cap[Object.keys(i.grants)[0]] >= Object.values(i.grants)[0], hat: () => i.svg, face: () => i.svg, neck: () => i.svg }[i.slot]?.())));
const duplicated = (svg) => (svg.match(/<[a-zA-Z][^>]*>/g) ?? []).filter((tag) => { const names = [...tag.matchAll(/\s([\w:-]+)=/g)].map((m) => m[1]); return new Set(names).size !== names.length; });
check('itens: nenhum SVG tem atributo repetido na mesma tag (o navegador ignora o 2º valor em silêncio)', ITEMS.filter((i) => i.svg).every((i) => duplicated(i.svg).length === 0), ITEMS.filter((i) => i.svg && duplicated(i.svg).length).map((i) => i.id).join());
check('temas só usam variáveis conhecidas', ITEMS.filter((i) => i.slot === 'theme').every((i) => Object.keys(i.vars).every((v) => Wardrobe.themeVars.includes(v))));
check('tema inicial existe, é grátis e não muda nada', Wardrobe.item(CONFIG.defaultTheme)?.price === 0 && Object.keys(Wardrobe.item(CONFIG.defaultTheme).vars).length === 0);
check('cor inicial existe e é grátis', Wardrobe.item(CONFIG.defaultCoat)?.price === 0);

p = new Profile();
check('começa com a cor padrão equipada e no inventário', p.equipped.coat === CONFIG.defaultCoat && p.owns(CONFIG.defaultCoat));
const bow = Wardrobe.item('neck_bowtie');
check('sem moedas não compra', !p.buy(bow).ok && p.buy(bow).reason.includes('Faltam 40'));
p.coins = 100;
check('compra desconta moedas e guarda no inventário', p.buy(bow).ok && p.coins === 60 && p.owns('neck_bowtie') && p.counter('coinsSpent') === 40);
check('não compra duas vezes', !p.buy(bow).ok && p.coins === 60);
check('não equipa o que não tem', !p.equip(Wardrobe.item('hat_crown')).ok);
check('equipa item comprado', p.equip(bow).ok && p.equipped.neck === 'neck_bowtie');
check('tira roupinha', p.unequip('neck').ok && p.equipped.neck === null);
check('cor do pelo e tema não podem ser removidos', !p.unequip('coat').ok && !p.unequip('theme').ok);
p.coins = 1000; ['coat_gray', 'hat_party', 'face_shades'].forEach((id) => { p.buy(Wardrobe.item(id)); p.equip(Wardrobe.item(id)); });
p.equip(bow);
check('trocar cor conta como novo visual', p.counter('coatChanges') === 1 && p.equipped.coat === 'coat_gray');
check('equipar de novo a mesma cor não conta', (p.equip(Wardrobe.item('coat_gray')), p.counter('coatChanges') === 1));
check('três encaixes equipados', p.counter('maxSlotsEquipped') === 3);
fresh = Achievements.check(p).map((a) => a.id);
check('conquistas de compra e visual', ['first_purchase', 'new_look', 'fashionista'].every((id) => fresh.includes(id)), fresh.join());
check('inventário e equipados são salvos', (() => { const q = new Profile(JSON.parse(JSON.stringify(p))); return q.owns('hat_party') && q.equipped.hat === 'hat_party'; })());
check('save antigo (sem inventário) ainda carrega', (() => { const old = JSON.parse(JSON.stringify(new Profile())); delete old.inventory; delete old.equipped; const q = new Profile(old); return q.owns(CONFIG.defaultCoat) && q.equipped.coat === CONFIG.defaultCoat; })());

// ---- Tema da janela e cenário ----
const fakeStyle = () => { const props = {}; return { props, colorScheme: '', setProperty(n, v) { props[n] = v; }, removeProperty(n) { delete props[n]; } }; };
const fakeRoot = () => ({ style: fakeStyle(), ownerDocument: { documentElement: { style: fakeStyle() } } });
let root = fakeRoot();
Wardrobe.applyTheme(root, { theme: 'theme_ocean' });
check('tema pinta a interface e o palco, no app e no <html>', root.style.props['--bg'] === '#e3f2fd' && root.style.props['--stage-sky'] === '#d4ecff' && root.ownerDocument.documentElement.style.props['--accent'] === '#1e88e5');
check('tema define o esquema claro/escuro (barras de rolagem e campos)', root.style.colorScheme === 'light' && (Wardrobe.applyTheme(root, { theme: 'theme_night' }), root.style.colorScheme === 'dark'));
Wardrobe.applyTheme(root, { theme: 'theme_default' });
check('tema padrão remove tudo e volta a seguir o sistema', Object.keys(root.style.props).length === 0 && Object.keys(root.ownerDocument.documentElement.style.props).length === 0 && root.style.colorScheme === '');
check('tema desconhecido cai no padrão (save de versão futura)', Wardrobe.applyTheme(fakeRoot(), { theme: 'theme_que_nao_existe' }).id === CONFIG.defaultTheme);
root = fakeRoot();
check('o cenário não pinta variáveis CSS (agora é desenhado em SVG)', !('applyScene' in Wardrobe) && !('sceneVars' in Wardrobe));
check('todo cenário comprável define parede, chão e paisagem; o Quarto acompanha o tema', ITEMS.filter((i) => i.slot === 'scene' && i.price > 0).every((i) => i.wall && i.floor && i.view) && !Wardrobe.item('scene_room').wall);
check('tom do palco: escuro (noite ou luz apagada) vence qualquer cenário', Wardrobe.stageTone({ scene: 'scene_garden' }, true) === 'dark');
check('tom do palco: tema padrão segue o sistema', Wardrobe.stageTone({}, false, true) === 'dark' && Wardrobe.stageTone({}, false, false) === 'light');
check('tom do palco: tema claro vence o sistema escuro; tema escuro vence o claro', Wardrobe.stageTone({ theme: 'theme_ocean' }, false, true) === 'light' && Wardrobe.stageTone({ theme: 'theme_night' }, false, false) === 'dark');
check('tom do palco: cenário comprado manda mais que o tema', Wardrobe.stageTone({ scene: 'scene_space', theme: 'theme_ocean' }, false) === 'dark' && Wardrobe.stageTone({ scene: 'scene_garden', theme: 'theme_night' }, false) === 'light');
check('cenário e tema têm ids que o catálogo conhece', Wardrobe.item(CONFIG.defaultScene)?.price === 0 && Gatinho.SLOTS.some((s) => s.id === 'scene'));
p = new Profile(); p.coins = 500;
check('começa com o cenário padrão equipado', p.equipped.scene === CONFIG.defaultScene && p.owns(CONFIG.defaultScene));
check('compra e troca de cenário (e conta)', p.buy(Wardrobe.item('scene_space')).ok && p.equip(Wardrobe.item('scene_space')).ok && p.equipped.scene === 'scene_space' && p.counter('sceneChanges') === 1);
check('cenário não pode ser removido, só trocado', !p.unequip('scene').ok);
check('conquista Diretor de cena', Achievements.check(p).some((a) => a.id === 'stage_manager'));
check('save antigo sem cenário ganha o padrão', (() => { const old = JSON.parse(JSON.stringify(new Profile())); delete old.equipped.scene; delete old.inventory[CONFIG.defaultScene]; const q = new Profile(old); return q.equipped.scene === CONFIG.defaultScene && q.owns(CONFIG.defaultScene); })());

p = new Profile(); p.coins = 500;
const ocean = Wardrobe.item('theme_ocean');
check('começa com o tema padrão equipado', p.equipped.theme === CONFIG.defaultTheme && p.owns(CONFIG.defaultTheme));
check('compra e equipa tema', p.buy(ocean).ok && p.equip(ocean).ok && p.equipped.theme === 'theme_ocean' && p.counter('themeChanges') === 1);
check('conquista Decorador', Achievements.check(p).some((a) => a.id === 'decorator'));
check('save antigo sem tema ganha o padrão', (() => { const old = JSON.parse(JSON.stringify(new Profile())); delete old.equipped.theme; delete old.inventory[CONFIG.defaultTheme]; const q = new Profile(old); return q.equipped.theme === CONFIG.defaultTheme && q.owns(CONFIG.defaultTheme); })());

console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
process.exit(failures ? 1 : 0);
