const { spawnSync } = require('node:child_process');
for (const file of ['rules.integration.mjs', 'browser.cjs']) {
    const result = spawnSync(process.execPath, [require('node:path').join(__dirname, file)], { stdio: 'inherit', env: process.env });
    if (result.status !== 0) { process.exitCode = 1; break; }
}
