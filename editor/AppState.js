import { Cantabile } from "@toptensoftware/cantabile-js";
import { config } from "./config.js"
import { notify } from "@codeonlyjs/core";

export let cantabile = new Cantabile(config.cantabileHost);



cantabile.on('stateChanged', async () => {
    if (cantabile.state == 'connected')
    {
        // Wait until application object connected
        await cantabile.application.waitForConnected();

        // Apply colors
        let colors = cantabile.application.colors;
        let docStyles = document.documentElement.style;
        for (let i=0; i<colors.length; i++)
        {
            docStyles.setProperty(`--bg-color${i}`, colors[i].back);
            docStyles.setProperty(`--fg-color${i}`, colors[i].fore);
        }
    }
})


let watchers = [];
window.watchExpression = function(expr, callback)
{
    watchers.push(cantabile.variables.watch(`$(${expr})`, callback));
}

export function clearAllWatchers()
{
    watchers.forEach(x => x.unwatch());
    watchers = [];
}

export function getActiveDocument()
{
    return window.location.hash.slice(1);
}

export function setActiveDocument(name)
{
    window.location.hash = name;
}

window.addEventListener("hashchange", () => {
    notify("documentChanged");
});

