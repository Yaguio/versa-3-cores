const { put, list } = require('@vercel/blob');

const BLOB_PATH = 'ranking.json';
const MAX_ENTRIES = 10;
const MAX_NAME_LENGTH = 24;

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
    const dia = Number(body.dia);
    if (!Number.isFinite(dia) || dia < 1 || dia > 30) {
      res.status(400).json({ error: 'dia inválido' });
      return;
    }

    const currentList = await readRanking();
    currentList.push({ jogador: jogador, dia: dia, quando: Date.now() });
    currentList.sort(function (a, b) { return a.dia - b.dia; });
    const trimmed = currentList.slice(0, MAX_ENTRIES);
    await writeRanking(trimmed);
    res.status(200).json({ list: trimmed });
    return;
  }

  res.status(405).json({ error: 'method not allowed' });
};
