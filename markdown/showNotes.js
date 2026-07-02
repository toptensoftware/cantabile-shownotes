import { Node, HtmlRenderer, XmlRenderer, Parser } from "commonmark";
import { parseSectionAttributes, cssToCamelCase, slashConcat } from "./utils.js";

export function parseShowNotes(value, opts)
{
    // Parse markdown to AST
    var markdownParser = new Parser();
    var ast = markdownParser.parse(value);

    // Process directives
    let walker = ast.walker();
    let ev;
    let scopes = [ { kind: "root" } ];
    let nextId = 0;
    while (ev = walker.next())
    {
        let top = scopes[0];

        if (ev.entering && ev.node.type == "image")
        {
            if (ev.node.destination.indexOf("://") < 0 && opts.localAssetPrefix)
            {
                ev.node.destination = slashConcat(opts.localAssetPrefix, ev.node.destination);
            }
        }

        if (ev.node.type == "directive")
        {
            // Remove comment nodes
            if (ev.node.directive.startsWith("!"))
            {
                ev.node.unlink();
                continue;
            }

            switch (ev.node.directive)
            {
                case "section":
                    let attrs = {};

                    // Construct a section block node
                    let sectionBlock = new Node("section", ev.node.sourcePos);
                    sectionBlock._isContainer = true;
                    sectionBlock.id = nextId++;
                    sectionBlock.attrs = parseSectionAttributes(ev.node.args);

                    // Resolve default visibility
                    let visAttrs = sectionBlock.attrs.filter(x => x.name == "visible")
                    if (visAttrs.length > 0)
                    {
                        // Default attribute?
                        if (!visAttrs.some(x => x.args == null || x.args.length == 0))
                        {
                            sectionBlock.attrs.unshift({ name: "visible", value: !!visAttrs[0].value });
                        }
                    }

                    // Put it on the stack
                    scopes.unshift({
                        kind: "section",
                        consumingNode: sectionBlock,
                    });

                    // Add to AST
                    if (top.consumingNode)
                        top.consumingNode.appendChild(sectionBlock);
                    else
                        ev.node.insertBefore(sectionBlock);
                    ev.node.unlink();
                    break;

                case "/section":
                    if (top.kind == 'section')
                    {
                        scopes.shift();
                        ev.node.unlink();
                    }
                    else
                    {
                        ev.node.directive = "error"; 
                        ev.node.args = `Unexpected '/section' directive`;
                    }
                    break;

                default:
                    if (scopes[0].consumingNode)
                        scopes[0].consumingNode.appendChild(ev.node);
                    break;
        
            }
        }
        else if (ev.node.isContainer)
        {
            // Track scope stack
            if (ev.entering)
            {
                scopes.unshift({ 
                    kind: ev.node.type,
                });
            }
            else
            {
                while (scopes[0].kind != ev.node.type)
                {
                    let error = new Node("directive", ev.node.sourcePos);
                    error.directive = "error";
                    error.args = `Unterminated ${scopes[0].kind}`;
                    ev.node.appendChild(error);
                    scopes.shift();
                }

                scopes.shift();

                // if we have a consuming node, move this node into it
                if (scopes[0].consumingNode)
                    scopes[0].consumingNode.appendChild(ev.node);
            }
        }
        else
        {
            if (scopes[0].consumingNode)
                scopes[0].consumingNode.appendChild(ev.node);
        }
    }

    // Process styles
    return ast;
}

function attributeToStyle(attr)
{
    switch (attr.name)
    {
        // Custom short-cuts
        case "fg":
            return { name: "color", value: attr.value };
        case "bg":
            return { name: "background-color", value: attr.value };
        case "visible":
            return { name: "display", value: (attr.value == "false" || attr.value === false) ? "none" : "block" };
        case "align":
            return { name: "text-align", value: attr.value };
        case "fixed":
            return { name: "font-family", value: "Courier New, monospace" };
        case "size":
            return { name: "font-size", value: attr.value + "px" };
        case "bold":
            return { name: "font-weight", value: (attr.value == "false" || attr.value === false) ? "400" : "700" }

        // Non-styles
        case "white-space":
        case "image":
            return null;

        default:
            return { name: attr.name, value: attr.value };
    }
}


export class ShowNotesHtmlRenderer extends HtmlRenderer
{
    constructor(opts)
    {
        super();
        this.options = opts;
    }

    #resetCode = [];
    #codeForStates = new Map();
    #initCode = [];
    #needAbc = false;
    #needChordSheet = false;

    get needsAbc() { return this.#needAbc; }
    get needsChordSheet() { return this.#needChordSheet; }

    renderScript()
    {
        let code = 
`// Get references to all section elements
const sections = [];
document.querySelectorAll('[id^="section-"]').forEach(el => {
    sections[parseInt(el.id.split('-')[1])] = el;
});

// Initialize
${this.#initCode.join("\n")}

// Switch to state
function setState(state)
{
    // Reset default styles
${this.#resetCode.map(line => "    " + line).join("\n")}

    // Apply state styles
    switch (state)
    {
`;

            for (let [state, codeLines] of this.#codeForStates.entries())
            {
                code += `        case "${state}":\n`;
                code += codeLines.map(line => "            " + line).join("\n");
                code += `\n            break;\n`; 
            }

code += 
`    }
}

// Array of known states for populating test popups etc...
const knownStates = [${[...this.#codeForStates.keys()].map(s => `"${s}"`).join(", ")}];
`;

        code += `\n`;
        return code;
    }

    section(node, entering)
    {
        if (entering)
        {
            // Resolve default styles
            let styles = "";
            let defaultStyles = new Map();
            let resetWritten = new Map();
            for (let attr of node.attrs)
            {
                // Default styles have no arguments
                if (!attr.args || attr.args.length == 0)
                {
                    // Convert to CSS style
                    let style = attributeToStyle(attr);
                    if (style)
                    {
                        // Add to HTML
                        styles += `${style.name}: ${style.value}; `;

                        // Store in case we need to reset it
                        defaultStyles.set(style.name,  style.value);
                    }
                }
            }

            // Now process per-state styles
            let codeForState = new Map();
            for (let attr of node.attrs)
            {
                // Per-state styles have arguments
                if (attr.args && attr.args.length > 0)
                {
                    // Convert to CSS style
                    let style = attributeToStyle(attr);
                    if (!style)
                        continue;

                    // Generate the code to reset this style for other states
                    if (!resetWritten.has(attr.name))
                    {
                        let defStyle = defaultStyles.get(style.name);
                        if (!defStyle)
                        {
                            // No default style, so reset by clearing the value
                            this.#resetCode.push(`sections[${node.id}].style.${cssToCamelCase(style.name)} = '';`);
                        }
                        else
                        {
                            // Reset to default style
                            this.#resetCode.push(`sections[${node.id}].style.${cssToCamelCase(style.name)} = '${defStyle}';`);
                        }

                        // Remember that we've written reset code for this style so we don't write it again for other states
                        resetWritten.set(attr.name, true);
                    }

                    // Generate code to apply this style for the specified states
                    for (let state of attr.args)
                    {
                        let code = this.#codeForStates.get(state);
                        if (!code)
                        {
                            code = [];
                            this.#codeForStates.set(state, code);
                        }

                        code.push(`sections[${node.id}].style.${cssToCamelCase(style.name)} = '${style.value ?? ''}';`);
                    }
                }
            }

            // Generate HTML for this section
            this.cr();
            this.lit(`\n<div class='section' id='section-${node.id}' style='${styles}'>`);

            // Layer text over background image
            let imageAttr = node.attrs.find(x => x.name == "image" && !x.args && x.value.trim() != "");
            if (imageAttr)
            {
                this.cr();
                this.lit(`<div style="display:grid">\n`);
                this.lit(`<div style="grid-area: 1 / 1">\n`);
                this.lit(`<img style="max-width: 100%" src="${imageAttr.value}" />\n`);
                this.lit(`</div>\n`);
                this.lit(`<div style="grid-area: 1 / 1">`);
            }

            // For fixed sections, the text is always left aligned and the section
            // alignment applies to the entire contained block.
            if (node.attrs.find(x => x.name == "fixed" && !x.args))
            {
                this.lit(`<div style="display: inline-block; text-align: left">`);
            }
        }
        else
        {
            // Close fixed wrapper div
            this.cr();
            if (node.attrs.find(x => x.name == "fixed" && !x.args))
            {
                this.lit(`</div>`);
            }

            // Close layered background/text wrapper div
            this.cr();
            let imageAttr = node.attrs.find(x => x.name == "image" && !x.args && x.value.trim() != "");
            if (imageAttr)
            {
                this.lit(`</div>\n`);
                this.lit(`</div>\n`);
            }
            this.lit("</div>");
        }
    }

    document(node, entering)
    {
        if (entering)
        {
            this.lit(`<div style="font-family: Segoe UI; text-align:center">\n`);
        }
        else
        {
            this.cr();
            this.lit(`</div>\n`);
        }
    }

    #nextCodeBlockId = 0;
    code_block(node)
    {
        let info_words = node.info ? node.info.split(/\s+/) : [];
        if (info_words[0] == "abc")
        {
            // Allocate id
            let id = `cb-${this.#nextCodeBlockId++}`;

            // Create a div
            this.lit(`<div id="${id}"></div>`);

            // Add a script to render the abc notation in this block
            this.#initCode.push(`ABCJS.renderAbc("${id}", ${JSON.stringify(node.literal)});`);

            this.#needAbc = true;
            return;
        }
        else if (info_words[0] == "chord")
        {
            // Allocate id
            let id = `cb-${this.#nextCodeBlockId++}`;

            // Create a div
            this.lit(`<div id="${id}"></div>`);

            // Add a script to render the abc notation in this block
            this.#initCode.push(`renderChordSheet("${id}", ChordSheetJS.ChordsOverWordsParser, ${JSON.stringify(node.literal)});`);
            this.#needChordSheet = true;
            return;
        }

        else if (info_words[0] == "chordpro")
        {
            // Allocate id
            let id = `cb-${this.#nextCodeBlockId++}`;

            // Create a div
            this.lit(`<div id="${id}"></div>`);

            // Add a script to render the abc notation in this block
            this.#initCode.push(`renderChordSheet("${id}", ChordSheetJS.ChordProParser, ${JSON.stringify(node.literal)});`);
            this.#needChordSheet = true;
            return;
        }

        else if (info_words[0] == "ultimate-guitar")
        {
            // Allocate id
            let id = `cb-${this.#nextCodeBlockId++}`;

            // Create a div
            this.lit(`<div id="${id}"></div>`);

            // Add a script to render the abc notation in this block
            this.#initCode.push(`renderChordSheet("${id}", ChordSheetJS.UltimateGuitarParser, ${JSON.stringify(node.literal)});`);
            this.#needChordSheet = true;
            return;
        }

        super.code_block(node);
    }

    attrs(node)
    {
        // Apply default attributes
        var attrs = super.attrs(node);

        // Paragraphs can have "pre" or "normal" whitespace depending
        // on parent section attributes.
        if (node.type == "paragraph")
        {
            attrs.push(["style", `white-space: ${resolveWhiteSpaceStyle(node)}`]);
        }

        // Done
        return attrs;
    }
}


export function renderShowNotes(ast, opts)
{
    let renderer = new ShowNotesHtmlRenderer(opts);
    let html = renderer.render(ast);

    return {
        html,
        script: renderer.renderScript(),
        needsAbc: renderer.needsAbc,
        needsChordSheet: renderer.needsChordSheet,
    }
}


export function parseAndRenderShowNotes(md, opts)
{
    const ast = parseShowNotes(md, opts);
    return renderShowNotes(ast, opts);
}

// Resolve the current whitespace style for a paragraph
// Look for "white-space" attribute on parent section nodes
// If none found, the default depends if the paragraph is inside
// a section or not.   By default sections have "pre" whitespace
// non-sections are "normal" whitespace.
export function resolveWhiteSpaceStyle(node)
{
    let result = "normal";
    while (node)
    {
        if (node.type == 'section')
        {
            for (let attr of node.attrs)
            {
                if (attr.name == "white-space" && !attr.args)
                {
                    return attr.value;
                }
            }
            result = "pre";
        }

        node = node.parent;
    }

    return result;
}



function initChordSheet()
{
    try
    {
        // Inject the chordsheet styles
        let chordSheetFormatter = new ChordSheetJS.HtmlDivFormatter();
        let css = chordSheetFormatter.cssString();
        css += `
.chord-sheet { display: inline-block }
.chord { text-align:left; font-family: monospace; font-size: 1.2em; font-weight: 700; margin-top: 1em; }
lyrics { text-align:left; }
`;
        let style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        // Helper to render a chord sheet
        if (window)
        {
            window.renderChordSheet = function renderChordSheet(id, type, src)
            {
                // Format HTML
                let song = (new type).parse(src);
                let html = chordSheetFormatter.format(song);
                document.getElementById(id).innerHTML = html;
            }
        }
    }
    catch (err)
    {
        console.log(`Chord sheet initialization failed - ${err.message}`)
    }
}

initChordSheet();