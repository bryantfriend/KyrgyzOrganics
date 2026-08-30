import assert from 'node:assert/strict';
import {
    buildGlovoAndroidIntent,
    buildYandexAndroidIntent,
    buildYandexWebSearch,
    getGranolaProviderHref,
    GLOVO_ANDROID_PACKAGE,
    GLOVO_IOS_HANDOFF,
    isAndroidDevice,
    YANDEX_ANDROID_PACKAGE,
    YANDEX_IOS_HANDOFF,
    YANDEX_RESULT_QUERY
} from '../granola-app-links.mjs';

const androidUserAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36';
const iphoneUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';

assert.equal(isAndroidDevice(androidUserAgent), true);
assert.equal(isAndroidDevice('', 'Android'), true);
assert.equal(isAndroidDevice(iphoneUserAgent), false);

const yandexWeb = buildYandexWebSearch();
assert.equal(new URL(yandexWeb).searchParams.get('query'), YANDEX_RESULT_QUERY);

const yandexAndroid = buildYandexAndroidIntent();
assert.ok(yandexAndroid.startsWith('intent://external?service=eats&href='));
assert.ok(yandexAndroid.includes(`package=${YANDEX_ANDROID_PACKAGE}`));
assert.ok(yandexAndroid.includes(encodeURIComponent(yandexWeb)));
assert.ok(yandexAndroid.includes(encodeURIComponent('search?hideSelector=true&query=')));

const glovoAndroid = buildGlovoAndroidIntent();
assert.ok(glovoAndroid.startsWith('intent://open?link_type=store&store_id=394642'));
assert.ok(glovoAndroid.includes('scheme=glovo'));
assert.ok(glovoAndroid.includes(`package=${GLOVO_ANDROID_PACKAGE}`));
assert.ok(glovoAndroid.includes(encodeURIComponent(`https://play.google.com/store/apps/details?id=${GLOVO_ANDROID_PACKAGE}`)));

assert.equal(getGranolaProviderHref('yandex', { userAgent: androidUserAgent }), yandexAndroid);
assert.equal(getGranolaProviderHref('glovo', { userAgent: androidUserAgent }), glovoAndroid);
assert.equal(getGranolaProviderHref('yandex', { userAgent: iphoneUserAgent }), YANDEX_IOS_HANDOFF);
assert.equal(getGranolaProviderHref('glovo', { userAgent: iphoneUserAgent }), GLOVO_IOS_HANDOFF);

console.log('granola app link tests passed');
