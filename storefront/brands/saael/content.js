// Replaceable content defaults. Saved content.saael takes precedence, including empty collections.
export var originalLogo = new URL('./assets/original-logo.jpeg', import.meta.url).href;
var galleryArtwork = new URL('./assets/visual-worlds.webp', import.meta.url).href;
export var destinationIds = ['library', 'community', 'gallery', 'create', 'healing', 'serve', 'shop'];
export var defaultSaaelContent = {
    headline: 'Many paths. One universe.',
    exploreLabel: 'Explore', servicesLabel: 'Services', communityLabel: 'Community',
    exploreServicesLabel: 'Explore services', availabilityLabel: 'View availability',
    servicesTitle: 'Explore services', servicesIntroduction: 'Discover the offerings in the Healing Room.',
    searchLabel: 'Find a service', searchPlaceholder: 'Search services',
    textColor: '#302e29', accentColor: '#917337', backgroundColor: '#ffffff',
    headingFont: 'Georgia', bodyFont: 'Arial',
    strapline: 'HEAL • CREATE • LEARN • SERVE',
    welcome: 'A living space for your inner world.',
    invitation: 'Follow a colour. Find a connection. Begin wherever you are.',
    bookingLabel: 'Book a session',
    calendarTitle: 'Find a time for you', currency: '', timeZone: 'Asia/Bishkek', availability: [],
    bookingTitle: 'A little space for you',
    bookingText: 'Explore the Healing Room and discover what speaks to you.',
    bookingNotice: 'Choose a service and browse the calendar to see published availability.',
    footerText: 'An invitation to explore, at your own pace.',
    logoUrl: originalLogo, defaultView: 'map', motion: true,
    destinations: [
        { id: 'library', title: 'Library', subtitle: 'Words to wander through', introduction: 'A quiet corner for reading, reflection and new perspectives.', color: '#9860ba', enabled: true },
        { id: 'community', title: 'Community', subtitle: 'A place to belong', introduction: 'Discover shared conversations and connections. Community details will be added here.', color: '#64b7d5', enabled: true },
        { id: 'gallery', title: 'Art Gallery', subtitle: 'See a little differently', introduction: 'Explore visual worlds and the stories they hold.', color: '#50529a', enabled: true },
        { id: 'create', title: 'Create', subtitle: 'Make room for possibility', introduction: 'A space for creative exploration. Workshops and resources will be added here.', color: '#e48b46', enabled: true },
        { id: 'healing', title: 'Healing Room', subtitle: 'Return to yourself', introduction: 'Explore this space and learn about upcoming offerings. The actual service catalogue is awaiting confirmation.', color: '#dcb548', enabled: true },
        { id: 'serve', title: 'Serve', subtitle: 'Let kindness ripple', introduction: 'Discover ways to participate and contribute. Opportunities will be added here.', color: '#86a477', enabled: true },
        { id: 'shop', title: 'Shop', subtitle: 'Little things, with meaning', introduction: 'The collection is being prepared. Items and purchasing details will appear here when ready.', color: '#e6dbba', enabled: true }
    ],
    services: [{ id: 'sample-session', title: 'Session preview', description: 'An example of how a service will appear. Saikal can replace this with the confirmed offering.', details: 'Practice, duration, price, practitioner details and scheduling have not been supplied.', sample: true }],
    articles: [{ title: 'Begin wherever you are', summary: 'A sample reading for this quiet corner.', body: 'There is no single entrance into a universe. Sometimes we arrive through a colour, a question, or the wish to pause.\n\nThis is sample editorial content. Saikal can replace it with her own writing in the admin panel.' }],
    artworks: [{ title: 'A visual world', imageUrl: galleryArtwork, caption: 'Existing site artwork — preview collection.' }]
};
export function safeImageUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
        var url = new URL(value, originalLogo);
        return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch { return ''; }
}
export function resolveSaaelContent(saved) {
    var content = Object.assign({}, defaultSaaelContent, saved || {});
    content.logoUrl = safeImageUrl(content.logoUrl) || originalLogo;
    content.defaultView = content.defaultView === 'list' ? 'list' : 'map';
    content.destinations = defaultSaaelContent.destinations.map(function resolveDestination(base) {
        var override = saved && Array.isArray(saved.destinations) && saved.destinations.find(function match(item) { return item && item.id === base.id; });
        var destination = Object.assign({}, base, override || {});
        if (!/^#[0-9a-f]{6}$/i.test(destination.color)) destination.color = base.color;
        return destination;
    });
    ['services', 'articles', 'artworks'].forEach(function resolveCollection(key) {
        content[key] = Array.isArray(content[key]) ? content[key] : defaultSaaelContent[key];
    });
    content.availability = Array.isArray(content.availability) ? content.availability : [];
    content.services = content.services.map(function service(item) { return Object.assign({ price: null, durationMinutes: null }, item); });
    ['textColor', 'accentColor', 'backgroundColor'].forEach(function color(key) {
        if (!/^#[0-9a-f]{6}$/i.test(content[key])) content[key] = defaultSaaelContent[key];
    });
    if (!['Georgia', 'Times New Roman', 'Palatino Linotype'].includes(content.headingFont)) content.headingFont = 'Georgia';
    if (!['Arial', 'Verdana', 'Tahoma'].includes(content.bodyFont)) content.bodyFont = 'Arial';
    return content;
}
