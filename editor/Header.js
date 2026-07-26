import { Component, css, html, notify } from "@codeonlyjs/core";
import { stylish } from "@codeonlyjs/stylish";
import { DocumentPicker } from "./DocumentPicker.js";
import { cantabile } from "./AppState.js";

// The main header
export class Header extends Component
{
    constructor()
    {
        super();
        this.listen(cantabile.song, "changed");
        this.listen(cantabile.songStates, "changed");
    }

    onEditToggle(e)
    {
        notify("editMode", e.target.checked);
    }

    get songAndStateName()
    {
        if (!cantabile.song.name)
            return"";
        let r = cantabile.song.name;
        if (cantabile.songStates.currentState)
            r += ` - ${cantabile.songStates.currentState.name}`
        return r;
    }

    static template = {
        type: "header #header",
        $: [
            {
                type: "div .title",
                $: [
                    { 
                        type: "img", 
                        src: "./public/logo.svg",
                    },
                    {
                        type: "span class=songName",
                        $: c => c.songAndStateName,
                    }
                ]
            },
            {
                type: "div .buttons",
                $: [
                    DocumentPicker,
                    {
                        type: "div class='control-group info'",
                        display: () => cantabile.state == "connected",
                        $: [
                            {
                                type: "input class=button type=checkbox #edit",
                                on_click: "onEditToggle"
                            },
                            {
                                type: "label for=edit",
                                $: "Edit"
                            },
                        ]
                    },
                    {
                        type: "input type=checkbox .theme-switch",
                        checked: () => stylish.darkMode ? "" : undefined,
                        on_click: () => stylish.toggleTheme(),
                    },
                ]
            }
        ]
    }
}

css`
:root
{
    --header-height: 50px;
}

#header
{
    position: fixed;
    top: 0;
    width: 100%;
    height: var(--header-height);

    display: flex;
    justify-content: start;
    align-items: center;
    border-bottom: 1px solid var(--gridline-color);
    padding-left: 10px;
    padding-right: 10px;
    background-color: rgb(from var(--back-color) r g b / 75%);
    z-index: 1;

    .title 
    {
        flex-grow: 1;
        display: flex;
        align-items: center;
        color: var(--body-fore-color);
        transition: opacity 0.2s;

        img
        {
            height: calc(var(--header-height) - 25px);
            padding-right: 10px
        }
    }


    .buttons
    {
        font-size: 12pt;
        display: flex;
        gap: 10px;
        align-items: center;

        .theme-switch
        {
            transform: translateY(-1.5px);
        }
    }
}
`