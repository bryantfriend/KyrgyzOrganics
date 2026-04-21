export function getTrackingUrl(orderId, origin = window.location.origin) {
    const encodedId = encodeURIComponent(orderId || '');
    const appPrefix = window.location.pathname.includes('/KyrgyzOrganics/') ? '/KyrgyzOrganics' : '';
    return `${origin}${appPrefix}/track/?orderId=${encodedId}`;
}

export function getPrettyTrackingUrl(orderId, origin = window.location.origin) {
    const encodedId = encodeURIComponent(orderId || '');
    const appPrefix = window.location.pathname.includes('/KyrgyzOrganics/') ? '/KyrgyzOrganics' : '';
    return `${origin}${appPrefix}/track/${encodedId}`;
}

export function getTrackingQrUrl(orderId, options = {}) {
    const size = options.size || 150;
    const data = options.url || getTrackingUrl(orderId, options.origin || window.location.origin);
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}
