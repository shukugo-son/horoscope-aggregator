/**
 * Netlify Function - 複数占いサイトから星座運勢を取得
 * ソース(日本語): RSK山陽放送 / 週刊女性PRIME / LINE占い / うらなえる / anna
 * ソース(英語)  : AstroSage
 */

const axios = require('axios');
const cheerio = require('cheerio');

const SIGN_JA = {
    aries:       ['牡羊座', 'おひつじ座'],
    taurus:      ['牡牛座', 'おうし座'],
    gemini:      ['双子座', 'ふたご座'],
    cancer:      ['蟹座',   'かに座'],
    leo:         ['獅子座', 'しし座'],
    virgo:       ['乙女座', 'おとめ座'],
    libra:       ['天秤座', 'てんびん座'],
    scorpio:     ['蠍座',   'さそり座'],
    sagittarius: ['射手座', 'いて座'],
    capricorn:   ['山羊座', 'やぎ座'],
    aquarius:    ['水瓶座', 'みずがめ座'],
    pisces:      ['魚座',   'うお座'],
};

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ja-JP,ja;q=0.9,en;q=0.8',
};

// ────────────────────────────────────────────
// メインハンドラー
// ────────────────────────────────────────────
exports.handler = async (event) => {
    const cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

    const sign = event.queryStringParameters?.sign;
    if (!sign || !SIGN_JA[sign]) {
        return { statusCode: 400, headers: cors, body: JSON.stringify({ error: '無効な星座です' }) };
    }

    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const dateStr = `${today.getFullYear()}/${today.getMonth() + 1}/${today.getDate()}`;

    const [rsk, jprime, line, unkoi, anna, astrosage] = await Promise.allSettled([
        fetchRSK(sign),
        fetchJprime(sign),
        fetchLine(sign),
        fetchUnkoi(sign),
        fetchAnna(sign),
        fetchAstroSage(sign),
    ]);

    const results = [rsk, jprime, line, unkoi, anna, astrosage]
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

    // 順位あり→昇順、順位なし→末尾
    results.sort((a, b) => {
        if (a.rank == null && b.rank == null) return 0;
        if (a.rank == null) return 1;
        if (b.rank == null) return -1;
        return a.rank - b.rank;
    });

    return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ sign, signJa: SIGN_JA[sign][0], date: dateStr, results }),
    };
};

// ────────────────────────────────────────────
// RSK山陽放送
// 形式: 第X位 [星座名] ... 【ラッキーカラー】VALUE ... 【ラッキーアイテム】VALUE
// ────────────────────────────────────────────
async function fetchRSK(signId) {
    const [r1, r2] = await Promise.all([
        axios.get('https://www.rsk.co.jp/horoscope/',        { timeout: 10000, headers: HEADERS }),
        axios.get('https://www.rsk.co.jp/horoscope/2nd.php', { timeout: 10000, headers: HEADERS }),
    ]);

    const all = {};
    parseRSKPage(r1.data, all);
    parseRSKPage(r2.data, all);

    const d = all[signId];
    if (!d) return null;

    return {
        source: 'RSK山陽放送',
        url: 'https://www.rsk.co.jp/horoscope/',
        rank: d.rank, total: 12,
        luckyColor: d.luckyColor || null,
        luckyItem:  d.luckyItem  || null,
    };
}

function parseRSKPage(html, out) {
    const $ = cheerio.load(html);
    const text = $('body').text().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
    const blocks = text.split(/(?=第\d+位)/);

    for (const block of blocks) {
        const rankM = block.match(/^第(\d+)位/);
        if (!rankM) continue;
        const rank = parseInt(rankM[1]);
        let found = null;
        for (const [sid, names] of Object.entries(SIGN_JA)) {
            if (out[sid]) continue;
            if (names.some(n => block.includes(n))) { found = sid; break; }
        }
        if (!found) continue;
        const colorM = block.match(/【ラッキーカラー】([^\s【】\n]{1,20})/);
        const itemM  = block.match(/【ラッキーアイテム】([^\s【】\n]{1,30})/);
        out[found] = { rank, luckyColor: colorM?.[1]?.trim() || null, luckyItem: itemM?.[1]?.trim() || null };
    }
}

// ────────────────────────────────────────────
// 週刊女性PRIME
// ────────────────────────────────────────────
async function fetchJprime(signId) {
    const url = `https://www.jprime.jp/list/uranai/${signId}`;
    const res = await axios.get(url, { timeout: 10000, headers: HEADERS });
    const $ = cheerio.load(res.data);
    const text = $('body').text().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

    let rankM = text.match(/順位[：:\s]+(\d{1,2})\s*位/);
    if (!rankM) {
        for (const name of SIGN_JA[signId]) {
            const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const m = text.match(new RegExp(`([1-9]|1[0-2])位.{0,60}?${esc}|${esc}.{0,60}?([1-9]|1[0-2])位`));
            if (m) { rankM = [null, m[1] || m[2]]; break; }
        }
    }
    if (!rankM) return null;

    const colorM = text.match(/ラッキーカラー[：:\s]+([^\s、。]{1,20})/);
    const itemM  = text.match(/ラッキーアイテム[：:\s]+([^\s、。]{1,30})/);

    return {
        source: '週刊女性PRIME',
        url, rank: parseInt(rankM[1]), total: 12,
        luckyColor: colorM?.[1]?.trim() || null,
        luckyItem:  itemM?.[1]?.trim()  || null,
    };
}

// ────────────────────────────────────────────
// LINE占い
// ────────────────────────────────────────────
async function fetchLine(signId) {
    const [mainRes, signRes] = await Promise.all([
        axios.get('https://fortune.line.me/horoscope/',         { timeout: 10000, headers: HEADERS }),
        axios.get(`https://fortune.line.me/horoscope/${signId}/`, { timeout: 10000, headers: HEADERS }),
    ]);

    const $main = cheerio.load(mainRes.data);
    const seen = new Set(); const ordered = [];
    $main('a[href*="/horoscope/"]').each((_, el) => {
        const href = ($main(el).attr('href') || '').replace(/\/$/, '');
        const m = href.match(/\/horoscope\/([a-z]+)$/);
        if (m && m[1] !== 'horoscope' && SIGN_JA[m[1]] && !seen.has(m[1])) {
            seen.add(m[1]); ordered.push(m[1]);
        }
    });
    const rank = ordered.indexOf(signId) + 1;
    if (rank === 0) return null;

    const $sign = cheerio.load(signRes.data);
    const text = $sign('body').text().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
    const itemM  = text.match(/ラッキーアイテム(.+?)(?=ラッキーカラー|総合運|恋愛運)/);
    const colorM = text.match(/ラッキーカラー(.+?)(?=総合運|恋愛運|金運|仕事運)/);

    return {
        source: 'LINE占い',
        url: `https://fortune.line.me/horoscope/${signId}/`,
        rank, total: 12,
        luckyColor: colorM?.[1]?.trim() || null,
        luckyItem:  itemM?.[1]?.trim()  || null,
    };
}

// ────────────────────────────────────────────
// うらなえる
// ────────────────────────────────────────────
async function fetchUnkoi(signId) {
    const signUrl = `https://unkoi.com/fortune-luck/dailyranking/${signId}/`;
    const [mainRes, signRes] = await Promise.all([
        axios.get('https://unkoi.com/fortune-luck/dailyranking', { timeout: 10000, headers: HEADERS }),
        axios.get(signUrl, { timeout: 10000, headers: HEADERS }),
    ]);

    const $main = cheerio.load(mainRes.data);
    const seen = new Set(); const ordered = [];
    $main('a[href*="/fortune-luck/dailyranking/"]').each((_, el) => {
        const href = ($main(el).attr('href') || '').replace(/\/$/, '');
        const m = href.match(/\/fortune-luck\/dailyranking\/([a-z]+)$/);
        if (m && !seen.has(m[1])) { seen.add(m[1]); ordered.push(m[1]); }
    });
    const rank = ordered.indexOf(signId) + 1;
    if (rank === 0) return null;

    const $sign = cheerio.load(signRes.data);
    const text = $sign('body').text().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
    const numM   = text.match(/ラッキーナンバー(.+?)ラッキーカラー/);
    const colorM = text.match(/ラッキーカラー(.+?)(?=恋愛運|金運|仕事運|\s{2})/);

    return {
        source: 'うらなえる',
        url: signUrl, rank, total: 12,
        luckyColor:  colorM?.[1]?.trim() || null,
        luckyNumber: numM?.[1]?.trim()   || null,
        luckyItem:   null,
    };
}

// ────────────────────────────────────────────
// anna (アンナ)
// タグページから最新の1-3位・4-12位記事を取得してパース
// 形式: 第X位：星座名 ... ラッキーカラー：VALUE
// ────────────────────────────────────────────
async function fetchAnna(signId) {
    // タグページから最新記事URLを2件取得
    const tagRes = await axios.get('https://anna-media.jp/archives/tag/horoscope', {
        timeout: 10000, headers: HEADERS,
    });
    const $tag = cheerio.load(tagRes.data);
    const seen = new Set(); const articleUrls = [];

    $tag('a[href*="/archives/"]').each((_, el) => {
        const href  = ($tag(el).attr('href') || '').split('?')[0];
        const title = $tag(el).text();
        if (/\/archives\/\d+$/.test(href) && /\d+位/.test(title) && !seen.has(href)) {
            seen.add(href);
            articleUrls.push(href);
        }
    });

    const urls = articleUrls.slice(0, 2);
    if (urls.length === 0) return null;

    const articles = await Promise.allSettled(
        urls.map(u => axios.get(u, { timeout: 10000, headers: HEADERS }))
    );

    const rankings = {};
    for (const art of articles) {
        if (art.status === 'fulfilled') parseAnnaArticle(art.value.data, rankings);
    }

    const d = rankings[signId];
    if (!d) return null;

    return {
        source: 'anna（アンナ）',
        url: 'https://anna-media.jp/archives/tag/horoscope',
        rank: d.rank, total: 12,
        luckyColor: d.luckyColor || null,
        luckyItem:  null,
    };
}

function parseAnnaArticle(html, out) {
    const $ = cheerio.load(html);
    // ラッキーカラーはJS描画のためaxiosでは取得不可 → 順位のみ抽出
    const text = $('body').text().replace(/\s+/g, ' ');

    for (const [signId, names] of Object.entries(SIGN_JA)) {
        if (out[signId]) continue;
        for (const name of names) {
            const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const m = text.match(new RegExp(`(?:★)?(?:第)?(\\d+)位[\\s　]{0,5}${esc}`));
            if (m) {
                const rank = parseInt(m[1]);
                if (rank >= 1 && rank <= 12) {
                    out[signId] = { rank };
                    break;
                }
            }
        }
    }
}

// ────────────────────────────────────────────
// AstroSage (英語)
// 形式: Lucky Number :- 7 / Lucky Color :- Cream and White
// URL: /horoscope/daily-{sign}-horoscope.asp
// ────────────────────────────────────────────
async function fetchAstroSage(signId) {
    const url = `https://www.astrosage.com/horoscope/daily-${signId}-horoscope.asp`;
    const res = await axios.get(url, {
        timeout: 10000,
        headers: { ...HEADERS, 'Accept-Language': 'en-US,en;q=0.9' },
    });

    const $ = cheerio.load(res.data);
    const text = $('body').text().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

    // 形式: "Lucky Number :- 7Lucky Color :- Cream and White Remedy :- ..."
    // lookahead で次のキーワードの手前まで取得
    const numM   = text.match(/Lucky Number\s*:-\s*([^\n\r]+?)(?=Lucky Color|Remedy|Today|$)/i);
    const colorM = text.match(/Lucky Color\s*:-\s*([^\n\r]+?)(?=Lucky Number|Remedy|Today|$)/i);

    if (!numM && !colorM) return null;

    return {
        source: 'AstroSage (EN)',
        url,
        rank: null, total: null,
        luckyColor:  colorM?.[1]?.trim() || null,
        luckyNumber: numM?.[1]?.trim()   || null,
        luckyItem:   null,
    };
}
