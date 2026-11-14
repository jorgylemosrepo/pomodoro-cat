/**
 * LOJA: cores de pelo e roupinhas. Para criar um item novo, adicione um objeto em ITEMS.
 *
 *   id     único (é o que fica salvo; não mude depois)
 *   slot   coat (cor) | hat (chapéu) | face (rosto) | neck (pescoço) | theme (tema da janela) | scene (cenário)  -> ver SLOTS
 *   name   nome na loja
 *   price  preço em moedas (0 = já vem com o jogador)
 *
 *   slot "coat": coat = cor do pelo, ear = cor de dentro da orelha
 *   slot "theme" (tema GLOBAL da janela: botões, painéis, textos e também o palco do gatinho):
 *        swatch = [fundo, destaque] da prévia; scheme = 'light' | 'dark' (também pinta barras de rolagem e campos);
 *        vars = variáveis CSS (ver Wardrobe.themeVars em js/wardrobe.js)
 *   slot "scene" (cenário onde o gatinho fica; a janela mostra o dia/noite lá fora): wall/floor = cores da parede e do chão,
 *        view = paisagem da janela ('mountains' | 'hills' | 'sea' | 'snow' | 'space'), dusk = true para céu de entardecer,
 *        dark = true se o cenário é escuro mesmo de dia
 *   slot "furniture" (móvel): w/h = tamanho FIXO (não dá para redimensionar), anchor = 'floor' (chão) ou 'wall' (parede),
 *        svg = desenho com a origem (0,0) no CENTRO DA BASE do móvel
 *   slot "supply" (suprimento, consumível): icon, grants = { food | water | medicine: doses } (limites em CONFIG.supplies)
 *   outros slots: svg = desenho em coordenadas do gatinho (viewBox 460x460; a cabeça fica em torno de x 85-315, y 75-265)
 *
 * Novos tipos de slot: adicione em SLOTS e crie um <g id="slot-NOME"> no SVG do index.html.
 */
window.Gatinho = window.Gatinho || {};

/** viewBox = recorte usado para mostrar a prévia do item na loja. */
Gatinho.SLOTS = [
  { id: 'coat', label: 'Cores',    viewBox: null },
  { id: 'hat',  label: 'Chapéus',  viewBox: '110 5 180 100' },
  { id: 'face', label: 'Rosto',    viewBox: '105 140 190 80' },
  { id: 'neck', label: 'Pescoço',  viewBox: '130 250 140 90' },
  { id: 'theme', label: 'Temas',   viewBox: null },
  { id: 'scene', label: 'Cenários', viewBox: null },
  { id: 'furniture', label: 'Móveis', viewBox: null },
  { id: 'supply', label: 'Suprimentos', viewBox: null },
];

(function () {
  const ink = '#14213d';
  const line = `stroke="${ink}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
  const lnW = (width) => `stroke="${ink}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"`; // contorno dos móveis
  const ln = lnW(4);

  Gatinho.ITEMS = [
    // ---- Cores ----
    { id: 'coat_cream',    slot: 'coat', name: 'Creme',    price: 0,   coat: '#fff6e3', ear: '#f26b4f' },
    { id: 'coat_gray',     slot: 'coat', name: 'Cinza',    price: 40,  coat: '#c3c7d4', ear: '#e58aa0' },
    { id: 'coat_orange',   slot: 'coat', name: 'Laranja',  price: 60,  coat: '#f6b26b', ear: '#d9663f' },
    { id: 'coat_charcoal', slot: 'coat', name: 'Carvão',   price: 80,  coat: '#6f7088', ear: '#e58aa0' },
    { id: 'coat_pink',     slot: 'coat', name: 'Rosinha',  price: 100, coat: '#ffc4d6', ear: '#ff7a9c' },
    { id: 'coat_gold',     slot: 'coat', name: 'Dourado',  price: 200, coat: '#ffd36e', ear: '#f2994a' },

    // ---- Temas da janela (mudam as cores de tudo, inclusive o palco) ----
    { id: 'theme_default', slot: 'theme', name: 'Padrão', price: 0, swatch: ['#fdf3e7', '#f26b4f'], vars: {} },
    { id: 'theme_ocean',   slot: 'theme', name: 'Oceano', price: 60, swatch: ['#e3f2fd', '#1e88e5'], scheme: 'light',
      vars: { '--bg': '#e3f2fd', '--fg': '#0d2b45', '--surface': '#ffffff', '--muted': '#4a6a85', '--line': '#bcd9ef', '--accent': '#1e88e5', '--stage-sky': '#d4ecff', '--stage-floor': '#a9d3f5' } },
    { id: 'theme_forest',  slot: 'theme', name: 'Floresta', price: 60, swatch: ['#e8f5e9', '#2e9d57'], scheme: 'light',
      vars: { '--bg': '#e8f5e9', '--fg': '#1b3a24', '--surface': '#ffffff', '--muted': '#4d6b55', '--line': '#c5e1c8', '--accent': '#2e9d57', '--stage-sky': '#dff3df', '--stage-floor': '#b4dbb5' } },
    { id: 'theme_sunset',  slot: 'theme', name: 'Pôr do sol', price: 90, swatch: ['#fff0e1', '#e8590c'], scheme: 'light',
      vars: { '--bg': '#fff0e1', '--fg': '#3b1f2b', '--surface': '#fffaf5', '--muted': '#7a5560', '--line': '#f3cfb4', '--accent': '#e8590c', '--stage-sky': '#ffe3cc', '--stage-floor': '#f5c4a0' } },
    { id: 'theme_sakura',  slot: 'theme', name: 'Sakura', price: 90, swatch: ['#fff0f5', '#e0457b'], scheme: 'light',
      vars: { '--bg': '#fff0f5', '--fg': '#4a2339', '--surface': '#ffffff', '--muted': '#8a5a73', '--line': '#f5c9db', '--accent': '#e0457b', '--stage-sky': '#ffe4ee', '--stage-floor': '#f7c3d6' } },
    { id: 'theme_night',   slot: 'theme', name: 'Meia-noite', price: 120, swatch: ['#14172b', '#7c6cff'], scheme: 'dark', dark: true,
      vars: { '--bg': '#14172b', '--fg': '#eceaf6', '--surface': '#20243f', '--muted': '#a4a8c8', '--line': '#343964', '--accent': '#7c6cff', '--stage-sky': '#1f2447', '--stage-floor': '#2c3260' } },
    { id: 'theme_cafe',    slot: 'theme', name: 'Café', price: 120, swatch: ['#f1e6da', '#a0522d'], scheme: 'light',
      vars: { '--bg': '#f1e6da', '--fg': '#3a2a20', '--surface': '#fbf5ee', '--muted': '#7b6556', '--line': '#dcc7b2', '--accent': '#a0522d', '--stage-sky': '#ead9c6', '--stage-floor': '#d4b898' } },

    // ---- Cenários (parede, chão e a janela com a paisagem; o dia/noite lá fora segue o ambiente) ----
    { id: 'scene_room',   slot: 'scene', name: 'Quarto', price: 0, view: 'mountains' }, // padrão: parede e chão acompanham o tema da janela
    { id: 'scene_garden', slot: 'scene', name: 'Jardim', price: 70, wall: '#d8f0c8', floor: '#9bcf8d', view: 'hills' },
    { id: 'scene_beach',  slot: 'scene', name: 'Praia', price: 90, wall: '#cfeefb', floor: '#f1d9a0', view: 'sea' },
    { id: 'scene_dusk',   slot: 'scene', name: 'Entardecer', price: 90, wall: '#f6c9a8', floor: '#a8667a', view: 'mountains', dusk: true },
    { id: 'scene_snow',   slot: 'scene', name: 'Neve', price: 100, wall: '#e6f1fb', floor: '#cfd9e6', view: 'snow' },
    { id: 'scene_space',  slot: 'scene', name: 'Espaço', price: 120, wall: '#23254d', floor: '#3b3f73', view: 'space', dark: true },

    // ---- Móveis (tamanho fixo; você só escolhe o lugar) ----
    { id: 'fur_rug', slot: 'furniture', name: 'Tapete', price: 40, anchor: 'floor', w: 170, h: 26,
      svg: `<ellipse cx="0" cy="-13" rx="82" ry="12" fill="#7c5cff" ${ln}/><ellipse cx="0" cy="-13" rx="56" ry="6" fill="#a594ff"/>` },
    { id: 'fur_plant', slot: 'furniture', name: 'Planta', price: 30, anchor: 'floor', w: 56, h: 96,
      svg: `<path d="M-20 -32h40l-6 32h-28z" fill="#d9825b" ${ln}/><path d="M0 -32C-32 -52 -24 -84 0 -94 24 -84 32 -52 0 -32z" fill="#5cc98b" ${ln}/><path d="M0 -36V-84" stroke="#2e9d57" stroke-width="3" fill="none"/>` },
    { id: 'fur_table', slot: 'furniture', name: 'Mesinha', price: 45, anchor: 'floor', w: 84, h: 62,
      svg: `<rect x="-42" y="-62" width="84" height="12" rx="4" fill="#b07a4a" ${ln}/><path d="M-32 -50V0M32 -50V0" fill="none" ${lnW(7)}/>` },
    { id: 'fur_bed', slot: 'furniture', name: 'Caminha', price: 60, anchor: 'floor', w: 96, h: 42,
      svg: `<path d="M-48 -10Q-48 -42 0 -42 48 -42 48 -10 48 0 32 0h-64Q-48 0 -48 -10z" fill="#ff9d8a" ${ln}/><ellipse cx="0" cy="-12" rx="32" ry="10" fill="#ffd1c7"/>` },
    { id: 'fur_lamp', slot: 'furniture', name: 'Abajur de chão', price: 50, anchor: 'floor', w: 62, h: 156,
      svg: `<ellipse cx="0" cy="-5" rx="20" ry="6" fill="#555" ${ln}/><path d="M0 -10V-112" fill="none" ${lnW(5)}/><path d="M-22 -154h44l12 44h-68z" fill="#ffd36e" ${ln}/>` },
    { id: 'fur_shelf_floor', slot: 'furniture', name: 'Estante de livros', price: 90, anchor: 'floor', w: 92, h: 192,
      svg: `<rect x="-46" y="-192" width="92" height="192" rx="4" fill="#b07a4a" ${ln}/><path d="M-46 -144h92M-46 -96h92M-46 -48h92" fill="none" ${ln}/><g stroke="none"><rect x="-38" y="-180" width="10" height="34" fill="#e63946"/><rect x="-26" y="-176" width="10" height="30" fill="#4ecdc4"/><rect x="-14" y="-182" width="10" height="36" fill="#ffd36e"/><rect x="-36" y="-132" width="12" height="34" fill="#7c5cff"/><rect x="-22" y="-128" width="10" height="30" fill="#e63946"/><rect x="-34" y="-84" width="10" height="34" fill="#5cc98b"/><rect x="-22" y="-86" width="12" height="36" fill="#ffd36e"/><rect x="-30" y="-36" width="12" height="34" fill="#4ecdc4"/></g>` },
    { id: 'fur_sofa', slot: 'furniture', name: 'Sofá', price: 120, anchor: 'floor', w: 176, h: 84,
      svg: `<rect x="-76" y="-52" width="152" height="52" rx="12" fill="#c0504d" ${ln}/><rect x="-76" y="-84" width="152" height="40" rx="14" fill="#d8645f" ${ln}/><rect x="-88" y="-58" width="26" height="58" rx="10" fill="#b0443f" ${ln}/><rect x="62" y="-58" width="26" height="58" rx="10" fill="#b0443f" ${ln}/>` },
    { id: 'fur_cattree', slot: 'furniture', name: 'Arranhador', price: 110, anchor: 'floor', w: 84, h: 172,
      svg: `<rect x="-42" y="-16" width="84" height="16" rx="6" fill="#c9a36b" ${ln}/><rect x="-9" y="-156" width="18" height="142" fill="#e8d5a8" ${ln}/><rect x="-40" y="-172" width="80" height="16" rx="8" fill="#c9a36b" ${ln}/><rect x="-30" y="-96" width="60" height="14" rx="7" fill="#c9a36b" ${ln}/>` },
    { id: 'fur_picture', slot: 'furniture', name: 'Quadro', price: 35, anchor: 'wall', w: 72, h: 56,
      svg: `<rect x="-36" y="-56" width="72" height="56" rx="3" fill="#f6efe0" ${ln}/><path d="M-28 -8l18-22 12 12 10-14 18 24z" fill="#8fa9c9"/><circle cx="14" cy="-38" r="6" fill="#ffd36e"/>` },
    { id: 'fur_clock', slot: 'furniture', name: 'Relógio', price: 30, anchor: 'wall', w: 52, h: 52,
      svg: `<circle cx="0" cy="-26" r="25" fill="#fff" ${ln}/><path d="M0 -26V-44M0 -26L12 -20" fill="none" ${ln}/>` },
    { id: 'fur_shelf', slot: 'furniture', name: 'Prateleira', price: 45, anchor: 'wall', w: 112, h: 44,
      svg: `<rect x="-56" y="-8" width="112" height="8" rx="3" fill="#b07a4a" ${ln}/><path d="M-36 -8v-8h24l4 8" fill="#5cc98b" ${ln}/><rect x="14" y="-30" width="12" height="22" fill="#e63946" ${ln}/><rect x="28" y="-26" width="12" height="18" fill="#4ecdc4" ${ln}/>` },

    // ---- Suprimentos (consumíveis: compre de novo quando acabar) ----
    { id: 'supply_food', slot: 'supply', name: 'Pacote de ração', icon: '🍗', price: 12, grants: { food: 6 } },
    { id: 'supply_water', slot: 'supply', name: 'Garrafão de água', icon: '💧', price: 6, grants: { water: 6 } },
    { id: 'supply_medicine', slot: 'supply', name: 'Remédio', icon: '💊', price: 15, grants: { medicine: 1 } },

    // ---- Chapéus ----
    { id: 'hat_party', slot: 'hat', name: 'Chapéu de festa', price: 50,
      svg: `<path d="M170 78 200 18 230 78z" fill="#7c5cff" ${line}/><path d="M181 60h38M189 42h22" stroke="#ffd36e" stroke-width="4" stroke-linecap="round"/><circle cx="200" cy="16" r="7" fill="#ffd36e" ${line}/>` },
    { id: 'hat_crown', slot: 'hat', name: 'Coroa', price: 150,
      svg: `<path d="M165 82 168 46 184 64 200 38 216 64 232 46 235 82z" fill="#ffd36e" ${line}/><circle cx="200" cy="38" r="5" fill="#e63946" ${line}/>` },
    { id: 'hat_beanie', slot: 'hat', name: 'Gorro', price: 70,
      svg: `<path d="M150 92Q200 18 250 92z" fill="#e63946" ${line}/><rect x="146" y="84" width="108" height="16" rx="8" fill="#b92b38" ${line}/><circle cx="200" cy="52" r="9" fill="#fff" ${line}/>` },
    { id: 'hat_bow', slot: 'hat', name: 'Laço', price: 40,
      svg: `<g transform="translate(142 88) scale(1.35)"><path d="M0 0-24-13-24 13zM0 0 24-13 24 13z" fill="#ff5c8a" ${line}/><circle r="7" fill="#ff5c8a" ${line}/></g>` },
    { id: 'hat_top', slot: 'hat', name: 'Cartola', price: 120,
      svg: `<rect x="164" y="28" width="72" height="54" rx="4" fill="#2b2d42" ${line}/><rect x="164" y="64" width="72" height="11" fill="#e63946"/><rect x="148" y="78" width="104" height="11" rx="5" fill="#2b2d42" ${line}/>` },

    // ---- Rosto ----
    { id: 'face_glasses', slot: 'face', name: 'Óculos redondos', price: 60,
      svg: `<g fill="#cfe8ff" fill-opacity=".3" ${line}><circle cx="155" cy="178" r="25"/><circle cx="245" cy="178" r="25"/></g><path d="M180 176h40M131 172l-17-6M269 172l17-6" fill="none" ${line}/>` },
    { id: 'face_shades', slot: 'face', name: 'Óculos escuros', price: 90,
      svg: `<g fill="#14213d" ${line}><rect x="126" y="160" width="56" height="36" rx="13"/><rect x="218" y="160" width="56" height="36" rx="13"/></g><path d="M182 172h36M126 170l-12-5M274 170l12-5" fill="none" ${line}/><path d="M136 170l12-4M228 170l12-4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>` },
    { id: 'face_mustache', slot: 'face', name: 'Bigode chique', price: 70,
      svg: `<path d="M200 199C190 190 168 192 160 206 176 212 192 210 200 204 208 210 224 212 240 206 232 192 210 190 200 199z" fill="#2b2d42" ${line}/>` },

    // ---- Pescoço ----
    { id: 'neck_bowtie', slot: 'neck', name: 'Gravata borboleta', price: 40,
      svg: `<path d="M200 284 170 268 170 300zM200 284 230 268 230 300z" fill="#e63946" ${line}/><circle cx="200" cy="284" r="8" fill="#b92b38" ${line}/>` },
    { id: 'neck_collar', slot: 'neck', name: 'Coleira com sino', price: 50,
      svg: `<path d="M158 268Q200 304 242 268" fill="none" stroke="#14213d" stroke-width="15" stroke-linecap="round"/><path d="M158 268Q200 304 242 268" fill="none" stroke="#e63946" stroke-width="8" stroke-linecap="round"/><circle cx="200" cy="292" r="10" fill="#ffd36e" ${line}/>` },
    { id: 'neck_scarf', slot: 'neck', name: 'Cachecol', price: 80,
      svg: `<path d="M150 268Q200 304 250 268l8 18Q200 322 142 286z" fill="#4ecdc4" ${line}/><path d="M228 296l14 36-20 5-8-32z" fill="#3ab0a8" ${line}/>` },
  ];
})();
