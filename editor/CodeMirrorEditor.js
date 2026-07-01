import { Component, css } from "@codeonlyjs/core";
import { basicSetup } from "codemirror";
import { EditorView, keymap, ViewPlugin, Decoration } from "@codemirror/view";
import { EditorState, Compartment, RangeSetBuilder } from "@codemirror/state";
import { indentMore, indentLess } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting, indentUnit } from "@codemirror/language";
import { tags, Tag } from "@lezer/highlight";

// ---------------------------------------------------------------------------
// Whitespace visualisation
// ---------------------------------------------------------------------------

const spaceDeco = Decoration.mark({ class: "cm-vis-space" });
const tabDeco   = Decoration.mark({ class: "cm-vis-tab" });

function buildWhitespaceDeco(view)
{
    const builder = new RangeSetBuilder();
    for (const { from, to } of view.visibleRanges)
    {
        const text = view.state.doc.sliceString(from, to);
        for (let i = 0; i < text.length; i++)
        {
            if (text[i] === " ")       builder.add(from + i, from + i + 1, spaceDeco);
            else if (text[i] === "\t") builder.add(from + i, from + i + 1, tabDeco);
        }
    }
    return builder.finish();
}

const showWhitespace = ViewPlugin.fromClass(
    class {
        constructor(view)  { this.decorations = buildWhitespaceDeco(view); }
        update(update)     {
            if (update.docChanged || update.viewportChanged)
                this.decorations = buildWhitespaceDeco(update.view);
        }
    },
    { decorations: v => v.decorations }
);

// ---------------------------------------------------------------------------
// Directive syntax extension  (!ident ...  and  !/ident)
// ---------------------------------------------------------------------------

const directiveTag = Tag.define();

const directiveExtension = {
    defineNodes: [{ name: "Directive", block: true, style: directiveTag }],
    parseBlock: [{
        name: "Directive",
        parse(cx, line) {
            if (line.next !== 33) return false; // must start with '!'
            const rest = line.text.slice(line.pos + 1);
            if (!/^\/?[A-Za-z_]\w*/.test(rest)) return false;
            cx.addElement(cx.elt("Directive", cx.lineStart + line.pos, cx.lineStart + line.text.length));
            cx.nextLine();
            return true;
        },
        endLeaf(cx, line) {
            if (line.next !== 33) return false;
            return /^\/?[A-Za-z_]\w*/.test(line.text.slice(line.pos + 1));
        }
    }]
};

// ---------------------------------------------------------------------------
// CodeMirror theme helpers
// ---------------------------------------------------------------------------

const darkHighlight = HighlightStyle.define([
    { tag: tags.heading1,                           color: "#569cd6", fontWeight: "bold" },
    { tag: tags.heading2,                           color: "#4ec9b0", fontWeight: "bold" },
    { tag: tags.heading3,                           color: "#9cdcfe", fontWeight: "bold" },
    { tag: [tags.heading4, tags.heading5, tags.heading6], color: "#9cdcfe" },
    { tag: tags.strong,                             fontWeight: "bold" },
    { tag: tags.emphasis,                           fontStyle: "italic" },
    { tag: tags.strikethrough,                      textDecoration: "line-through" },
    { tag: tags.link,                               color: "#ce9178" },
    { tag: tags.url,                                color: "#ce9178" },
    { tag: tags.monospace,                          color: "#b5cea8" },
    { tag: tags.quote,                              color: "#6a9955", fontStyle: "italic" },
    { tag: tags.meta,                               color: "#d4d4d4", opacity: "0.6" },
    { tag: tags.punctuation,                        opacity: "0.6" },
    { tag: directiveTag,                            color: "#c586c0" },
]);

const lightHighlight = HighlightStyle.define([
    { tag: tags.heading1,                           color: "#0000ff", fontWeight: "bold" },
    { tag: tags.heading2,                           color: "#267f99", fontWeight: "bold" },
    { tag: tags.heading3,                           color: "#001080", fontWeight: "bold" },
    { tag: [tags.heading4, tags.heading5, tags.heading6], color: "#001080" },
    { tag: tags.strong,                             fontWeight: "bold" },
    { tag: tags.emphasis,                           fontStyle: "italic" },
    { tag: tags.strikethrough,                      textDecoration: "line-through" },
    { tag: tags.link,                               color: "#a31515" },
    { tag: tags.url,                                color: "#a31515" },
    { tag: tags.monospace,                          color: "#098658" },
    { tag: tags.quote,                              color: "#008000", fontStyle: "italic" },
    { tag: tags.meta,                               opacity: "0.6" },
    { tag: tags.punctuation,                        opacity: "0.6" },
    { tag: directiveTag,                            color: "#af00db" },
]);

function makeThemeExtensions(isDark)
{
    const style    = getComputedStyle(document.documentElement);
    const bodyBg   = style.getPropertyValue("--body-back-color").trim();
    const bodyFg   = style.getPropertyValue("--body-fore-color").trim();
    const inputBg  = style.getPropertyValue("--input-back-color").trim();
    const gridline = style.getPropertyValue("--gridline-color").trim();
    const accent   = style.getPropertyValue("--accent-color").trim();

    return [
        EditorView.darkTheme.of(isDark),
        EditorView.theme({
            "&":                            { backgroundColor: inputBg, color: bodyFg, height: "100%" },
            "&.cm-focused":                 { outline: "none" },
            ".cm-scroller":                 { fontFamily: "monospace", fontSize: "0.85rem", lineHeight: "1.6" },
            ".cm-content":                  { caretColor: bodyFg },
            ".cm-cursor":                   { borderLeftColor: bodyFg },
            ".cm-selectionBackground, &.cm-focused .cm-selectionBackground":
                                            { backgroundColor: `${accent}40` },
            ".cm-gutters":                  { backgroundColor: bodyBg, color: `${bodyFg}80`,
                                              border: "none", borderRight: `1px solid ${gridline}` },
            ".cm-activeLineGutter":         { backgroundColor: `${bodyFg}12` },
            ".cm-activeLine":               { backgroundColor: `${bodyFg}08` },
            ".cm-matchingBracket":          { outline: `1px solid ${accent}80`, borderRadius: "2px" },

            ".cm-vis-space":  {
                backgroundImage: `radial-gradient(circle at center, ${bodyFg}50 1.2px, transparent 1.2px)`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center 60%",
                backgroundSize: "100% 100%",
            },
            ".cm-vis-tab":    { position: "relative" },
        }, { dark: isDark }),
        syntaxHighlighting(isDark ? darkHighlight : lightHighlight),
    ];
}

// ---------------------------------------------------------------------------
// Smart tab
// ---------------------------------------------------------------------------

function smartTab({ state, dispatch })
{
    if (!state.selection.main.empty)
        return indentMore({ state, dispatch });

    const { from } = state.selection.main;
    const col    = from - state.doc.lineAt(from).from;
    const spaces = " ".repeat(4 - (col % 4));
    dispatch(state.update(state.replaceSelection(spaces), {
        scrollIntoView: true,
        userEvent: "input",
    }));
    return true;
}

// ---------------------------------------------------------------------------
// CodeMirrorEditor component
// ---------------------------------------------------------------------------

export class CodeMirrorEditor extends Component
{
    #value              = "";
    #editorView         = null;
    #themeCompartment   = new Compartment();
    onchange            = null;

    get value() { return this.#value; }
    set value(v)
    {
        if (this.#value === (v ?? "")) return;
        this.#value = v ?? "";
        if (this.#editorView)
        {
            const state = this.#editorView.state;
            if (state.doc.toString() !== this.#value)
                this.#editorView.dispatch({
                    changes: { from: 0, to: state.doc.length, insert: this.#value },
                });
        }
    }

    elContainer = null;

    onMount()
    {
        if (window.stylish)
        {
            this.listen(window.stylish, "darkModeChanged", (e) => {
                this.#editorView?.dispatch({
                    effects: this.#themeCompartment.reconfigure(makeThemeExtensions(e.darkMode)),
                });
            });
        }

        this.#mountEditor(this.containerEl);
    }

    onUnmount()
    {
        this.#editorView?.destroy();
        this.#editorView = null;
    }

    #mountEditor(el)
    {
        const isDark = window.stylish?.darkMode ?? false;
        this.#editorView = new EditorView({
            state: EditorState.create({
                doc: this.#value,
                extensions: [
                    basicSetup,
                    indentUnit.of("    "),
                    keymap.of([{ key: "Tab", run: smartTab }, { key: "Shift-Tab", run: indentLess }]),
                    showWhitespace,
                    markdown({ extensions: [directiveExtension] }),
                    this.#themeCompartment.of(makeThemeExtensions(isDark)),
                    EditorView.updateListener.of(update => {
                        if (update.docChanged)
                        {
                            this.#value = update.state.doc.toString();
                            this.onchange?.(this.#value);
                        }
                    }),
                ],
            }),
            parent: el,
        });
    }

    static template = {
        type: "div .cm-host",
        bind: "containerEl",
    }
}

css`
.cm-host
{
    height: 100%;

    .cm-editor
    {
        height: 100%;
    }

    .cm-scroller
    {
        overflow: auto;
    }

    .cm-vis-tab::before
    {
        content: '→';
        position: absolute;
        left: 1px;
        opacity: 0.35;
        line-height: inherit;
        pointer-events: none;
    }
}
`
