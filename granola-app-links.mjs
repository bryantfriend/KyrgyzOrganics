export const YANDEX_IOS_HANDOFF = 'https://8jxm.adj.st/external?adj_deeplink=yandextaxi%3A%2F%2Fexternal%3Fservice%3Deats&adjust_t=gm2aavy&service=eats';
export const GLOVO_IOS_HANDOFF = 'https://glovo.go.link/open?link_type=store&store_id=394642&adjust_t=s321jkn';
export const YANDEX_ANDROID_PACKAGE = 'ru.yandex.taxi';
export const GLOVO_ANDROID_PACKAGE = 'com.glovo';
export const YANDEX_RESULT_QUERY = 'Kyrgyz Organic гранола';

const GLOVO_PLAY_STORE = `https://play.google.com/store/apps/details?id=${GLOVO_ANDROID_PACKAGE}`;

function intentStringExtra(key, value) {
    return `S.${key}=${encodeURIComponent(value)}`;
}

export function isAndroidDevice(userAgent = '', platform = '') {
    return /android/i.test(`${userAgent} ${platform}`);
}

export function buildYandexWebSearch(query = YANDEX_RESULT_QUERY) {
    return `https://eda.yandex.kg/en-kg/search?hideSelector=true&query=${encodeURIComponent(query)}`;
}

export function buildYandexAndroidIntent(query = YANDEX_RESULT_QUERY) {
    const eatsHref = `search?hideSelector=true&query=${encodeURIComponent(query)}`;
    const webFallback = buildYandexWebSearch(query);
    return `intent://external?service=eats&href=${encodeURIComponent(eatsHref)}#Intent;scheme=yandextaxi;package=${YANDEX_ANDROID_PACKAGE};${intentStringExtra('browser_fallback_url', webFallback)};end`;
}

export function buildGlovoAndroidIntent() {
    return `intent://open?link_type=store&store_id=394642#Intent;scheme=glovo;package=${GLOVO_ANDROID_PACKAGE};${intentStringExtra('browser_fallback_url', GLOVO_PLAY_STORE)};end`;
}

export function getGranolaProviderHref(provider, options = {}) {
    const android = isAndroidDevice(options.userAgent, options.platform);
    if (provider === 'yandex') return android ? buildYandexAndroidIntent(options.query || YANDEX_RESULT_QUERY) : YANDEX_IOS_HANDOFF;
    if (provider === 'glovo') return android ? buildGlovoAndroidIntent() : GLOVO_IOS_HANDOFF;
    return '';
}
