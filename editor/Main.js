import { Component, css } from "@codeonlyjs/core";
import { Header } from "./Header.js";
import { ShowNotesEditor } from "./ShowNotesEditor.js"

import "./ShowNotesEditor.js";

// Main application
class Main extends Component
{
    constructor()
    {
        super();
        this.page = new ShowNotesEditor();;
    }

    static template = {
        type: "div",
        $: [
            Header,
            {
                type: "div #layoutRoot",
                $: {
                    type: "embed-slot",
                    content: c => c.page,
                }
            }
        ]
    }
}

css`
#layoutRoot
{
    padding-top: var(--header-height);
}

`;

// Main entry point, create Application and mount
export function main()
{
    new Main().mount("body");
}