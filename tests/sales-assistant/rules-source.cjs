const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

// Keep console-managed full rules out of the feature commit. Compose the
// reviewed fragment with the existing rules for isolated emulator testing.
function composeRules(base) {
    if (base.includes('function validSalesReview(')) return base;
    const anchor = '    // CUSTOMERS / CRM';
    if (!base.includes(anchor)) throw new Error('CRM rules insertion point was not found.');
    const fragment = fs.readFileSync(path.join(root, 'sales_assistant/security/firestore.fragment.txt'), 'utf8');
    // A function replacement preserves Firebase regex anchors and $(...) paths
    // literally; a replacement string would interpret sequences such as $'.
    return base.replace(anchor, function () { return fragment + '\n' + anchor; });
}
exports.composeRules = composeRules;
exports.rulesSource = function () {
    return composeRules(fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8'));
};
