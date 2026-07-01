const config = {
    development: {
        modules: [
        ],
        replace: [
            { from: "./Main.js", to: "/Main.js", contentType: "text/html" },
        ],
        rules: [
            { redirect: "/index.html", to: "/" },
        ]
    }
};

export default config;