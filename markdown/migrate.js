const Behaviours = {
    hidden: 1 << 0,
    text: 1 << 1,
    image: 1 << 2,
    colors: 1 << 3,
};

function applyState(r, showNote, stateId, behaviour)
{
    // Quit if nop
    if (stateId == 0 || behaviour == 0)
        return;

    // Find the state    
    let state = showNote.stateManager.states["" + stateId];
    if (!state)
        return;

    // Apply fields
    if (behaviour & Behaviours.hidden)
        r.hidden = state.hidden;
    if (behaviour & Behaviours.text)
        r.text = state.text;
    if (behaviour & Behaviours.image)
        r.imageFile = state.imageFileRelative;
    if (behaviour & Behaviours.colors)
    {
        r.backgroundColor = state.backgroundColor;
        r.textColor = state.textColor;
    }
}

// Resolve a show note for a specified state
function resolveNote(showNote, states)
{
    // Start with defaults
    let n = { 
        id: showNote.uniqueID,
        hidden: showNote.hidden,
        backgroundColor: showNote.backgroundColor,
        textColor: showNote.textColor,
        alignment: showNote.alignment,
        fontSize: showNote.fontSize,
        bold: showNote.bold,
        fixedPitch: showNote.fixedPitch,
        text: showNote.text,
        imageFile: showNote.imageFileRelative,
        states: [],
    }

    for (let state of states)
    {
        let s = {};
        s.name = state.name;
        n.states.push(s);
        applyState(s, showNote, state.id, showNote.stateManager.behaviour);
        applyState(s, showNote, state.idNonLinked, showNote.stateManager.nonLinkedBehaviour);
    }

    return n;
}

function expandMixedNote(n)
{
    let newNotes = [];

    for (let s of n.states)
    {
        // Ignore if hidden
        if (s.hidden === true || (s.hidden === undefined && n.hidden))
            continue;

        // Does text and image match?
        if ((s.text !== undefined && s.text !== n.text) || 
            (s.imageFile !== undefined && s.imageFile !== n.imageFile))
        {
            // Create a replacement node with the different text and image
            let replacementNote = newNotes.find(n => n.text === s.text && n.imageFile === s.imageFile);
            if (!replacementNote)
            {
                replacementNote = structuredClone(n);
                newNotes.push(replacementNote);
                replacementNote.states.forEach(s => {
                    s.hidden = true,
                    delete s.text;
                    delete s.imageFile;
                });
            }
            replacementNote.text = s.text;
            replacementNote.imageFile = s.imageFile;

            // Make this state as visible in the replacement note
            let replacementState = replacementNote.states.find(rs => rs.name === s.name);
            replacementState.hidden = false;

            // Make this state as hidden in the original note
            s.hidden = true;
        }

        delete s.text;
        delete s.imageFile;
    }

    if (n.states.every(x => x.hidden))
        return [ ...newNotes ];
    else
        return [ n, ...newNotes ];
}

function mostFrequent(arr) {
  const counts = new Map();
  let best = arr[0], bestCount = 0;

  for (const val of arr) {
    const c = (counts.get(val) || 0) + 1;
    counts.set(val, c);
    if (c > bestCount) {
      bestCount = c;
      best = val;
    }
  }
  return best;
}

function cleanupStates(n)
{
    simplify("backgroundColor");
    simplify("textColor");
    simplify("hidden");

    function simplify(field)
    {
        let values = [n[field], ...n.states.filter(s => s[field] !== undefined && (field === 'hidden' || s.hidden !== false)).map(s => s[field])];
        let mostFreq = mostFrequent(values);
        if (n[field] != mostFreq)
        {
            for (let s of n.states)
            {
                if (s[field] === mostFreq)
                    delete s[field];
                else 
                    s[field] = n[field];
            }   
            n[field] = mostFreq;
        }
    }

    for (let s of n.states)
    {
        if (s.hidden == true || (s.hidden === undefined && n.hidden))
        {
            delete s.backgroundColor;
            delete s.textColor;
            delete s.text;
            delete s.imageFile;
        }

        if (s.hidden === n.hidden)
            delete s.hidden;
        if (s.backgroundColor === n.backgroundColor)
            delete s.backgroundColor;
        if (s.textColor === n.textColor)
            delete s.textColor;
        if (s.text === n.text)
            delete s.text;
        if (s.imageFile === n.imageFile)
            delete s.imageFile;
    }

    n.states = n.states.filter(s => Object.keys(s).length > 1);
}

function escapeStateName(name)
{
    if (name.match(/^[a-zA-Z0-9_]+$/))
        return name;
    return `"${name.replace(/"/g, '\\"')}"`;
}

const colorMap = {
    Default: 0,
    Red: 1,
    Maroon: 2,
    Green: 3,
    Lime: 4,
    Blue: 5,
    Navy: 6,
    Yellow: 7,
    Olive: 8,
    Fuscia: 9,
    Purple: 10,
    Cyan: 11,
    Teal: 12,
    Orange: 13,
    Brown: 14,
}

function mapColor(name)
{
    if (colorMap[name] === undefined)
        return name;

    return `color${colorMap[name]}`;
}

export function migrate(v1raw)
{
    let { showNotes, states } = v1raw;

    if (showNotes.length == 0)
        return "";

    let notes = [];
    for (let showNote of showNotes)
    {
        // Resolve note states
        let n = resolveNote(showNote, states);

        console.log(`----- Show note #${n.id} -----`);
        console.log(`Resolved:`);
        console.log(JSON.stringify(n, null, 4));

        // Resolve mixed notes (where text and image differ between states)
        let expanded = expandMixedNote(n);
        notes.push(...expanded);

        console.log(`Expanded:`);
        console.log(JSON.stringify(expanded, null, 4));

        console.log("\n\n");
    }

    // Remove redundant state fields
    notes.forEach(n => cleanupStates(n));


    // Now render to markdown
    let md = 
`!! NOTE: These notes were migrated from the old show notes format.
!! If you make changes here they will be saved with your song but will only be 
!! visible in this new Show Notes viewer.  In Cantabile's main window you will 
!! still see your original notes and not any modifications made here.

`;
    for (let n of notes)
    {
        md += `!section `;

        if (n.hidden)
        {
            let shownStates = n.states.filter(s => s.hidden !== true);
            if (shownStates.length > 0)
                md += `visible(${shownStates.map(s => escapeStateName(s.name)).join(",")})=true `;
        }
        else
        {
            let hiddenStates = n.states.filter(s => s.hidden === true);
            if (hiddenStates.length > 0)
                md += `visible(${hiddenStates.map(s => escapeStateName(s.name)).join(",")})=false `;
        }

        md += formatColor("fg", "textColor");
        md += formatColor("bg", "backgroundColor");

        if (n.imageFile && n.imageFile != "")
        {
            md += `image=\"${n.imageFile.replace(/\\/g, "/")}\" `;
        }

        if (n.alignment != "Center")
            md += `align=${n.alignment.toLowerCase()} `;
        if (n.fontSize != 16)
            md += `size=${n.fontSize} `;
        if (n.bold)
            md += `bold `;
        if (n.fixedPitch)
            md += `fixed `;

        md += "\n";
        if (n.fixedPitch)
            md += "```\n";
        md += n.text;
        if (n.fixedPitch)
        {
            if (!n.text.endsWith("\n"))
                md += "\n";
            md += "```";
        }
        md += "\n";
        md += "!/section\n\n"

        function formatColor(prefix, field)
        {
            let r = "";
            if (n[field] != "Default")
                r += `${prefix}=${mapColor(n[field])} `;

            let otherColors = [... new Set(n.states.map(x => x[field]).filter(x => x !== undefined))];

            for (let c of otherColors)
            {
                let color = c == "Default" ? "" : c;
                r += `${prefix}(${n.states.filter(s => s[field] === c).map(s => escapeStateName(s.name)).join(",")})=${mapColor(color)} `;
            }

            return r;
        }
    }
    return md;
}

