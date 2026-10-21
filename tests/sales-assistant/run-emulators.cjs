const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'output/sales-assistant');
fs.mkdirSync(output, { recursive: true });
const config = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
const emulatorConfig = path.join(output, 'firebase.emulators.json');
const rulesFile = path.join(output, 'firestore.emulator.rules');
fs.writeFileSync(rulesFile, require('./rules-source.cjs').rulesSource());
fs.writeFileSync(emulatorConfig, JSON.stringify({
    firestore: { rules: rulesFile },
    hosting: { ...config.hosting, public: path.relative(path.dirname(emulatorConfig), root).replaceAll('\\', '/') },
    emulators: { firestore: { host: '127.0.0.1', port: 8088 }, auth: { host: '127.0.0.1', port: 9098 }, hosting: { host: '127.0.0.1', port: 5088 }, ui: { enabled: false }, singleProjectMode: true }
}, null, 2));
const env = { ...process.env };
if (process.platform === 'win32') env.JAVA_TOOL_OPTIONS = (env.JAVA_TOOL_OPTIONS || '') + ' "-Djdk.net.unixdomain.tmpdir=' + path.join(os.tmpdir(), 'oako-sales-unavailable-sockets', 'unavailable') + '"';
const command = 'node tests/sales-assistant/integration-suite.cjs';
const result = spawnSync('firebase emulators:exec --project demo-sales-assistant --config "' + emulatorConfig + '" --only firestore,auth,hosting "' + command + '"', { cwd: root, shell: true, env, stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status === null ? 1 : result.status;
