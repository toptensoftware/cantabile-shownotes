import { Component, css, notify } from "@codeonlyjs/core";
import { CodeMirrorEditor } from "./CodeMirrorEditor.js";
import { parseAndRenderShowNotes } from "@toptensoftware/cantabile-shownotes-markdown";
import { C } from "./AppState.js";

export class ShowNotesEditor extends Component
{
    constructor()
    {
        super();
        this.listen(notify, "editMode", (event, mode) => {
            this.editMode = mode;
        })

        // Update to show new show notes
        this.listen(C.showNotes, 'markdownChanged', () => {
            this.source = C.showNotes.markdown;
        });

        // Update states
        this.listen(C.songStates, 'currentStateChanged', () => {
            window.setState?.(C.songStates.currentState?.name)
        });
        this.listen(C.songStates, 'changed', () => {
            window.setState?.(C.songStates.currentState?.name)
        });

    }

    #editMode = true;
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

        // Store new code
        this.#source = value;

        // Render
        this.render();

        // Save back to Cantabile (coalesc 3 second interval)
        clearTimeout(this.#saveTimeout);
        this.#saveTimeout = setTimeout(() => {
            C.showNotes.storeMarkdown(this.#source);
        }, 3000);
    }

    #saveTimeout;

    render()
    {
        var r = parseAndRenderShowNotes(this.#source);
        this.elOutput.innerHTML = r.html;

        const elScript = document.createElement('script')
        elScript.textContent = `(function () { 
${r.script}; 
window.setState = setState; 
})()`;
        this.elOutput.appendChild(elScript)

        window.setState?.(C.songStates.currentState?.name)
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
    }

    .input {
        flex: 1; /* takes 50% of space */
        overflow: auto;
    }
}
`
