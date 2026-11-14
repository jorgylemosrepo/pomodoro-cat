/**
 * Lê a página de resultados do YouTube e extrai as músicas. Não usa a API oficial:
 * depende do formato da página, que o YouTube pode mudar a qualquer momento
 * (nesse caso a busca volta vazia; colar links e usar a chave da API continuam funcionando).
 */

/** @returns {{id: string, title: string, channel: string, duration: string, thumb: string}[]} */
function parseSearchResults(html) {
  const match = String(html).match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!match) return [];
  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return [];
  }
  const sections = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents ?? [];
  return sections
    .flatMap((section) => section.itemSectionRenderer?.contents ?? [])
    .filter((item) => item.videoRenderer?.videoId)
    .slice(0, 10)
    .map(({ videoRenderer: v }) => ({
      id: v.videoId,
      title: (v.title?.runs ?? []).map((run) => run.text).join(''),
      channel: v.ownerText?.runs?.[0]?.text ?? '',
      duration: v.lengthText?.simpleText ?? '',
      thumb: v.thumbnail?.thumbnails?.[0]?.url ?? '',
    }));
}

function searchUrl(query) {
  // sp=EgIQAQ== filtra só vídeos (sem canais e playlists)
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`;
}

module.exports = { parseSearchResults, searchUrl };
