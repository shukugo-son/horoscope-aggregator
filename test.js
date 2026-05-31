/**
 * スクレイピング ローカルテスト
 * 使い方: node test.js [星座ID]
 * 例:     node test.js aries
 *         node test.js all   ← 全12星座を順にテスト
 *
 * Netlify 不要・無料枠を消費しない
 */

const { handler } = require('./netlify/functions/fetch-horoscope');

const ALL_SIGNS = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
];

async function testSign(sign) {
    process.stdout.write(`\n${'─'.repeat(44)}\n`);
    process.stdout.write(`テスト: ${sign}\n`);
    process.stdout.write(`${'─'.repeat(44)}\n`);

    const result = await handler({
        httpMethod: 'GET',
        queryStringParameters: { sign },
    });

    const data = JSON.parse(result.body);

    if (!data.results || data.results.length === 0) {
        console.log('❌ 結果なし（全ソースの取得失敗）');
        return;
    }

    console.log(`✅ ${data.signJa}  ${data.date}\n`);
    for (const r of data.results) {
        console.log(`  📌 ${r.source}`);
        console.log(`     順位           : ${r.rank}位 / ${r.total}`);
        console.log(`     ラッキーカラー  : ${r.luckyColor  ?? '—'}`);
        console.log(`     ラッキーアイテム: ${r.luckyItem   ?? '—'}`);
        console.log(`     ラッキーナンバー: ${r.luckyNumber ?? '—'}`);
        console.log(`     URL           : ${r.url}`);
        console.log();
    }
}

(async () => {
    const arg = process.argv[2] || 'aries';

    if (arg === 'all') {
        for (const sign of ALL_SIGNS) {
            await testSign(sign);
        }
    } else if (ALL_SIGNS.includes(arg)) {
        await testSign(arg);
    } else {
        console.error(`不明な星座: ${arg}`);
        console.error(`使用可能: ${ALL_SIGNS.join(', ')}, all`);
        process.exit(1);
    }
})();
