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

// DOM refs
const signGrid      = document.getElementById('sign-grid');
const resultsSection = document.getElementById('results-section');
const selectedSymbol = document.getElementById('selected-symbol');
const selectedName   = document.getElementById('selected-name');
const selectedPeriod = document.getElementById('selected-period');
const statusMsg      = document.getElementById('status-msg');
const loadingEl      = document.getElementById('loading');
const resultsGrid    = document.getElementById('results-grid');
const todayDateEl    = document.getElementById('today-date');

let activeSign = null;

// ────────────────────────────────────────────
// 初期化
// ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    showTodayDate();
    generateStars();
    renderSignGrid();
});

function showTodayDate() {
    const now = new Date();
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
    if (activeSign === sign.id) return;
    activeSign = sign.id;

    // ボタンのアクティブ状態を更新
    document.querySelectorAll('.sign-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sign === sign.id);
    });

    // ヘッダー更新
    selectedSymbol.textContent = sign.symbol;
    selectedName.textContent   = sign.ja;
    selectedPeriod.textContent = sign.period;

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    fetchHoroscope(sign.id);
}

// ────────────────────────────────────────────
// API フェッチ
// ────────────────────────────────────────────
async function fetchHoroscope(signId) {
    setLoading(true);
    setStatus('', false);
    resultsGrid.innerHTML = '';

    try {
        const res = await fetch(`${API}?sign=${encodeURIComponent(signId)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        renderResults(data);
    } catch (err) {
        console.error('Fetch error:', err);
        setStatus('データの取得に失敗しました。しばらく経ってから再試行してください。', true);
    } finally {
        setLoading(false);
    }
}

// ────────────────────────────────────────────
// 結果レンダリング
// ────────────────────────────────────────────
function renderResults(data) {
    if (!data.results || data.results.length === 0) {
        setStatus('占い結果を取得できませんでした。', true);
        return;
    }

    const hasReal = data.results.some(r => r.isReal);
    if (!hasReal) {
        setStatus('現在、外部サイトからの取得ができないためサンプルデータを表示しています。', true);
    }

    resultsGrid.innerHTML = '';
    data.results.forEach((result, i) => {
        const card = buildCard(result, i);
        resultsGrid.appendChild(card);
    });
}

function buildCard(result, index) {
    const card = document.createElement('div');
    card.className = 'result-card';
    card.style.animationDelay = `${index * 0.08}s`;

    const badgeHtml = result.isReal
        ? '<span class="badge-real">公式サイト</span>'
        : '<span class="badge-demo">サンプル</span>';

    const subRatingsHtml = (result.love != null) ? `
        <div class="sub-ratings">
            <div class="sub-rating-item">
                <span class="sub-label">💕 恋愛</span>
                <span class="sub-stars">${renderStars(result.love)}</span>
            </div>
            <div class="sub-rating-item">
                <span class="sub-label">💼 仕事</span>
                <span class="sub-stars">${renderStars(result.work)}</span>
            </div>
            <div class="sub-rating-item">
                <span class="sub-label">💰 金運</span>
                <span class="sub-stars">${renderStars(result.money)}</span>
            </div>
            <div class="sub-rating-item">
                <span class="sub-label">🏃 健康</span>
                <span class="sub-stars">${renderStars(result.health)}</span>
            </div>
        </div>
    ` : '';

    const luckyHtml = [
        result.luckyColor  ? `🎨 ${escapeHtml(String(result.luckyColor))}` : '',
        result.luckyNumber != null ? `🔢 ${result.luckyNumber}` : '',
        result.luckyItem   ? `✨ ${escapeHtml(String(result.luckyItem))}` : '',
    ].filter(Boolean).map(s => `<span class="lucky-item">${s}</span>`).join('');

    const linkHtml = result.url
        ? `<a class="card-link" href="${escapeHtml(result.url)}" target="_blank" rel="noopener">→ 公式サイトで詳細を見る</a>`
        : '';

    card.innerHTML = `
        <div class="card-header">
            <span class="source-name">
                <span class="source-icon">${escapeHtml(result.icon)}</span>
                ${escapeHtml(result.source)}
            </span>
            ${badgeHtml}
        </div>
        <div class="overall-rating">
            <span class="stars-display">${renderStars(result.overall)}</span>
            <span class="overall-label">総合運 ${result.overall}/5</span>
        </div>
        <p class="fortune-text">${escapeHtml(result.text)}</p>
        ${subRatingsHtml}
        ${luckyHtml ? `<div class="lucky-info">${luckyHtml}</div>` : ''}
        ${linkHtml}
    `;

    return card;
}

// ────────────────────────────────────────────
// ユーティリティ
// ────────────────────────────────────────────
function renderStars(n) {
    const full  = Math.max(0, Math.min(5, Math.round(n)));
    const empty = 5 - full;
    return '★'.repeat(full) + '☆'.repeat(empty);
}

function setLoading(on) {
    loadingEl.hidden = !on;
}

function setStatus(msg, show) {
    statusMsg.hidden  = !show;
    statusMsg.textContent = msg;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ────────────────────────────────────────────
// 星空背景 CSS カスタムプロパティ生成
// ────────────────────────────────────────────
function generateStars() {
    function makeStars(count) {
        const arr = [];
        for (let i = 0; i < count; i++) {
            const x = Math.floor(Math.random() * 2000);
            const y = Math.floor(Math.random() * 2000);
            const op = (0.3 + Math.random() * 0.7).toFixed(2);
            arr.push(`${x}px ${y}px rgba(245,230,200,${op})`);
        }
        return arr.join(',');
    }

    const style = document.createElement('style');
    style.textContent = `
        :root {
            --stars1: ${makeStars(700)};
            --stars2: ${makeStars(200)};
            --stars3: ${makeStars(100)};
        }
    `;
    document.head.appendChild(style);
}
