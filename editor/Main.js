import { Component, css } from "@codeonlyjs/core";
import { Header } from "./Header.js";
import { ShowNotesEditor } from "./ShowNotesEditor.js"
import { ConnectingPage } from "./ConnectingPage.js"
import { cantabile } from "./AppState.js";

// Main application
class Main extends Component
{
    constructor()
    {
        super();
        this.page = new ConnectingPage();;

        cantabile.on('stateChanged', () => {

            // Hide/show connecting page
            if ((cantabile.state != 'connected') != (this.page instanceof ConnectingPage))
            {
                this.page = cantabile.state == 'connected' ? new ShowNotesEditor() : new ConnectingPage();
            }

        });
    }

    #page;
    get page() { return this.#page; }
    set page(value)
    {
        this.#page = value;
        this.invalidate();
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