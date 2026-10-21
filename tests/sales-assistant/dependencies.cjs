const path = require('node:path');
const { createRequire } = require('node:module');
exports.dependency = function (name) {
    const override = name === 'playwright' ? process.env.SALES_PLAYWRIGHT_MODULES : process.env.SALES_TEST_MODULES;
    return (override ? createRequire(path.join(path.resolve(override), '__sales_test__.cjs')) : require)(name);
};
