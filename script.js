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
const signGrid       = document.getElementById('sign-grid');
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
    activeSign = sign.id;

    document.querySelectorAll('.sign-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sign === sign.id);
    });

    selectedSymbol.textContent = sign.symbol;
    selectedName.textContent   = sign.ja;
    selectedPeriod.textContent = sign.period;

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    fetchHoroscope(sign.id);
}

// ────────────────────────────────────────────
// API フェッチ（失敗時はフロントエンドで生成）
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
        console.warn('API unavailable, using frontend fallback:', err.message);
        // API に到達できない場合はフロントエンドでデモデータを生成して表示
        const fallback = buildFrontendFallback(signId);
        renderResults(fallback);
    } finally {
        setLoading(false);
    }
}

// ────────────────────────────────────────────
// フロントエンド フォールバック（デモデータ生成）
// ────────────────────────────────────────────
function buildFrontendFallback(signId) {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const signJa = ZODIAC_SIGNS.find(s => s.id === signId)?.ja ?? signId;

    return {
        sign: signId,
        signJa,
        date: dateStr,
        isFrontendFallback: true,
        results: [
            makeDemoResult(signId, dateStr, 'ほしよみ占い', '🌟', 0),
            makeDemoResult(signId, dateStr, '星の扉占い',  '🔮', 1),
            makeDemoResult(signId, dateStr, '月光占い',    '🌙', 2),
        ],
    };
}

function makeDemoResult(signId, dateStr, sourceName, icon, variant) {
    const rng = seededRng(signId + dateStr + String(variant));

    const overall = (rng() % 5) + 1;
    const love    = (rng() % 5) + 1;
    const work    = (rng() % 5) + 1;
    const money   = (rng() % 5) + 1;
    const health  = (rng() % 5) + 1;

    const texts   = FORTUNE_TEXTS[signId] ?? FORTUNE_TEXTS.aries;
    const text    = texts[rng() % texts.length];
    const intros  = SOURCE_INTROS[variant % SOURCE_INTROS.length];
    const intro   = intros[rng() % intros.length];

    const COLORS  = ['赤', 'ブルー', '白', '金色', '深緑', '紫', 'ピンク', 'オレンジ', 'シルバー', 'ネイビー', '水色', 'ベージュ'];
    const NUMBERS = [1, 3, 5, 6, 7, 8, 11, 13, 17, 21, 33, 44];
    const ITEMS   = ['コーヒー', '花束', '手帳', 'アクセサリー', '読書', '音楽', 'キャンドル', '財布', 'スニーカー', '観葉植物', '香水', 'ノート'];

    return {
        source: sourceName,
        icon,
        url: null,
        overall,
        love,
        work,
        money,
        health,
        text: intro + text,
        luckyColor:  COLORS[rng() % COLORS.length],
        luckyNumber: NUMBERS[rng() % NUMBERS.length],
        luckyItem:   ITEMS[rng() % ITEMS.length],
        isReal: false,
    };
}

// XORshift シード付き乱数
function seededRng(seedStr) {
    let s = 0;
    for (let i = 0; i < seedStr.length; i++) {
        s = Math.imul(31, s) + seedStr.charCodeAt(i) | 0;
    }
    if (s === 0) s = 1;
    return function next() {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return Math.abs(s);
    };
}

// ────────────────────────────────────────────
// 結果レンダリング
// ────────────────────────────────────────────
function renderResults(data) {
    if (!data.results || data.results.length === 0) {
        setStatus('占い結果を取得できませんでした。', true);
        return;
    }

    if (data.isFrontendFallback) {
        setStatus('※ サーバーへの接続ができないため、サンプルデータを表示しています（Netlify にデプロイすると外部サイトからも取得します）。', true);
    } else if (!data.results.some(r => r.isReal)) {
        setStatus('※ 現在、外部占いサイトからの取得ができないためサンプルデータを表示しています。', true);
    }

    resultsGrid.innerHTML = '';
    data.results.forEach((result, i) => {
        resultsGrid.appendChild(buildCard(result, i));
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
    const full = Math.max(0, Math.min(5, Math.round(n)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function setLoading(on) { loadingEl.hidden = !on; }

function setStatus(msg, show) {
    statusMsg.hidden = !show;
    statusMsg.textContent = msg;
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ────────────────────────────────────────────
// 星空背景
// ────────────────────────────────────────────
function generateStars() {
    function makeStars(count) {
        const arr = [];
        for (let i = 0; i < count; i++) {
            const x  = Math.floor(Math.random() * 2000);
            const y  = Math.floor(Math.random() * 2000);
            const op = (0.3 + Math.random() * 0.7).toFixed(2);
            arr.push(`${x}px ${y}px rgba(245,230,200,${op})`);
        }
        return arr.join(',');
    }
    const style = document.createElement('style');
    style.textContent = `:root{--stars1:${makeStars(700)};--stars2:${makeStars(200)};--stars3:${makeStars(100)};}`;
    document.head.appendChild(style);
}

// ────────────────────────────────────────────
// デモデータ（バックエンドと共通）
// ────────────────────────────────────────────
const SOURCE_INTROS = [
    ['今日の星の流れはあなたに味方しています。', 'ポジティブなエネルギーが満ちています！', '宇宙からのメッセージに耳を傾けて。', '今日はあなたの個性が輝く日です。', '星たちがあなたを後押ししています。'],
    ['天空の星々は今日、深い示唆をもたらします。', '星の配置があなたの運命を照らし出しています。', '古来より伝わる星の智慧をお届けします。', '惑星の運行があなたの今日を導いています。', 'コズミックエネルギーの高まりを感じる一日です。'],
    ['月の光が柔らかくあなたを包む今日。', '夜空に輝く星があなたへ語りかけています。', '月のリズムに乗って、あなたの一日が始まります。', '満ちてゆく月のように、運気が上昇しています。', '月明かりの下、新たな可能性が広がっています。'],
];

const FORTUNE_TEXTS = {
    aries: [
        'あなたの情熱と行動力が周囲を巻き込み、新しいプロジェクトへの挑戦が実を結びます。思い切って最初の一歩を踏み出しましょう。勇気ある決断が未来への扉を開きます。',
        '積極的に動くことで嬉しいサプライズが待っているかもしれません。特に新しい出会いやチャンスには敏感に反応して。',
        '少しスローダウンして周囲を観察することも大切。行動の前に一歩引いて状況を把握することで、より良い選択ができるでしょう。',
        '忍耐力が試される日。熱い情熱を内側に向けて、自分自身を見つめ直す時間に使いましょう。内省が次の跳躍への準備になります。',
        '自分の直感を信じて進んでください。感じるままに行動することが、今日は最良の結果につながります。エネルギーを上手にコントロールして。',
    ],
    taurus: [
        'コツコツと積み上げてきた努力が今日、花開きます。周囲から頼られる存在として、その安定感が評価される一日になりそうです。',
        '美しいものに囲まれることで運気がアップします。自分へのご褒美に少し贅沢をしてみるのも良いでしょう。五感を大切にする日。',
        '変化を恐れずに受け入れることが大切です。普段の安定した姿勢も大切ですが、今日は少し柔軟に対応することで道が開けます。',
        '財運の日です。長期的な視点でお金と向き合うことで、堅実な未来が築かれます。衝動買いは慎んで。',
        '人間関係でのゆっくりとした歩みが信頼を生みます。急がず焦らず、自分のペースで前進することが今日の吉です。',
    ],
    gemini: [
        '情報収集力が冴え渡る一日。気になっていた分野の勉強や調査が、思わぬ発見をもたらします。好奇心のままに動いて。',
        '多彩なコミュニケーションがあなたの魅力を引き出します。SNSや会話の場で積極的に発信することで新しいつながりが生まれます。',
        '二つの選択肢で迷っているなら、今日は思い切って両方試みる価値があります。あなたの柔軟性が武器になります。',
        '少し落ち着いて一つのことに集中する日。散漫になりがちな注意を引き締めると、大きな成果が期待できます。',
        '仲間との会話から大切なヒントが生まれます。軽やかなコミュニケーションの中に、今日のラッキーが隠れています。',
    ],
    cancer: [
        '家族や大切な人への思いやりが、今日の運気を高めます。身近な人に連絡を取ることで、温かいエネルギーが生まれます。',
        '直感が冴えている日です。論理より感情を信じてみましょう。あなたの感受性が正しい方向へと導いてくれます。',
        '懐かしい場所や人との再会が、心の安らぎをもたらすかもしれません。思い出の力をエネルギーに変える日。',
        '自分の気持ちを素直に表現することが大切です。感情を内にしまい込まず、信頼できる人に打ち明けてみましょう。',
        '守りに入りがちな気持ちを、少し外に向けてみましょう。新しい環境に飛び込むことで、素敵な変化が起きます。',
    ],
    leo: [
        '今日はあなたが主役です。自信を持って自分の意見を発信することで、周囲をリードできます。存在感が輝く一日。',
        'クリエイティブなエネルギーが高まっています。芸術、表現、エンターテインメントに関することで才能が開花します。',
        '人の前に立つ機会が訪れそうです。緊張せず、自分らしさを全面に出しましょう。あなたの個性が最大の武器です。',
        '少し謙虚な姿勢が今日の吉です。チームの力を引き出すリーダーとして、他者の意見にも耳を傾けることが大切。',
        'ポジティブなエネルギーが伝染します。あなたの笑顔と熱意が周囲を元気にし、良い連鎖が生まれるでしょう。',
    ],
    virgo: [
        '細部への気配りが、今日は特に評価されます。丁寧な仕事ぶりや誠実な対応が、信頼関係を深めるでしょう。',
        '整理整頓や計画を立てることで運気が整います。デスク周りや思考の整理をする絶好の機会。',
        '健康管理に意識を向ける日。体の声に耳を傾け、適切な休息とバランスの取れた食事を心がけましょう。',
        '完璧主義が少し足を引っ張るかもしれません。「十分良い」という基準を設けることで、前に進みやすくなります。',
        '分析力と洞察力が冴える日。複雑な問題を解決するのに最適なタイミングです。論理的なアプローチで答えを見つけて。',
    ],
    libra: [
        '人間関係の調和が今日のテーマ。対立があれば中立の立場で橋渡しをすることで、あなたの評価が高まります。',
        '美しいものに触れる機会を大切に。アート、音楽、ファッションなど、感性を刺激することで運気が上がります。',
        '決断が迫られる場面では、直感と理性のバランスを取ることが大切。考えすぎず、しかし軽率にもならず。',
        'パートナーシップに恵まれる日。一人でできないことも、誰かと手を組むことで実現します。協力関係を大切に。',
        '内なるバランスを取り戻す日。忙しさの中でも自分の時間を確保することで、心が整い運気も安定します。',
    ],
    scorpio: [
        '深い洞察力が冴える一日。表面だけでなく物事の本質を見抜く力が、重要な場面で役立ちます。',
        '変容のエネルギーが高まっています。古いものを手放すことで、新しい自分へと生まれ変わる準備が整っています。',
        '秘密の情報や隠れたチャンスが舞い込むかもしれません。アンテナを高くして周囲に気を配りましょう。',
        '感情の波が激しくなりがちな日。内省の時間を取り、エネルギーを適切にコントロールすることが大切です。',
        '情熱を正しい方向に向けることで、大きな成果が生まれます。執念深さが今日は最大の強みになります。',
    ],
    sagittarius: [
        '冒険心に従って行動する日。慣れ親しんだ環境から一歩飛び出すことで、思いがけない発見があります。',
        '学びへの意欲が高まっています。新しい言語、哲学、文化に触れることで、視野が広がり運気もアップします。',
        '楽観的なエネルギーが周囲を明るくします。あなたの自由な発想と笑いが、場の雰囲気を和ませるでしょう。',
        '少し現実的な視点も必要な日。大きな夢を描きながら、足下をしっかり固めることも忘れずに。',
        '旅や移動に吉の兆し。遠出の計画を立てたり、オンラインで世界と繋がることで新しい出会いが生まれます。',
    ],
    capricorn: [
        '目標に向けた着実な努力が、今日は特に報われます。長期的なビジョンを持って、一歩一歩前進しましょう。',
        '責任感があなたの最大の武器です。困難な状況でも諦めない姿勢が、周囲からの信頼を集めます。',
        'キャリアや仕事面での吉報が届くかもしれません。上司や先輩とのコミュニケーションが良い結果をもたらします。',
        '少し肩の力を抜くことも大切。完璧を目指すあまり、疲弊しないよう適度な休息を取りましょう。',
        '実用的なスキルアップが今日のテーマ。資格取得や専門知識の深掘りが、将来の大きな財産になります。',
    ],
    aquarius: [
        '独自の発想が今日は大きな価値を生みます。常識にとらわれない視点で物事を見ることで、革新的な解決策が生まれます。',
        '人道的な活動やグループへの貢献が、運気を高めます。誰かのために動くことで、自分自身も豊かになれる日。',
        'テクノロジーや新しいツールの活用が吉。デジタル分野での挑戦が、思わぬ成果をもたらします。',
        '自分の個性を大切にしながら、周囲との協調も忘れずに。チームの中でのあなたの存在が輝きます。',
        '未来志向のあなたらしく、今日は中長期の計画を立てる絶好の機会。大きなビジョンを描いてみましょう。',
    ],
    pisces: [
        '豊かな想像力が今日は開花します。芸術的な表現や創造的な活動で、内なる才能が引き出されるでしょう。',
        '共感力が高まっており、誰かの気持ちに寄り添うことができます。思いやりのある言動が温かい縁を結びます。',
        '直感に従うことで、迷っていた問題がすっきり解決します。論理より心の声を信じることが今日の吉です。',
        '夢とリアリティのバランスを取る日。空想の世界から一歩出て、具体的なアクションを起こしましょう。',
        'スピリチュアルなエネルギーが高まっています。瞑想や自然の中での散歩が、心のデトックスになります。',
    ],
};
