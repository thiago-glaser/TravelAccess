// babel.config.cjs  — used by Jest only (not Next.js build)
module.exports = {
    presets: [
        ['@babel/preset-env', {
            targets: { node: 'current' },
            modules: 'commonjs',   // Jest needs CJS even for ESM source
        }],
    ],
};
