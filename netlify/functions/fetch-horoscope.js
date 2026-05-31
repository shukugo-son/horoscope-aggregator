/**
 * Netlify Function - 複数占いサイトから星座運勢を取得
 * ソース: RSK山陽放送 / 週刊女性PRIME / LINE占い / うらなえる
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
    'Accept-Language': 'ja-JP,ja;q=0.9',
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

    const [rsk, jprime, line, unkoi] = await Promise.allSettled([
        fetchRSK(sign),
        fetchJprime(sign),
        fetchLine(sign),
        fetchUnkoi(sign),
    ]);

    const results = [rsk, jprime, line, unkoi]
        .filter(r => r.status === 'fulfilled' && r.value)
        .map(r => r.value);

    // 順位の高い順（1位が先頭）にソート
    results.sort((a, b) => a.rank - b.rank);

    return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ sign, signJa: SIGN_JA[sign][0], date: dateStr, results }),
    };
};

// ────────────────────────────────────────────
// RSK山陽放送
// 形式: 第X位 [星座名] ... 【ラッキーカラー】VALUE ... 【ラッキーアイテム】VALUE
// 1〜3位: /horoscope/  /  4〜12位: /horoscope/2nd.php
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
        rank: d.rank,
        total: 12,
        luckyColor: d.luckyColor || null,
        luckyItem:  d.luckyItem  || null,
    };
}

function parseRSKPage(html, out) {
    const $ = cheerio.load(html);
    const rawText = $('body').text();

    // 「第X位」でテキストをブロック分割して各ブロックをパース
    const blocks = rawText.split(/(?=第\d+位)/);

    for (const block of blocks) {
        const rankM = block.match(/^第(\d+)位/);
        if (!rankM) continue;
        const rank = parseInt(rankM[1]);

        // どの星座かを特定
        let foundSignId = null;
        for (const [signId, names] of Object.entries(SIGN_JA)) {
            if (out[signId]) continue;
            if (names.some(n => block.includes(n))) {
                foundSignId = signId;
                break;
            }
        }
        if (!foundSignId) continue;

        // ラッキーカラー・アイテムを抽出（実際の形式: 【ラッキーカラー】VALUE）
        const colorM = block.match(/【ラッキーカラー】([^\s【】\n]{1,20})/);
        const itemM  = block.match(/【ラッキーアイテム】([^\s【】\n]{1,30})/);

        out[foundSignId] = {
            rank,
            luckyColor: colorM?.[1]?.trim() || null,
            luckyItem:  itemM?.[1]?.trim()  || null,
        };
    }
}

// ────────────────────────────────────────────
// 週刊女性PRIME
// 形式: ページ上部に "8位" のみ（ラベルなし）、その直後に星座名
//       ラッキーアイテム：VALUE / ラッキーカラー：VALUE
// URL: /list/uranai/{signId}（英語星座名をそのまま使用）
// ────────────────────────────────────────────
async function fetchJprime(signId) {
    const url = `https://www.jprime.jp/list/uranai/${signId}`;
    const res = await axios.get(url, { timeout: 10000, headers: HEADERS });

    const $ = cheerio.load(res.data);
    const text = $('body').text().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

    // 「順位：8位」形式（別サイト流用時のフォールバック）
    let rankM = text.match(/順位[：:\s]+(\d{1,2})\s*位/);

    // ページ上部の「8位」（ラベルなし）を星座名の近傍で探す
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
        url,
        rank:       parseInt(rankM[1]),
        total:      12,
        luckyColor: colorM?.[1]?.trim() || null,
        luckyItem:  itemM?.[1]?.trim()  || null,
    };
}

// ────────────────────────────────────────────
// LINE占い
// メインページのリンク出現順 = 順位
// 個別ページ: ラッキーアイテム / ラッキーカラー
// URL パターン: /horoscope/{signId}/
// ────────────────────────────────────────────
async function fetchLine(signId) {
    const [mainRes, signRes] = await Promise.all([
        axios.get('https://fortune.line.me/horoscope/', { timeout: 10000, headers: HEADERS }),
        axios.get(`https://fortune.line.me/horoscope/${signId}/`, { timeout: 10000, headers: HEADERS }),
    ]);

    // メインページのリンク順で順位を決定
    const $main = cheerio.load(mainRes.data);
    const seen = new Set();
    const ordered = [];

    $main('a[href*="/horoscope/"]').each((_, el) => {
        const href = ($main(el).attr('href') || '').replace(/\/$/, '');
        const m = href.match(/\/horoscope\/([a-z]+)$/);
        // "horoscope" そのものや無効なIDを除外
        if (m && m[1] !== 'horoscope' && SIGN_JA[m[1]] && !seen.has(m[1])) {
            seen.add(m[1]);
            ordered.push(m[1]);
        }
    });

    const rank = ordered.indexOf(signId) + 1;
    if (rank === 0) return null;

    // 個別ページからラッキー情報を取得
    // LINE占いは区切り文字なし: 「ラッキーアイテム削りたての鉛筆ラッキーカラー藤色総合運...」
    const $sign = cheerio.load(signRes.data);
    const text = $sign('body').text().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

    const itemM  = text.match(/ラッキーアイテム(.+?)(?=ラッキーカラー|総合運|恋愛運)/);
    const colorM = text.match(/ラッキーカラー(.+?)(?=総合運|恋愛運|金運|仕事運)/);

    return {
        source: 'LINE占い',
        url: `https://fortune.line.me/horoscope/${signId}/`,
        rank,
        total: 12,
        luckyColor: colorM?.[1]?.trim() || null,
        luckyItem:  itemM?.[1]?.trim()  || null,
    };
}

// ────────────────────────────────────────────
// うらなえる
// ランキングページのリンク出現順 = 順位
// URL パターン: /fortune-luck/dailyranking/{signId}/
// ────────────────────────────────────────────
async function fetchUnkoi(signId) {
    const res = await axios.get('https://unkoi.com/fortune-luck/dailyranking', {
        timeout: 10000,
        headers: HEADERS,
    });

    const $ = cheerio.load(res.data);
    const seen    = new Set();
    const ordered = [];

    $('a[href*="/fortune-luck/dailyranking/"]').each((_, el) => {
        const href = ($(el).attr('href') || '').replace(/\/$/, '');
        const m = href.match(/\/fortune-luck\/dailyranking\/([a-z]+)$/);
        if (m && !seen.has(m[1])) {
            seen.add(m[1]);
            ordered.push(m[1]);
        }
    });

    const rank = ordered.indexOf(signId) + 1;
    if (rank === 0) return null;

    return {
        source: 'うらなえる',
        url: `https://unkoi.com/fortune-luck/dailyranking/${signId}/`,
        rank,
        total: 12,
        luckyColor: null,
        luckyItem:  null,
    };
}
