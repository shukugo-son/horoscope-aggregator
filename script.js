/**
 * 星座占いまとめサイト - フロントエンド
 */

const API = '/.netlify/functions/fetch-horoscope';

const ZODIAC_SIGNS = [
    { id: 'aries',       ja: '牡羊座', symbol: '♈', period: '3/21〜4/19' },
    { id: 'taurus',      ja: '牡牛座', symbol: '♉', period: '4/20〜5/20' },
    { id: 'gemini',      ja: '双子座', symbol: '♊', period: '5/21〜6/21' },
    { id: 'cancer',      ja: '蟹座',   symbol: '♋', period: '6/22〜7/22' },
    { id: 'leo',         ja: '獅子座', symbol: '♌', period: '7/23〜8/22' },
    { id: 'virgo',       ja: '乙女座', symbol: '♍', period: '8/23〜9/22' },
    { id: 'libra',       ja: '天秤座', symbol: '♎', period: '9/23〜10/23' },
    { id: 'scorpio',     ja: '蠍座',   symbol: '♏', period: '10/24〜11/22' },
    { id: 'sagittarius', ja: '射手座', symbol: '♐', period: '11/23〜12/21' },
    { id: 'capricorn',   ja: '山羊座', symbol: '♑', period: '12/22〜1/19' },
    { id: 'aquarius',    ja: '水瓶座', symbol: '♒', period: '1/20〜2/18' },
    { id: 'pisces',      ja: '魚座',   symbol: '♓', period: '2/19〜3/20' },
];

const signGrid       = document.getElementById('sign-grid');
const resultsSection = document.getElementById('results-section');
const selectedSymbol = document.getElementById('selected-symbol');
const selectedName   = document.getElementById('selected-name');
const selectedPeriod = document.getElementById('selected-period');
const statusMsg      = document.getElementById('status-msg');
const loadingEl      = document.getElementById('loading');
const resultsGrid    = document.getElementById('results-grid');
const todayDateEl    = document.getElementById('today-date');

// ────────────────────────────────────────────
// 初期化
// ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    showTodayDate();
    generateStars();
    renderSignGrid();
});

function showTodayDate() {
    const now  = new Date();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    todayDateEl.textContent =
        `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`;
}

// ────────────────────────────────────────────
// 星座グリッド
// ────────────────────────────────────────────
function renderSignGrid() {
    signGrid.innerHTML = '';
    ZODIAC_SIGNS.forEach(sign => {
        const btn = document.createElement('button');
        btn.className = 'sign-btn';
        btn.dataset.sign = sign.id;
        btn.setAttribute('aria-label', `${sign.ja} ${sign.period}`);
        btn.innerHTML = `
            <span class="sign-symbol">${sign.symbol}</span>
            <span class="sign-name">${sign.ja}</span>
            <span class="sign-period">${sign.period}</span>
        `;
        btn.addEventListener('click', () => selectSign(sign));
        signGrid.appendChild(btn);
    });
}

function selectSign(sign) {
    document.querySelectorAll('.sign-btn').forEach(b =>
        b.classList.toggle('active', b.dataset.sign === sign.id)
    );
    selectedSymbol.textContent = sign.symbol;
    selectedName.textContent   = sign.ja;
    selectedPeriod.textContent = sign.period;
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    fetchHoroscope(sign.id);
}

// ────────────────────────────────────────────
// データ取得
// ────────────────────────────────────────────
async function fetchHoroscope(signId) {
    setLoading(true);
    setStatus('', false);
    resultsGrid.innerHTML = '';

    try {
        const res = await fetch(`${API}?sign=${encodeURIComponent(signId)}`);
        if (res.status === 404) {
            setStatus('⚠ Netlify Functions が動いていません。ローカルでは「netlify dev」で起動するか、Netlify にデプロイして使用してください。', true);
            return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderResults(data);
    } catch (err) {
        console.error(err);
        setStatus('⚠ サーバーへの接続に失敗しました。「netlify dev」で起動するか、Netlify にデプロイして使用してください。', true);
    } finally {
        setLoading(false);
    }
}

// ────────────────────────────────────────────
// 結果表示
// ────────────────────────────────────────────
function renderResults(data) {
    if (!data.results || data.results.length === 0) {
        setStatus('現在、占いサイトからデータを取得できませんでした。時間をおいて再度お試しください。', true);
        return;
    }

    resultsGrid.innerHTML = '';
    data.results.forEach((r, i) => resultsGrid.appendChild(buildCard(r, i)));
}

function buildCard(r, index) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${index * 0.1}s`;

    const rankColor = rankToColor(r.rank);

    const luckyHtml = [
        r.luckyColor  ? `<div class="lucky-row"><span class="lucky-label">🎨 ラッキーカラー</span><span class="lucky-val">${escapeHtml(r.luckyColor)}</span></div>` : '',
        r.luckyItem   ? `<div class="lucky-row"><span class="lucky-label">✨ ラッキーアイテム</span><span class="lucky-val">${escapeHtml(r.luckyItem)}</span></div>` : '',
        r.luckyNumber ? `<div class="lucky-row"><span class="lucky-label">🔢 ラッキーナンバー</span><span class="lucky-val">${escapeHtml(String(r.luckyNumber))}</span></div>` : '',
    ].filter(Boolean).join('');

    card.innerHTML = `
        <div class="card-top">
            <span class="source-name">${escapeHtml(r.source)}</span>
            <a class="source-link" href="${escapeHtml(r.url)}" target="_blank" rel="noopener">サイトを見る →</a>
        </div>
        <div class="rank-wrap" style="--rank-color:${rankColor}">
            <span class="rank-num">${r.rank}</span><span class="rank-unit">位</span>
            <span class="rank-total">/ ${r.total}</span>
        </div>
        ${luckyHtml ? `<div class="lucky-block">${luckyHtml}</div>` : '<p class="no-lucky">ラッキー情報なし</p>'}
    `;
    return card;
}

// 順位に応じた色
function rankToColor(rank) {
    if (rank === 1)  return '#ffd700';
    if (rank === 2)  return '#c0c0c0';
    if (rank === 3)  return '#cd7f32';
    if (rank <= 6)   return '#7ec8e3';
    if (rank <= 9)   return '#a8d8a8';
    return '#888';
}

// ────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────
function setLoading(on) { loadingEl.hidden = !on; }

function setStatus(msg, show) {
    statusMsg.hidden = !show;
    statusMsg.textContent = msg;
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// ────────────────────────────────────────────
// 星空背景
// ────────────────────────────────────────────
function generateStars() {
    function make(n) {
        const a = [];
        for (let i = 0; i < n; i++) {
            const x = Math.floor(Math.random() * 2000);
            const y = Math.floor(Math.random() * 2000);
            const o = (0.3 + Math.random() * 0.7).toFixed(2);
            a.push(`${x}px ${y}px rgba(245,230,200,${o})`);
        }
        return a.join(',');
    }
    const s = document.createElement('style');
    s.textContent = `:root{--stars1:${make(700)};--stars2:${make(200)};--stars3:${make(100)};}`;
    document.head.appendChild(s);
}
