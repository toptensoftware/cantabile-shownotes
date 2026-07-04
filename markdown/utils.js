
export function parseSectionAttributes(input) 
{
    const attrs = [];
    let i = 0;

    function skipWhitespace() {
        while (i < input.length && /\s/.test(input[i])) i++;
    }

    function parseName() {
        const start = i;
        while (i < input.length && /[a-zA-Z0-9_-]/.test(input[i])) i++;
        return input.slice(start, i);
    }

    function parseValue() {
        if (input[i] === '"') {
            i++;
            let str = '';
            while (i < input.length && input[i] !== '"') {
                if (input[i] === '\\' && i + 1 < input.length) {
                    i++;
                    str += input[i];
                } else {
                    str += input[i];
                }
                i++;
            }
            i++;
            return str;
        } else {
            const start = i;
            while (i < input.length && !/[\,\) \t]/.test(input[i])) i++;
            return input.slice(start, i);
        }
    }

    function parseArgs() {
        i++;
        const args = [];
        skipWhitespace();
        if (input[i] === ')') { i++; return args; }
        args.push(parseValue());
        skipWhitespace();
        while (i < input.length && input[i] === ',') {
            i++;
            skipWhitespace();
            args.push(parseValue());
            skipWhitespace();
        }
        i++;
        return args;
    }

    while (i < input.length) {
        skipWhitespace();
        if (i >= input.length) break;

        const name = parseName();
        if (!name) break;

        skipWhitespace();
        const args = input[i] === '(' ? parseArgs() : undefined;

        let value = undefined;
        if (input[i] === '=') {
            i++;
            value = parseValue();
        }

        attrs.push({ name, args, ...(value !== undefined && { value }) });
    }

    return attrs;
}

export function convertAstToJson(ast)
{
    let walker = ast.walker();
    let ev;
    let stack = [];
    let parentNode = { type: "root" };

    while (ev = walker.next())
    {
        // Leaving container?
        if (ev.node.isContainer && !ev.entering)
        {
            parentNode = stack.pop();
            continue;
        }

        // Copy node
        let newNode = {};
        newNode.type = ev.node.type;           

        let copyAttrs = ["literal", "listType", "listStart", 
                         "listTight", "listDelimiter", "info", 
                         "level", "directive", "args",
                         "destination", "title", "onEnter", "onExit",
                         "id", "attrs",
                         "sourcePos"];
        for (let attr of copyAttrs)
        {
            if (ev.node[attr] !== undefined && ev.node[attr] !== null)
                newNode[attr] = ev.node[attr];
        }   

        // Add to parent
        if (parentNode.children === undefined)
            parentNode.children = [];
        parentNode.children.push(newNode);

        // Push to stack
        if (ev.node.isContainer && ev.entering)
        {
            stack.push(parentNode);
            parentNode = newNode;
        }
   }

   return parentNode;
}


export function cssToCamelCase(name) {
    return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}


export function slashConcat(a, b)
{
    if (a.endsWith("/"))
        a = a.substring(0, a.length - 1);
    if (b.startsWith("/"))
        b = b.substring(1);
    return `${a}/${b}`;
}