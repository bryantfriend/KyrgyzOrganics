export const DEFAULT_ESTIMATED_MINUTES = 30;

export function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value === 'number') return new Date(value);
    return new Date(value);
}

export function getElapsedMinutes(createdAt, now = new Date()) {
    const created = toDate(createdAt);
    if (!created || Number.isNaN(created.getTime())) return 0;
    return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 60000));
}

export function getEstimatedMinutes(order = {}) {
    const value = Number(order.estimatedTime || order.estimatedMinutes || DEFAULT_ESTIMATED_MINUTES);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_ESTIMATED_MINUTES;
}

export function getUrgencyState(order = {}, now = new Date()) {
    const timing = getOrderTiming(order, now);
    const { elapsed, estimate, ratio } = timing;

    if (ratio > 1.2) return { ...timing, className: 'order-critical', level: 'critical', label: 'Critical' };
    if (ratio >= 0.9) return { ...timing, className: 'order-danger', level: 'danger', label: 'Late soon' };
    if (ratio >= 0.5) return { ...timing, className: 'order-warning', level: 'warning', label: 'Watch' };
    return { ...timing, className: 'order-safe', level: 'safe', label: 'On time' };
}

export function getOrderTiming(order = {}, now = new Date()) {
    const elapsed = getElapsedMinutes(order.createdAt, now);
    const estimate = getEstimatedMinutes(order);
    const remaining = estimate - elapsed;
    const ratio = estimate > 0 ? elapsed / estimate : 0;

    return {
        elapsed,
        estimate,
        remaining,
        lateBy: Math.max(0, Math.abs(remaining)),
        ratio
    };
}

export function formatElapsed(order = {}, now = new Date()) {
    const elapsed = getElapsedMinutes(order.createdAt, now);
    return `${elapsed} min elapsed`;
}

export function formatTimeRemaining(order = {}, now = new Date()) {
    const timing = getOrderTiming(order, now);
    return timing.remaining > 0 ? `${timing.remaining} min remaining` : `Late by ${timing.lateBy} min`;
}

export function formatTimerStatus(order = {}, now = new Date()) {
    const timing = getOrderTiming(order, now);
    return timing.remaining > 0 ? `${timing.remaining} min remaining` : `Late by ${timing.lateBy} min`;
}
