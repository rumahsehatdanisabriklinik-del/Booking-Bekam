/**
 * ================================================
 *  RUMAH SEHAT DANI SABRI — Keamanan Skrip
 * ================================================
 */

const SECURITY_REQUIRED_KEYS = [
  'NEON_DB_URL',
  'NEON_USER',
  'NEON_PASS',
  'ADMIN_PASSWORD',
  'API_TOKEN'
];

/**
 * Isi Script Properties secara manual lewat Apps Script Project Settings, lalu
 * jalankan helper ini untuk menyimpan nilai yang Anda berikan.
 *
 * Contoh:
 * setSecuritySecrets({
 *   NEON_DB_URL: 'jdbc:postgresql://...',
 *   NEON_USER: 'neondb_owner',
 *   NEON_PASS: '***',
 *   ADMIN_PASSWORD: '***',
 *   API_TOKEN: '***',
 *   GEMINI_API_KEYS: 'key1,key2'
 * });
 */
function setSecuritySecrets(secretMap) {
  if (!secretMap || typeof secretMap !== 'object') {
    throw new Error('Isi secretMap dengan pasangan key/value rahasia.');
  }

  const cleanMap = {};
  Object.keys(secretMap).forEach(key => {
    const value = (secretMap[key] || '').toString().trim();
    if (value) cleanMap[key] = value;
  });

  if (Object.keys(cleanMap).length === 0) {
    throw new Error('Tidak ada secret yang valid untuk disimpan.');
  }

  PropertiesService.getScriptProperties().setProperties(cleanMap, false);
  Logger.log('Secret berhasil disimpan ke Script Properties: ' + Object.keys(cleanMap).join(', '));
}

/**
 * Cek apakah semua secret wajib sudah tersedia.
 */
function validasiKonfigurasiKeamanan() {
  const missing = SECURITY_REQUIRED_KEYS.filter(key => !getRahasia(key));
  if (missing.length > 0) {
    return {
      status: 'error',
      message: 'Secret belum lengkap: ' + missing.join(', ')
    };
  }

  return {
    status: 'success',
    message: 'Konfigurasi keamanan lengkap.'
  };
}

/**
 * Ambil rahasia dari Properties Service
 */
function getRahasia(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function toHexString(bytes) {
  return bytes.map(function(b) {
    const n = (b < 0 ? b + 256 : b);
    return ('0' + n.toString(16)).slice(-2);
  }).join('');
}

function safeEqualText(a, b) {
  const x = String(a || '');
  const y = String(b || '');
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) {
    diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  }
  return diff === 0;
}

function buildCanonicalQuery(params) {
  const data = params || {};
  const ignored = { token: true, ts: true, nonce: true, sig: true };
  const keys = Object.keys(data).filter(function(k) { return !ignored[k]; }).sort();
  return keys.map(function(key) {
    const value = data[key] === undefined || data[key] === null ? '' : data[key];
    return encodeURIComponent(key) + '=' + encodeURIComponent(String(value));
  }).join('&');
}

function verifySignedRequest(e, method) {
  const params = (e && e.parameter) ? e.parameter : {};
  const ts = String(params.ts || '');
  const nonce = String(params.nonce || '');
  const sig = String(params.sig || '');
  const secret = getRahasia('API_TOKEN');
  if (!secret) {
    return { ok: false, message: 'Secret API_TOKEN belum dikonfigurasi.' };
  }

  if (!ts || !nonce || !sig) {
    return { ok: false, message: 'Tanda tangan request tidak lengkap.' };
  }

  const tsNum = parseInt(ts, 10);
  if (!tsNum || Number.isNaN(tsNum)) {
    return { ok: false, message: 'Timestamp request tidak valid.' };
  }

  const now = Date.now();
  const maxSkewMs = 5 * 60 * 1000;
  if (Math.abs(now - tsNum) > maxSkewMs) {
    return { ok: false, message: 'Timestamp request kedaluwarsa.' };
  }

  const requestMethod = String(method || '').toUpperCase();
  const canonicalQuery = buildCanonicalQuery(params);
  const body = (requestMethod === 'POST' && e && e.postData && e.postData.contents)
    ? String(e.postData.contents)
    : '';
  const baseWithBody = [ts, nonce, requestMethod, canonicalQuery, body].join('\n');
  const baseWithoutBody = [ts, nonce, requestMethod, canonicalQuery, ''].join('\n');
  const expectedSig = toHexString(Utilities.computeHmacSha256Signature(baseWithBody, secret));
  const expectedSigWithoutBody = toHexString(Utilities.computeHmacSha256Signature(baseWithoutBody, secret));

  if (!safeEqualText(sig, expectedSig) && !safeEqualText(sig, expectedSigWithoutBody)) {
    return { ok: false, message: 'Signature request tidak valid.' };
  }

  const replayCache = CacheService.getScriptCache();
  const replayKey = 'reqsig:' + nonce;
  if (replayCache.get(replayKey)) {
    return { ok: false, message: 'Request replay terdeteksi.' };
  }
  replayCache.put(replayKey, '1', 300);

  return { ok: true };
}

function sanitizePublicApiResponse(action, payload) {
  const result = payload || {};
  const safe = {
    status: String(result.status || 'success')
  };
  if (result.message !== undefined) safe.message = String(result.message || '');
  if (result.info !== undefined) safe.info = result.info;

  const data = result.data;
  const actionName = String(action || '');

  if (actionName === 'getInitData') {
    safe.data = {
      setting: sanitizePublicSetting(data && data.setting),
      terapis: sanitizePublicTerapisList(data && data.terapis),
      layanan: sanitizePublicLayananList(data && data.layanan)
    };
    return safe;
  }

  if (actionName === 'getTerapis') {
    safe.data = sanitizePublicTerapisList(data);
    return safe;
  }

  if (actionName === 'getLayananList') {
    safe.data = sanitizePublicLayananList(data);
    return safe;
  }

  if (actionName === 'getLandingSettings') {
    safe.data = sanitizePublicLandingSettings(data);
    return safe;
  }

  if (actionName === 'getLandingDataFull') {
    safe.data = {
      settings: sanitizePublicLandingSettings(data && data.settings),
      layanan: sanitizePublicLayananList(data && data.layanan)
    };
    return safe;
  }

  if (actionName === 'getArtikelList') {
    safe.data = sanitizePublicArtikelList(data);
    return safe;
  }

  if (actionName === 'getGaleriList') {
    safe.data = sanitizePublicGaleriList(data);
    return safe;
  }

  if (actionName === 'cekStatusUser') {
    safe.data = sanitizePublicStatusList(data);
    return safe;
  }

  if (actionName === 'cekWaktu') {
    safe.data = Array.isArray(data) ? data.map(function(item) { return String(item); }) : [];
    return safe;
  }

  if (actionName === 'simpanBookingData') {
    safe.data = {
      whatsappUrl: data && data.whatsappUrl ? String(data.whatsappUrl) : '',
      row: data && data.row !== undefined ? data.row : ''
    };
    return safe;
  }

  if (actionName === 'batalByUser') {
    safe.data = data && typeof data === 'object' ? { row: data.row || '' } : {};
    return safe;
  }

  if (actionName === 'submitReview') {
    safe.data = data && typeof data === 'object' ? { row: data.row || '' } : {};
    return safe;
  }

  if (actionName === 'generateAITips') {
    safe.data = {
      text: data && data.text ? String(data.text) : ''
    };
    return safe;
  }

  if (actionName === 'selfCheckIn') {
    safe.data = sanitizePublicStatusRecord(data);
    return safe;
  }

  safe.data = stripSensitiveDeep(data);
  return safe;
}

function sanitizePublicSetting(setting) {
  const cfg = setting || {};
  return {
    jamOperasional: Array.isArray(cfg.jamOperasional) ? cfg.jamOperasional : [],
    jamIstirahat: Array.isArray(cfg.jamIstirahat) ? cfg.jamIstirahat : [],
    hariLibur: Array.isArray(cfg.hariLibur) ? cfg.hariLibur : [],
    sesiBekam: Array.isArray(cfg.sesiBekam) ? cfg.sesiBekam : [],
    waAdmin: cfg.waAdmin ? String(cfg.waAdmin) : '',
    mapsLink: cfg.mapsLink ? String(cfg.mapsLink) : ''
  };
}

function sanitizePublicTerapisList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function(item) {
    return {
      nama: item && item.nama ? String(item.nama) : '',
      gender: item && item.gender ? String(item.gender) : '',
      status: item && item.status ? String(item.status) : ''
    };
  });
}

function sanitizePublicLayananList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function(item) {
    const row = item || {};
    return {
      nama: row.nama ? String(row.nama) : '',
      deskripsi: row.deskripsi ? String(row.deskripsi) : '',
      detail: row.detail ? String(row.detail) : '',
      icon: row.icon ? String(row.icon) : '',
      foto: row.foto ? String(row.foto) : '',
      terlaris: Boolean(row.terlaris),
      warna: row.warna ? String(row.warna) : '',
      hariAktif: Array.isArray(row.hariAktif) ? row.hariAktif : [],
      terapisKhusus: Array.isArray(row.terapisKhusus) ? row.terapisKhusus : [],
      lintasGender: Boolean(row.lintasGender)
    };
  });
}

function sanitizePublicLandingSettings(data) {
  const src = (data && typeof data === 'object') ? data : {};
  const blocked = {
    cms_checkin_secret_code: true,
    admin_password: true,
    admin_pass: true,
    adminpass: true
  };
  const out = {};
  Object.keys(src).forEach(function(key) {
    if (!/^cms_/i.test(key)) return;
    if (blocked[key]) return;
    out[key] = src[key];
  });
  return out;
}

function sanitizePublicArtikelList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function(item) {
    const row = item || {};
    return {
      id: row.id || '',
      judul: row.judul ? String(row.judul) : '',
      ringkasan: row.ringkasan ? String(row.ringkasan) : '',
      isi: row.isi ? String(row.isi) : '',
      kategori: row.kategori ? String(row.kategori) : '',
      tanggal: row.tanggal ? String(row.tanggal) : '',
      foto: row.foto ? String(row.foto) : ''
    };
  });
}

function sanitizePublicGaleriList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(function(item) {
    const row = item || {};
    return {
      id: row.id || '',
      judul: row.judul ? String(row.judul) : '',
      url_foto: row.url_foto ? String(row.url_foto) : '',
      kategori: row.kategori ? String(row.kategori) : '',
      keterangan: row.keterangan ? String(row.keterangan) : '',
      urutan: row.urutan || 0
    };
  });
}

function sanitizePublicStatusList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(sanitizePublicStatusRecord);
}

function sanitizePublicStatusRecord(item) {
  const row = item || {};
  const checkIn = row.checkIn && typeof row.checkIn === 'object'
    ? {
        payload: row.checkIn.payload ? String(row.checkIn.payload) : '',
        validFrom: row.checkIn.validFrom ? String(row.checkIn.validFrom) : '',
        expiresAt: row.checkIn.expiresAt ? String(row.checkIn.expiresAt) : ''
      }
    : null;

  const out = {
    row: row.row || '',
    nama: row.nama ? String(row.nama) : '',
    nohp: row.nohp ? String(row.nohp) : '',
    tanggal: row.tanggal ? String(row.tanggal) : '',
    waktu: row.waktu ? String(row.waktu) : '',
    terapis: row.terapis ? String(row.terapis) : '',
    layanan: row.layanan ? String(row.layanan) : '',
    status: row.status ? String(row.status) : '',
    rating: row.rating || '',
    ulasan: row.ulasan ? String(row.ulasan) : ''
  };
  if (checkIn) out.checkIn = checkIn;
  if (row.debug && typeof row.debug === 'object') {
    out.debug = stripSensitiveDeep(row.debug);
  }
  return out;
}

function stripSensitiveDeep(value) {
  const deny = {
    adminpass: true,
    admin_password: true,
    password: true,
    pass: true,
    sessiontoken: true,
    token: true,
    apikey: true,
    secret: true,
    secretcode: true,
    cms_checkin_secret_code: true
  };

  if (Array.isArray(value)) {
    return value.map(stripSensitiveDeep);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const out = {};
  Object.keys(value).forEach(function(key) {
    const normalized = key.toLowerCase();
    if (deny[normalized]) return;
    out[key] = stripSensitiveDeep(value[key]);
  });
  return out;
}

function isPublicRateLimitedAction(action, method) {
  const key = String(action || '').toLowerCase();
  const m = String(method || '').toUpperCase();
  if (m === 'GET') {
    return [
      'getinitdata', 'getterapis', 'cekwaktu', 'cekstatususer',
      'getlandingsettings', 'getlayananlist', 'getlandingdatafull',
      'getartikellist', 'getgalerilist'
    ].indexOf(key) !== -1;
  }
  if (m === 'POST') {
    return [
      'simpanbookingdata', 'batalbyuser', 'submitreview',
      'generateaitips', 'selfcheckin', 'authadmin'
    ].indexOf(key) !== -1;
  }
  return false;
}

function getPublicRateRule(action) {
  const key = String(action || '').toLowerCase();
  if (key === 'generateaitips') return { windowSec: 60, maxHits: 6, idField: '' };
  if (key === 'cekstatususer') return { windowSec: 60, maxHits: 20, idField: 'hp' };
  if (key === 'simpanbookingdata') return { windowSec: 300, maxHits: 10, idField: 'nohp' };
  if (key === 'batalbyuser') return { windowSec: 300, maxHits: 6, idField: 'hp' };
  if (key === 'submitreview') return { windowSec: 300, maxHits: 6, idField: 'hp' };
  if (key === 'selfcheckin') return { windowSec: 60, maxHits: 12, idField: 'payload' };
  if (key === 'authadmin') return { windowSec: 300, maxHits: 20, idField: '' };
  if (key === 'getinitdata') return { windowSec: 60, maxHits: 30, idField: '' };
  if (key === 'getlandingsettings') return { windowSec: 60, maxHits: 60, idField: '' };
  if (key === 'getlayananlist') return { windowSec: 60, maxHits: 40, idField: '' };
  if (key === 'getlandingdatafull') return { windowSec: 60, maxHits: 40, idField: '' };
  if (key === 'getartikellist') return { windowSec: 60, maxHits: 25, idField: '' };
  if (key === 'getgalerilist') return { windowSec: 60, maxHits: 25, idField: '' };
  if (key === 'cekwaktu') return { windowSec: 60, maxHits: 30, idField: 'terapis' };
  if (key === 'getterapis') return { windowSec: 60, maxHits: 40, idField: '' };
  return { windowSec: 60, maxHits: 20, idField: '' };
}

function normalizeRateValue(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
}

function getRateIdentifier(action, params, body, rule) {
  const idField = rule && rule.idField ? rule.idField : '';
  if (!idField) return '';
  const p = params || {};
  const b = body || {};
  const raw = p[idField] || b[idField] || b.hp || b.nohp || '';
  return normalizeRateValue(raw);
}

function readRateState(cache, key) {
  const raw = cache.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    cache.remove(key);
    return null;
  }
}

function bumpRateCounter(cache, key, rule, nowMs) {
  const ttl = rule.windowSec;
  const state = readRateState(cache, key);
  if (!state || !state.startMs || (nowMs - state.startMs) > (rule.windowSec * 1000)) {
    const fresh = { startMs: nowMs, count: 1 };
    cache.put(key, JSON.stringify(fresh), ttl);
    return fresh;
  }

  state.count = (state.count || 0) + 1;
  cache.put(key, JSON.stringify(state), ttl);
  return state;
}

function enforcePublicRateLimit(action, method, params, body) {
  if (!isPublicRateLimitedAction(action, method)) {
    return { ok: true };
  }

  const cache = CacheService.getScriptCache();
  const rule = getPublicRateRule(action);
  const now = Date.now();
  const act = String(action || '').toLowerCase();
  const clientKey = normalizeRateValue((params && params.clientKey) || 'anon');
  const ident = getRateIdentifier(act, params, body, rule);

  const globalKey = 'rl:g:' + act + ':' + clientKey;
  const globalState = bumpRateCounter(cache, globalKey, rule, now);
  if (globalState.count > rule.maxHits) {
    return {
      ok: false,
      message: 'Permintaan terlalu sering. Mohon tunggu sebentar lalu coba lagi.'
    };
  }

  if (ident) {
    const idKey = 'rl:i:' + act + ':' + ident;
    const idRule = { windowSec: rule.windowSec, maxHits: Math.max(3, Math.floor(rule.maxHits / 2)) };
    const idState = bumpRateCounter(cache, idKey, idRule, now);
    if (idState.count > idRule.maxHits) {
      return {
        ok: false,
        message: 'Permintaan untuk data ini terlalu sering. Coba lagi beberapa saat.'
      };
    }
  }

  return { ok: true };
}
