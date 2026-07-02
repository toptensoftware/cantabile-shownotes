import { Component, css } from "@codeonlyjs/core";

export class ConnectingPage extends Component
{
    constructor()
    {
        super();
    }

    static template = {
        type: "div",
        class: "center",
        $: [
            {
                type: "div class=spinner-bar",
                $: {
                    type: "span class='spinner large'"
                }
            },
            {
                type: "h1",
                class: "info",
                text: "Connecting...",
            },
        ]    
    }
}

css`
.spinner-bar
{
    margin-top: 150px;
}
`;
