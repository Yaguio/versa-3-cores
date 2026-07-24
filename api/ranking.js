const { put, list } = require('@vercel/blob');

const BLOB_PATH = 'ranking.json';
const MAX_ENTRIES = 10;
const MAX_NAME_LENGTH = 24;
const TOTAL_DIAS = 15;
const MAX_TEMPO_MINUTOS = TOTAL_DIAS * 1440;

async function readRanking() {
  try {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 1 });
    if (!blobs.length) return [];
    const resp = await fetch(blobs[0].url, { cache: 'no-store' });
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

// entradas antigas (de antes do ranking por tempo) só tinham "dia" — trata como fim daquele dia
function tempoOf(entry) {
  return typeof entry.tempoMinutos === 'number' ? entry.tempoMinutos : (Number(entry.dia) || 0) * 1440;
}

async function writeRanking(list_) {
  await put(BLOB_PATH, JSON.stringify(list_), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const currentList = await readRanking();
    res.status(200).json({ list: currentList });
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; }
    }
    body = body || {};

    const jogador = String(body.jogador || 'Anônimo').slice(0, MAX_NAME_LENGTH).trim() || 'Anônimo';
    const tempoMinutos = Number(body.tempoMinutos);
    if (!Number.isFinite(tempoMinutos) || tempoMinutos < 0 || tempoMinutos > MAX_TEMPO_MINUTOS) {
      res.status(400).json({ error: 'tempoMinutos inválido' });
      return;
    }

    const currentList = await readRanking();
    currentList.push({ jogador: jogador, tempoMinutos: tempoMinutos, quando: Date.now() });
    currentList.sort(function (a, b) { return tempoOf(a) - tempoOf(b); });
    const trimmed = currentList.slice(0, MAX_ENTRIES);
    await writeRanking(trimmed);
    res.status(200).json({ list: trimmed });
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
};
