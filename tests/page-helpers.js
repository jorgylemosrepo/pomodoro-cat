/** Apoio dos testes de página: espera o app terminar de carregar (em vez de um tempo fixo). */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolve quando a barra de painéis está montada (o main.js terminou de iniciar). */
async function ready(dom, timeout = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (dom.window.document.querySelector('#toolbar [data-panel="settings"]')) {
      await wait(50);
      return true;
    }
    await wait(25);
  }
  throw new Error('O app não terminou de carregar a tempo.');
}

/** Atalho: chama o callback quando o app estiver pronto. */
function whenReady(dom, callback) {
  ready(dom).then(callback, (error) => { console.log(error.message); process.exit(1); });
}

module.exports = { wait, ready, whenReady };
