import { Component, css, notify } from "@codeonlyjs/core";
import { CodeMirrorEditor } from "./CodeMirrorEditor.js";
import { parseAndRenderShowNotes, migrate } from "@toptensoftware/cantabile-shownotes-markdown";
import { cantabile, clearAllWatchers, getActiveDocument } from "./AppState.js";
import { config } from "./config.js";

export class ShowNotesEditor extends Component
{
    constructor()
    {
        super();

        // Toggle edit mode
        this.listen(notify, "editMode", (event, mode) => {
            this.editMode = mode;
        })

        // Load other document on document change
        this.listen(notify, "documentChanged", () => {
            this.loadShowNotes();
        });

        // Monitor for state changes and update show notes
        // based on state
        this.listen(cantabile.songStates, 'currentStateChanged', () => {
            window.setState?.(cantabile.songStates.currentState?.name)
        });

        // When showing migrated notes monitor for changes and
        // re-migrate when changed
        this.listen(cantabile.showNotes, 'changed', () => {
            if (this.#cleanMigrate)
                this.migrate();
        });
    }

    #cleanMigrate = false;

    onMount()
    {
        this.loadShowNotes();
    }

    #docWatch;

    async loadShowNotes()
    {
        // Get the current document tname
        let docName = getActiveDocument();

        // Stop watching old document
        if (this.#docWatch)
        {
            this.#docWatch.unwatch();
            this.#docWatch = null;
        }

        if (!docName)
        {
            this.#cleanMigrate = true;
            this.migrate();
        }
        else
        {
            this.#cleanMigrate = false;

            // Watch the document for changes
            this.#docWatch = cantabile.documents.watch(docName);
            this.#docWatch.on("changed", (content) => {
                this.source = content;
            });
            this.source = this.#docWatch.content;
        }
    }

    async migrate()
    {
        // No existing documents, migrate from v1
        this.#cleanMigrate = true;
        var v1raw = await cantabile.showNotes.getV1Raw();
        if (v1raw && this.#cleanMigrate)
        {
            this.source = migrate(v1raw);
        }
    }

    #editMode = false;
    get editMode()
    {
        return this.#editMode;
    }
    set editMode(value)
    {
        this.#editMode = value;
        this.invalidate();
    }

    #source = "";
    get source()
    {
        return this.#source;
    }
    set source(value)
    {
        if (!value)
            value = "";
        if (this.#source == value)
            return;
        this.#source = value;
        this.invalidate();
        this.render();
    }

    updateSource(value)
    {
        // Redundant?
        if (this.#source == value)
            return;

        this.#cleanMigrate = false;

        // Store new code
        this.#source = value;

        // Render
        this.render();

        // Save back to Cantabile (coalesc 3 second interval)
        clearTimeout(this.#saveTimeout);
        this.#saveTimeout = setTimeout(() => {

            if (this.#docWatch)
            {
                this.#docWatch.setContent(this.#source);
            }
            this.#saveTimeout = null;
        }, 1000);
    }

    #saveTimeout;

    render()
    {
        // Clear previous watches
        clearAllWatchers();

        var r = parseAndRenderShowNotes(this.#source, {
            localAssetPrefix: (config.cantabileHost ?? "") + "/assets/",
        });
        this.elOutput.innerHTML = r.html;

        const elScript = document.createElement('script')
        elScript.textContent = `(function () { 
${r.script}; 
window.setState = setState; 
})()`;
        this.elOutput.appendChild(elScript)

        window.setState?.(cantabile.songStates.currentState?.name)
    }

    static template = {
        type: "main",
        class: "shownotes-editor",
        $: [
            {
                type: "div .splitter",
                $: [
                    { 
                        type: "div .output",
                        bind: "elOutput",
                    },
                    { 
                        type: "div .input",
                        bind: "elInput",
                        display: c => c.editMode,
                        $: {
                            type: CodeMirrorEditor,
                            value: c => c.source,
                            onchange: c => (text) => { c.updateSource(text); },
                        }
                    },
                ]
            },
        ]
    }
}

css`
.shownotes-editor
{
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--header-height));
    padding: 0;
    box-sizing: border-box;
    gap: 10px;


    .splitter
    {
        flex: 1;
        overflow: hidden;
        border: 1px solid var(--gridline-color);
        border-radius: 4px;

        display: flex;
        height: 100%;
        gap: 0; /* no gap, or add spacing */
    }

    .output {
        flex: 1; /* takes 50% of space */
        overflow: auto;
        background-color: var(--back-color);
    }

    .input {
        flex: 1; /* takes 50% of space */
        overflow: auto;
    }
}
`
