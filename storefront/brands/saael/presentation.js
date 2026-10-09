import { resolveSaaelContent } from './content.js';
import { mountUniverse } from './universe.js';

export function applySaaelPresentation(store) {
    if (!store || store.companyId !== 'saael-s') return store;
    if (!document.getElementById('saael-presentation-styles')) {
        var stylesheet = document.createElement('link');
        stylesheet.id = 'saael-presentation-styles';
        stylesheet.rel = 'stylesheet';
        stylesheet.href = new URL('./presentation.css', import.meta.url).href;
        document.head.appendChild(stylesheet);
    }
    document.body.classList.add('saael-universe');
    return store;
}
export function renderSaaelDetails(store) {
    if (!store || store.companyId !== 'saael-s') return;
    mountUniverse(document.body, resolveSaaelContent(store.content && store.content.saael));
}
