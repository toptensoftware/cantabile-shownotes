import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const config = {
    development: {
        modules: [
        ],
        replace: [
            { from: "./Main.js", to: "/Main.js", contentType: "text/html" },
            { from: "__PACKAGE_VERSION__", to: JSON.stringify(pkg.version), url: "/config.dev.js" }
        ],
        rules: [
            { redirect: "/index.html", to: "/" },
            { rewrite: "/config.js", to: "/config.dev.js" },
        ]
    }
};

export default config;