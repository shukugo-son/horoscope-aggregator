/**
 * Netlify Function - 複数占いサイトから星座運勢を取得
 */

const axios = require('axios');
const cheerio = require('cheerio');

const SIGN_MAP = {
    aries:       { ja: '牡羊座', traits: '情熱的で行動力にあふれる' },
    taurus:      { ja: '牡牛座', traits: '忍耐強く美を愛する' },
    gemini:      { ja: '双子座', traits: '好奇心旺盛でコミュニカティブな' },
    cancer:      { ja: '蟹座',   traits: '感受性豊かで家族思いな' },
    leo:         { ja: '獅子座', traits: 'リーダーシップあふれる自信家の' },
    virgo:       { ja: '乙女座', traits: '分析力が高く誠実な' },
    libra:       { ja: '天秤座', traits: 'バランス感覚と調和を大切にする' },
    scorpio:     { ja: '蠍座',   traits: '洞察力が深く情熱的な' },
    sagittarius: { ja: '射手座', traits: '自由を愛する冒険心旺盛な' },
    capricorn:   { ja: '山羊座', traits: '責任感が強く目標に向かって努力する' },
    aquarius:    { ja: '水瓶座', traits: '独自の視点を持つ革新的な' },
    pisces:      { ja: '魚座',   traits: '豊かな想像力と共感力を持つ' },
};

// ────────────────────────────────────────────
// メインハンドラー
// ────────────────────────────────────────────
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const sign = event.queryStringParameters?.sign;
    if (!sign || !SIGN_MAP[sign]) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: '無効な星座です' }) };
    }

    // 日本時間で今日の日付を取得
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // 複数ソースを並列取得
    const [yahooResult, gooResult] = await Promise.allSettled([
        fetchYahooHoroscope(sign),
        fetchGooHoroscope(sign),
    ]);

    const results = [];

    if (yahooResult.status === 'fulfilled' && yahooResult.value) {
        results.push(yahooResult.value);
    }
    if (gooResult.status === 'fulfilled' && gooResult.value) {
        results.push(gooResult.value);
    }

    // デモソース（常に表示）
    results.push(generateDemoFortune(sign, dateStr, 'ほしよみ占い', '🌟', 0));
    results.push(generateDemoFortune(sign, dateStr, '星の扉占い',  '🔮', 1));
    results.push(generateDemoFortune(sign, dateStr, '月光占い',    '🌙', 2));

    return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
            sign,
            signJa: SIGN_MAP[sign].ja,
            date: dateStr,
            results,
        }),
    };
};

// ────────────────────────────────────────────
// Yahoo!占い スクレイパー
// ────────────────────────────────────────────
async function fetchYahooHoroscope(sign) {
    const url = `https://fortune.yahoo.co.jp/horoscope/daily/${sign}/`;
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja-JP,ja;q=0.9',
            },
        });

        const $ = cheerio.load(res.data);

        // 運勢テキストを複数セレクターで試みる
        const textSelectors = [
            '.forecastText', '[class*="forecastText"]',
            '.fortune-text', '[class*="fortuneText"]',
            'article p', '.horoscope p',
            '[class*="description"] p', '[class*="content"] p',
            'main p',
        ];
        let fortuneText = '';
        for (const sel of textSelectors) {
            const el = $(sel).first();
            const txt = el.text().trim();
            if (txt.length > 30) { fortuneText = txt; break; }
        }
        if (!fortuneText) return null;

        // 総合評価を星の数や数字から取得
        let overall = 3;
        const rankText = $('[class*="rank"], [class*="total"], [class*="score"]').first().text().trim();
        if (rankText) {
            const n = parseInt(rankText.replace(/[^0-9]/g, ''), 10);
            if (n >= 1 && n <= 5) overall = n;
        }

        const luckyColor  = $('[class*="color"], [class*="lucky"]').first().text().trim().replace(/[^぀-ヿa-zA-Z]/g, '').slice(0, 10) || null;
        const luckyNumber = $('[class*="number"]').first().text().trim().replace(/[^0-9]/g, '').slice(0, 3) || null;

        return {
            source: 'Yahoo!占い',
            icon: '🔶',
            url,
            overall,
            text: fortuneText.slice(0, 300),
            luckyColor: luckyColor || null,
            luckyNumber: luckyNumber ? parseInt(luckyNumber, 10) : null,
            luckyItem: null,
            love: null, work: null, money: null, health: null,
            isReal: true,
        };
    } catch (err) {
        console.error('Yahoo fetch error:', err.message);
        return null;
    }
}

// ────────────────────────────────────────────
// goo占い スクレイパー
// ────────────────────────────────────────────
async function fetchGooHoroscope(sign) {
    // goo占いは星座番号（1〜12）でアクセス
    const signOrder = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
    const num = signOrder.indexOf(sign) + 1;
    const url = `https://fortune.goo.ne.jp/horoscope/today/${num}/`;

    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ja-JP,ja;q=0.9',
            },
        });

        const $ = cheerio.load(res.data);

        const textSelectors = [
            '.horoscope-detail', '.fortune-detail',
            '[class*="detail"] p', '[class*="content"] p',
            'article p', 'main p',
        ];
        let fortuneText = '';
        for (const sel of textSelectors) {
            const el = $(sel).first();
            const txt = el.text().trim();
            if (txt.length > 30) { fortuneText = txt; break; }
        }
        if (!fortuneText) return null;

        return {
            source: 'goo占い',
            icon: '🔷',
            url,
            overall: 3,
            text: fortuneText.slice(0, 300),
            luckyColor: null, luckyNumber: null, luckyItem: null,
            love: null, work: null, money: null, health: null,
            isReal: true,
        };
    } catch (err) {
        console.error('goo fetch error:', err.message);
        return null;
    }
}

// ────────────────────────────────────────────
// デモ運勢生成（シード付き乱数で日替わり）
// ────────────────────────────────────────────
function generateDemoFortune(sign, dateStr, sourceName, icon, variant) {
    const rng = seededRng(sign + dateStr + String(variant));

    const overall = (rng() % 5) + 1;
    const love    = (rng() % 5) + 1;
    const work    = (rng() % 5) + 1;
    const money   = (rng() % 5) + 1;
    const health  = (rng() % 5) + 1;

    const traits = SIGN_MAP[sign].traits;
    const texts = FORTUNE_TEXTS[sign];
    const text = texts[rng() % texts.length];

    const COLORS  = ['赤', 'ブルー', '白', '金色', '深緑', '紫', 'ピンク', 'オレンジ', 'シルバー', 'ネイビー', '水色', 'ベージュ'];
    const NUMBERS = [1, 3, 5, 6, 7, 8, 11, 13, 17, 21, 33, 44];
    const ITEMS   = ['コーヒー', '花束', '手帳', 'アクセサリー', '読書', '音楽', 'キャンドル', '財布', 'スニーカー', '観葉植物', '香水', 'ノート'];

    const intros = SOURCE_INTROS[variant % SOURCE_INTROS.length];
    const intro  = intros[rng() % intros.length];

    return {
        source: sourceName,
        icon,
        url: null,
        overall,
        love,
        work,
        money,
        health,
        text: `${intro}${text}`,
        luckyColor:  COLORS[rng() % COLORS.length],
        luckyNumber: NUMBERS[rng() % NUMBERS.length],
        luckyItem:   ITEMS[rng() % ITEMS.length],
        isReal: false,
    };
}

// ────────────────────────────────────────────
// シード付き乱数（XORshift）
// ────────────────────────────────────────────
function seededRng(seedStr) {
    let state = 0;
    for (let i = 0; i < seedStr.length; i++) {
        state = Math.imul(31, state) + seedStr.charCodeAt(i) | 0;
    }
    if (state === 0) state = 1;

    return function next() {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        return Math.abs(state);
    };
}

// ────────────────────────────────────────────
// ソースごとの前置き文
// ────────────────────────────────────────────
const SOURCE_INTROS = [
    // ほしよみ占い（明るいトーン）
    [
        '今日の星の流れはあなたに味方しています。',
        'ポジティブなエネルギーが満ちています！',
        '宇宙からのメッセージに耳を傾けて。',
        '今日はあなたの個性が輝く日です。',
        '星たちがあなたを後押ししています。',
    ],
    // 星の扉占い（神秘的なトーン）
    [
        '天空の星々は今日、深い示唆をもたらします。',
        '星の配置があなたの運命を照らし出しています。',
        '古来より伝わる星の智慧をお届けします。',
        '惑星の運行があなたの今日を導いています。',
        'コズミックエネルギーの高まりを感じる一日です。',
    ],
    // 月光占い（詩的なトーン）
    [
        '月の光が柔らかくあなたを包む今日。',
        '夜空に輝く星があなたへ語りかけています。',
        '月のリズムに乗って、あなたの一日が始まります。',
        '満ちてゆく月のように、運気が上昇しています。',
        '月明かりの下、新たな可能性が広がっています。',
    ],
];

// ────────────────────────────────────────────
// 星座別 運勢テキスト
// ────────────────────────────────────────────
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
