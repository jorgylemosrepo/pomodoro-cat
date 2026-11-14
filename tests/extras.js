/** Testa sons (incluindo o da conquista), backup do progresso e notificações. Uso: node tests/extras.js */
const fs = require('fs');
const path = require('path');
global.window = global;
for (const file of ['random', 'config', 'sound', 'notify', 'backup']) (0, eval)(fs.readFileSync(path.join(__dirname, '..', 'js', `${file}.js`), 'utf8'));
const { Sound, Notify, Backup } = Gatinho;

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'OK   ' : 'FALHA'} ${name}${detail ? ` (${detail})` : ''}`);
}

// ---------- Sons (com um AudioContext de mentira que anota tudo) ----------
let osc = [];
let created = 0;
global.AudioContext = class {
  constructor() { created++; this.currentTime = 10; this.state = 'running'; this.destination = {}; }
  createOscillator() {
    const o = { type: '', frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect: (n) => n, start(t) { this.at = t; }, stop() {} };
    osc.push(o);
    return o;
  }
  createGain() {
    const g = { ramps: [], gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime: (v) => g.ramps.push(v) }, connect: (n) => n };
    osc.at(-1).amp = g;
    return g;
  }
  createBiquadFilter() { return { type: '', frequency: { value: 0 }, connect: (n) => n }; }
  resume() {}
};
const reset = () => { osc = []; };

Sound.configure({ sound: true, soundVolume: 70 });
Sound.achievement();
const bells = osc.filter((o) => o.amp);
const fundamentals = bells.filter((_, i) => i % 3 === 0);
check('conquista: 5 sininhos de 3 tons cada (fundamental + 2 harmônicos)', osc.length === 15, `${osc.length}`);
check('conquista: arpejo dó-mi-sol-dó (C5 E5 G5 C6) e um brilho no agudo', fundamentals.map((o) => o.frequency.value).join() === '523.25,659.25,783.99,1046.5,2093');
check('conquista: as notas sobem em sequência, uma depois da outra', fundamentals.every((o, i) => i === 0 || o.at > fundamentals[i - 1].at));
check('conquista: o arpejo é rápido (< 0,5 s) e o som é suave', fundamentals.at(-1).at - fundamentals[0].at < 0.5 && Math.max(...bells.flatMap((o) => o.amp.ramps)) <= 0.22 * 0.7 + 1e-9);
check('o tom fundamental é o mais forte; os harmônicos, mais fracos', (() => { const [a, b, c] = bells.slice(0, 3).map((o) => o.amp.ramps[0]); return a > b && b > c; })());
check('sons tocam com um único AudioContext (reaproveitado)', (() => { Sound.coin(); Sound.timerDone(); return created === 1; })());
reset(); Sound.coin();
check('moeda: 2 sininhos', osc.length === 6);
reset(); Sound.timerDone();
check('fim do timer: 3 sininhos', osc.length === 9);
reset(); Sound.meow();
check('miado e ronronar geram som', osc.length === 1 && (reset(), Sound.purr(), osc.length === 2));

reset(); Sound.configure({ sound: false, soundVolume: 70 }); Sound.achievement(); Sound.meow(); Sound.purr(); Sound.coin();
check('som desligado: silêncio total', osc.length === 0);
reset(); Sound.configure({ sound: true, soundVolume: 0 }); Sound.achievement();
check('volume zero: silêncio', osc.length === 0);
reset(); Sound.configure({ sound: true, soundVolume: 100 }); Sound.achievement();
const loud = Math.max(...osc.flatMap((o) => o.amp?.ramps ?? []));
reset(); Sound.configure({ sound: true, soundVolume: 40 }); Sound.achievement();
const soft = Math.max(...osc.flatMap((o) => o.amp?.ramps ?? []));
check('o volume escala o som (40% = 0,4 do volume cheio)', Math.abs(soft / loud - 0.4) < 1e-6, `${(soft / loud).toFixed(2)}`);
check('volume e liga/desliga vêm das configurações (e valores absurdos são limitados)', (() => { Sound.configure({ sound: true, soundVolume: 250 }); const high = Sound.volume; Sound.configure({ soundVolume: -5 }); return high === 1 && Sound.volume === 0; })());
check('sem AudioContext disponível não quebra', (() => { Sound.configure({ sound: true, soundVolume: 70 }); const real = global.AudioContext; Sound.context = null; global.AudioContext = function () { throw new Error('sem áudio'); }; try { Sound.achievement(); Sound.meow(); return true; } catch { return false; } finally { global.AudioContext = real; } })());

// ---------- Backup ----------
const save = { pet: { score: 5, life: { name: 'Mingau' } }, profile: { coins: 99 }, pomodoro: { mode: 'idle' }, savedAt: 1 };
const text = Backup.serialize(save, Date.UTC(2026, 9, 26));
check('exportar: arquivo legível com o cabeçalho do app', JSON.parse(text).app === 'gatinho-pomodoro' && JSON.parse(text).version === 1 && JSON.parse(text).exportedAt === '2026-10-26T00:00:00.000Z' && text.includes('\n'));
check('nome do arquivo tem a data', Backup.fileName(Date.UTC(2026, 9, 26)) === 'gatinho-backup-2026-10-26.json');
check('importar devolve exatamente o que foi exportado', JSON.stringify(Backup.parse(text).data) === JSON.stringify(save));
check('importar também aceita um save puro (sem cabeçalho)', Backup.parse(JSON.stringify(save)).ok && Backup.parse(JSON.stringify({ profile: {} })).ok);
const bad = ['', '   ', 'isso não é json', '[]', '"texto"', '123', 'null', '{}', '{"pet":1,"profile":"x"}', JSON.stringify({ app: 'gatinho-pomodoro', version: 1, data: { nada: true } }), JSON.stringify({ app: 'outro-app', data: { pet: {} } }), JSON.stringify({ app: 'gatinho-pomodoro', version: 99, data: save }), 'x'.repeat(Backup.MAX_CHARS + 1), undefined, null, 42];
check('importar recusa lixo, listas, arquivos de outro app, versão futura e arquivo gigante', bad.every((value) => Backup.parse(value).ok === false), bad.filter((v) => Backup.parse(v).ok).join('|'));
check('toda recusa explica o motivo em português', bad.every((value) => /[a-zé]/i.test(Backup.parse(value).reason ?? '')));
check('baixar cria um link temporário e o remove', (() => {
  const log = [];
  const doc = { createElement: () => ({ click: () => log.push('click'), remove: () => log.push('remove') }), body: { append: () => log.push('append') } };
  global.URL = { createObjectURL: () => 'blob:x', revokeObjectURL: () => log.push('revoke') };
  global.Blob = class { constructor(parts, opts) { this.parts = parts; this.type = opts.type; } };
  Backup.download('{}', 'a.json', doc);
  return log.join() === 'append,click,remove';
})());

// ---------- Notificações ----------
check('sem suporte a notificações: avisa e fica desligado', (() => { delete global.Notification; return !Notify.supported && Notify.enable().then((r) => !r.ok && r.reason.length > 5); })() instanceof Promise);
(async () => {
  const shown = [];
  global.Notification = class { constructor(title, opts) { shown.push({ title, ...opts }); } };
  Notification.permission = 'default';
  Notification.requestPermission = async () => { Notification.permission = 'granted'; return 'granted'; };
  const on = await Notify.enable();
  check('ligar pede permissão e fica ativo', on.ok && Notify.enabled && Notify.permitted);
  Notify.show('Oi', 'corpo');
  check('mostra o aviso sem som (o som é do app)', shown.length === 1 && shown[0].title === 'Oi' && shown[0].body === 'corpo' && shown[0].silent === true);
  Notify.disable(); Notify.show('x', 'y');
  check('desligado: não mostra nada', shown.length === 1);
  Notification.permission = 'default'; Notification.requestPermission = async () => 'denied';
  const denied = await Notify.enable();
  check('permissão negada: explica e continua desligado', !denied.ok && !Notify.enabled && denied.reason.includes('negada'));
  Notify.enabled = true; Notification.permission = 'denied'; Notify.show('x', 'y');
  check('sem permissão não mostra, mesmo "ligado"', shown.length === 1);

  console.log(failures ? `\n${failures} verificação(ões) falharam` : '\nTudo certo');
  process.exit(failures ? 1 : 0);
})();
