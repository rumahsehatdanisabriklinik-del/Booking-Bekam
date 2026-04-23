import crypto from 'node:crypto';

const FALLBACK_TITLE = 'Artikel & Edukasi | Rumah Sehat Dani Sabri';
const FALLBACK_DESCRIPTION = 'Catatan kesehatan, bekam, ruqyah, dan perawatan diri dari Rumah Sehat Dani Sabri.';
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1505751172107-5d3d7a845366?w=1200';

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function stripHtml(value) {
    return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(text) {
    return String(text || '').toLowerCase().trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

function normalizeImageUrl(url) {
    const value = String(url || '').trim();
    if (!value) return FALLBACK_IMAGE;
    const match = value.match(/drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
    if (match?.[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return value;
}

function canonicalizeParams(params = {}) {
    const ignored = new Set(['token', 'ts', 'nonce', 'sig']);
    const keys = Object.keys(params).filter((k) => !ignored.has(k)).sort();
    return keys.map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key] ?? ''))}`).join('&');
}

function buildRequestSignature(secret, method, params) {
    const ts = Date.now().toString();
    const nonce = crypto.randomBytes(8).toString('hex');
    const base = [ts, nonce, method.toUpperCase(), canonicalizeParams(params), ''].join('\n');
    const sig = crypto.createHmac('sha256', secret).update(base).digest('hex');
    return { ts, nonce, sig };
}

async function fetchArticles() {
    const GAS_URL = process.env.GAS_URL;
    const APP_TOKEN = process.env.APP_TOKEN;
    if (!GAS_URL || !APP_TOKEN) return [];

    const params = { action: 'getArtikelList', clientKey: 'share-preview' };
    const signature = buildRequestSignature(APP_TOKEN, 'GET', params);
    const url = new URL(GAS_URL);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    url.searchParams.set('ts', signature.ts);
    url.searchParams.set('nonce', signature.nonce);
    url.searchParams.set('sig', signature.sig);

    const response = await fetch(url.toString());
    const payload = await response.json();
    return payload && payload.status === 'success' && Array.isArray(payload.data) ? payload.data : [];
}

function renderShareHtml({ article, slug, origin }) {
    const title = article?.judul ? `${article.judul} | Rumah Sehat Dani Sabri` : FALLBACK_TITLE;
    const description = article
        ? stripHtml(article.ringkasan || article.isi || FALLBACK_DESCRIPTION).slice(0, 220)
        : FALLBACK_DESCRIPTION;
    const image = normalizeImageUrl(article?.foto);
    const cleanUrl = `${origin}/artikel/${encodeURIComponent(slug)}`;
    const targetUrl = `${origin}/artikel.html#${encodeURIComponent(slug)}`;

    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(cleanUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Rumah Sehat Dani Sabri">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:url" content="${escapeHtml(cleanUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}">
</head>
<body>
  <script>location.replace(${JSON.stringify(targetUrl)});</script>
  <p><a href="${escapeHtml(targetUrl)}">Buka artikel</a></p>
</body>
</html>`;
}

export default async function handler(req, res) {
    const origin = `https://${req.headers.host || 'rumahsehatdanisabri.vercel.app'}`;
    const rawSlug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
    const slug = slugify(rawSlug || '');

    try {
        const articles = await fetchArticles();
        const article = articles.find((item) => slugify(item.judul) === slug);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
        res.status(200).send(renderShareHtml({ article, slug, origin }));
    } catch (error) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.status(200).send(renderShareHtml({ article: null, slug, origin }));
    }
}
