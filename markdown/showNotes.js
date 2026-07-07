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
    let nextSectionId = 0;
    let documentAttributes = [];
    while (ev = walker.next())
    {
        let top = scopes[0];

        if (!ev.entering && ev.node.type == "document")
        {
            // Store the !document directive specified attributes on the document node
            ev.node.attrs = documentAttributes;
        }

        if (ev.entering && ev.node.type == "image")
        {
            // Qualify local assets
            ev.node.destination = qualifyLocalAsset(ev.node.destination);
        }

        if (ev.node.type == "directive")
        {
            if (ev.node.directive.startsWith("!"))
            {
                // !!Comment node, remove it
                ev.node.unlink();
                continue;
            }

            switch (ev.node.directive)
            {
                case "document":
                {
                    documentAttributes.push(...parseSectionAttributes(ev.node.args));
                    ev.node.unlink();
                    continue;
                }

                case "include":
                {
                    // Resolve url
                    let dest = qualifyLocalAsset(ev.node.args.trim());

                    // Check if its PDF file
                    let urlParts = dest.split("?");
                    let urlPath = urlParts[0];
                    let query = new URLSearchParams(urlParts[1]);
                    if (urlPath.endsWith(".pdf") && !query.get("page"))
                    {
                        let pdfNode = new Node("pdf");
                        pdfNode.destination = dest;
                        replaceNode(ev.node, pdfNode);
                    }
                    else
                    {
                        // Create an image tag
                        let imgNode = new Node("image", ev.node.sourcePos);
                        imgNode.destination = dest;

                        // Create a wrapping paragraph tag
                        let pNode = new Node("paragraph", ev.node.sourcePos);
                        pNode.appendChild(imgNode);

                        // Add to AST
                        replaceNode(ev.node, pNode);
                    }
                    continue;
                }

                case "section":
                {
                    let attrs = {};

                    // Construct a section block node
                    let sectionBlock = new Node("section", ev.node.sourcePos);
                    sectionBlock._isContainer = true;
                    sectionBlock.id = nextSectionId++;
                    sectionBlock.attrs = parseSectionAttributes(ev.node.args);

                    // Qualify local image assets
                    for (let a of sectionBlock.attrs)
                    {
                        if (a.name == "image")
                            a.value = qualifyLocalAsset(a.value);
                    }

                    // Resolve default visibility
                    let visAttrs = sectionBlock.attrs.filter(x => x.name == "visible")
                    if (visAttrs.length > 0)
                    {
                        // Default attribute?
                        if (!visAttrs.some(x => x.args == null || x.args.length == 0))
                        {
                            sectionBlock.attrs.unshift({ name: "visible", value: visAttrs[0].value === 'false'});
                        }
                    }

                    // Put it on the stack
                    scopes.unshift({
                        kind: "section",
                        consumingNode: sectionBlock,
                    });

                    // Add to AST
                    replaceNode(ev.node, sectionBlock);
                    break;
                }

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

                case "split":
                    if (ev.node.args.trim() == "")
                    {
                        if (top.kind == 'split')
                        {
                            let breakNode = new Node("columnBreak");
                            replaceNode(ev.node, breakNode);
                        }
                        else
                        {
                            ev.node.directive = "error"; 
                            ev.node.args = `Unexpected 'split' directive`;
                        }
                    }
                    else
                    {
                        // Create split block
                        let splitBlock = new Node("split", ev.node.sourcePos);
                        splitBlock._isContainer = true;

                        // Store split block definition
                        splitBlock.definition = ev.node.args
                            .split(" ")
                            .map(x => {
                                if (x.match(/^\d+$/))
                                    return `${x}fr`;
                                else
                                    return x;
                            })
                            .join(" ");

                        // Put it on the stack
                        scopes.unshift({
                            kind: "split",
                            consumingNode: splitBlock,
                        });

                        // Add to AST
                        replaceNode(ev.node, splitBlock);
                    }
                    break;

                case "/split":
                    if (top.kind == 'split')
                    {
                        scopes.shift();
                        ev.node.unlink();
                    }
                    else
                    {
                        ev.node.directive = "error"; 
                        ev.node.args = `Unexpected '/split' directive`;
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

        function replaceNode(oldNode, newNode)
        {
            if (top.consumingNode)
                top.consumingNode.appendChild(newNode);
            else
                oldNode.insertBefore(newNode);
            oldNode.unlink();
        }

    }

    // Process styles
    return ast;

    // If a local asset prefix is specified and the url doesn't
    // include protocol, then prepend the local asset prefix.
    function qualifyLocalAsset(url)
    {
        if (url.indexOf("://") < 0 && opts?.localAssetPrefix)
        {
            url = slashConcat(opts.localAssetPrefix, url);
        }
        return url;
    }

}

function mapColorPreset(color, kind)
{
    let m = color.match(/^color(\d+)$/);
    if (!m)
        return color;

    return `var(--${kind}-${color})`
}


function attributeToStyle(attr)
{
    switch (attr.name)
    {
        // Custom short-cuts
        case "fg":
            return { name: "color", value: mapColorPreset(attr.value, "fg") };
        case "bg":
            return { name: "background-color", value: mapColorPreset(attr.value, "bg") };
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
        super(opts);
    }

    #resetCode = [];
    #codeForStates = new Map();
    #initCode = [];
    #needAbc = false;
    #needChordSheet = false;
    #needMusicXML = false;

    get needsAbc() { return this.#needAbc; }
    get needsChordSheet() { return this.#needChordSheet; }
    get needsMusicXML() { return this.#needMusicXML; }

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

    document(node, entering)
    {
        if (entering)
        {
            let styles = new Map();
            styles.set("font-family", "Segoe UI");
            styles.set("text-align", "center");
            styles.set("width", "1000px")
            for (let a of node.attrs)
            {
                var s = attributeToStyle(a);
                if (s)
                {
                    styles.set(s.name, s.value);
                }
            }
            this.lit(`<div class="show-notes" style="${[...styles.entries().map(kv => `${kv[0]}: ${kv[1]}`)].join("; ")}">\n`);
        }
        else
        {
            this.cr();
            this.lit(`</div>\n`);
        }
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

    #nextId = 0;
    code_block(node)
    {
        let info_words = node.info ? node.info.split(/\s+/) : [];
        if (info_words[0] == "abc")
        {
            // Allocate id
            let id = `cb-${this.#nextId++}`;

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
            let id = `cb-${this.#nextId++}`;

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
            let id = `cb-${this.#nextId++}`;

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
            let id = `cb-${this.#nextId++}`;

            // Create a div
            this.lit(`<div id="${id}"></div>`);

            // Add a script to render the abc notation in this block
            this.#initCode.push(`renderChordSheet("${id}", ChordSheetJS.UltimateGuitarParser, ${JSON.stringify(node.literal)});`);
            this.#needChordSheet = true;
            return;
        }
        else if (info_words[0] == "musicxml")
        {
            // Allocate id
            let id = `cb-${this.#nextId++}`;

            // Create a div
            this.lit(`<div id="${id}"></div>`);

            // Add a script to render the abc notation in this block
            this.#initCode.push(`renderMusicXML("${id}", ${JSON.stringify(node.literal)});`);
            this.#needMusicXML = true;
            return;
        }

        super.code_block(node);
    }

    pdf(node)
    {
        // Allocate id
        let id = `cb-${this.#nextId++}`;
        this.lit(`<div class="pdf-container" id="${id}">\n`);
        this.lit(`</div>`)

        this.#initCode.push(`loadPdf("${id}", ${JSON.stringify(node.destination)});`)
    }

    split(node, entering)
    {
        if (entering)
        {
            this.lit(`<div style="display: grid; grid-template-columns: ${node.definition}">`);
            this.cr();
            this.lit(`<div>`);
            this.cr();
        }
        else
        {
            this.cr();
            this.lit("</div>");
            this.cr();
            this.lit("</div>");
        }
    }

    columnBreak(node)
    {
        this.cr();
        this.lit("</div>");
        this.cr();
        this.lit("<div>");
    }

    out(input)
    {    
        let i = 0;
        let len = input.length;
        while (i < len) 
        {
            let start = input.indexOf("$(", i);

            if (start === -1) 
            {
                // No more expressions — rest is plain text
                let text = input.slice(i);
                if (text.length)
                    super.out(text)
                break;
            }

            // Emit the plain text before the expression
            if (start > i) 
            {
                let text = input.slice(i, start);
                super.out(text);
            }

            // Find the matching closing paren, respecting nesting
            let depth = 1;
            let j = start + 2;
            while (j < len && depth > 0) {
                if (input[j] === "(") depth++;
                else if (input[j] === ")") depth--;
                j++;
            }

            if (depth !== 0) 
            {
                // Unbalanced — treat the rest as plain text and stop
                let text = input.slice(start);
                super.out(text);
                break;
            }

            let expr = input.slice(start + 2, j - 1); // inside the parens
            let id = this.#nextId++;
            super.lit(`<span id="cb-${id}">$(`);
            super.out(expr);
            super.lit(`)</span>`);

            this.#initCode.push(`let el${id} = document.getElementById("cb-${id}");`);
            this.#initCode.push(`window.watchExpression?.(${JSON.stringify(expr)}, (val) => el${id}.innerText = val);`);

            i = j;
        }
    }

    attrs(node)
    {
        // Apply default attributes
        var attrs = super.attrs(node);

        // Paragraphs can have "pre" or "normal" whitespace depending
        // on parent section attributes.
        if (node.type == "paragraph")
        {
            // If paragraph only contains an image, add the "image" class
            if (node.firstChild && node.firstChild == node.lastChild && node.firstChild.type == "image")
            {
                attrs.push(["class", "image"]);
            }
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
        needsMusicXML: renderer.needsMusicXML,
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

async function loadPdf(id, url)
{
    let el = document.getElementById(id);

    let delim = url.indexOf("?") < 0 ? "?" : "&"

    try
    {
        // Get PDF info
        let response = await fetch(url);
        if (!response.ok) 
            throw new Error(`Failed to fetch PDF info: ${response.status} ${response.statusText} for ${url}`);

        // Get JSON
        let pdfInfo = await response.json();
        for (let i=1; i<=pdfInfo.pageCount; i++)
        {
            let elP = document.createElement("p");
            elP.classList.add("image");

            let elImg = document.createElement("img");
            elImg.src = url + `${delim}page=${i}`;

            elP.appendChild(elImg);
            el.appendChild(elP);
        }
    }
    catch (err)
    {
        console.log(err.message);
    }
}

function init()
{
    try
    {
        // Show note styles
        let css = `
.show-notes
{
    margin: 0 auto;
    img
    {
        max-width: 100%;
    }

    .image
    {
        margin: 5px 0;
    }
    
    .section
    {
        padding: 10px;
    }

    p
    {
        margin: 0;
        padding: 0;
    }

    code
    {
        color: inherit;
    }
}
`;

        // ChordShee styles
        let chordSheetFormatter = new ChordSheetJS.HtmlDivFormatter();
        css += chordSheetFormatter.cssString();
        css += `
.chord-sheet 
{ 
    display: inline-block 
}
.chord 
{ 
    text-align:left; 
    font-family: monospace; 
    font-size: 1.2em; 
    font-weight: 700; 
    margin-top: 1em; 
}
.lyrics 
{ 
    text-align:left; 
}
`;
        let style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        // Attach helpers to window
        if (window)
        {
            window.renderChordSheet = function renderChordSheet(id, type, src)
            {
                // Format HTML
                let song = (new type).parse(src);
                let html = chordSheetFormatter.format(song);
                document.getElementById(id).innerHTML = html;
            }

            window.loadPdf = loadPdf;

            window.renderMusicXML = function renderMusicXML(id, src)
            {
                let osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(id);
                osmd.setOptions({
                    backend: "svg",
                    drawTitle: true,
                    // drawingParameters: "compacttight" // don't display title, composer etc., smaller margins
                });
                osmd
                    .load(src)
                    .then(() => osmd.render());
            }
        }
    }
    catch (err)
    {
        console.log(`Chord sheet initialization failed - ${err.message}`)
    }
}

init();