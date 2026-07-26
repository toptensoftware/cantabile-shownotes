import { Component, css, notify } from "@codeonlyjs/core";
import { positionPopover } from "./positionPopover.js";
import { cantabile, getActiveDocument } from "./AppState.js";

export class DocumentPicker extends Component
{
    constructor()
    {
        super();

        // Update drop down list when document list changes
        this.listen(cantabile.documents, "changed");

        this.listen(notify, "documentChanged", () => {
            this.invalidate();
        });

    }

    get docDisplayName()
    {
        let doc = getActiveDocument();
        if (!doc)
            return "Classic Show Notes";
        else
            return doc;
    }


    static template = {
        type: "button .subtle .document-picker",
        popovertarget: "select-popover",
        $: [
            c => c.docDisplayName,
            {
                type: "nav .menu popover='' data-auto-close=1",
                id: "select-popover",
                bind: "popover",
                on_toggle: (c, ev) => positionPopover(ev),
                on_click: "onSelectCommand",
                $: [
                    {
                        type: "div",
                        foreach: () => cantabile.documents.documentList,
                        text: i => i,
                    }
                ]
            }
        ]
    };

}

css`
.document-picker
{
}
`;