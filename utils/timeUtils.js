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
    const elapsed = getElapsedMinutes(order.createdAt, now);
    const estimate = getEstimatedMinutes(order);
    const ratio = elapsed / estimate;

    if (ratio >= 1) return { className: 'order-danger', label: 'Overdue', elapsed, estimate, ratio };
    if (ratio >= 0.5) return { className: 'order-warning', label: 'Watch', elapsed, estimate, ratio };
    return { className: 'order-safe', label: 'On time', elapsed, estimate, ratio };
}

export function formatElapsed(order = {}, now = new Date()) {
    const elapsed = getElapsedMinutes(order.createdAt, now);
    return `${elapsed} min elapsed`;
}

export function formatTimeRemaining(order = {}, now = new Date()) {
    const elapsed = getElapsedMinutes(order.createdAt, now);
    const estimate = getEstimatedMinutes(order);
    const remaining = estimate - elapsed;
    return remaining > 0 ? `${remaining} min left` : `${Math.abs(remaining)} min overdue`;
}
