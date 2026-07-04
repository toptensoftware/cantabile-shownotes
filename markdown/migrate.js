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

function resolveMixedNote(n)
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
                else if (!s[field])
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

export function migrate(v1raw)
{
    let { showNotes, states } = v1raw;

    let notes = [];
    for (let showNote of showNotes)
    {
        // Resolve note states
        let n = resolveNote(showNote, states);

        // Resolve mixed notes (where text and image differ between states)
        notes.push(...resolveMixedNote(n));
        //notes.push(n);
    }

    // Remove redundant state fields
    notes.forEach(n => cleanupStates(n));

    // Dump
    let index = 1;
    for (let n of notes)
    {
        console.log(`Show note #${index}:`)
        console.log(JSON.stringify(n, null, 4));
        console.log("\n\n");
        index++;
    }

    // Now render to markdown
    let md = "";
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

        md += "\n";
        md += n.text;
        md += "\n";
        md += "!/section\n\n"

        function formatColor(prefix, field)
        {
            let r = "";
            if (n[field] != "Default")
                r += `${prefix}=${n[field]} `;

            let otherColors = [... new Set(n.states.map(x => x[field]).filter(x => x !== undefined))];

            for (let c of otherColors)
            {
                let color = c == "Default" ? "" : c;
                r += `${prefix}(${n.states.filter(s => s[field] === c).map(s => escapeStateName(s.name)).join(",")})=${color} `;
            }

            return r;
        }
    }
    return md;
}

