/** Behaviour flags for state fields */
const Behaviours = {
    hidden: 1 << 0,
    text: 1 << 1,
    image: 1 << 2,
    colors: 1 << 3,
};

/** Applies a state to a show note, based on the specified behaviour flags 
 * @param {Object} mstate The target markdown state object to apply the state to
 * @param {Object} showNote The source show note object
 * @param {number} stateId The ID of the state to apply
 * @param {number} behaviour The behaviour flags indicating which state fields to apply
 */
function applyState(mstate, showNote, stateId, behaviour)
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
        mstate.hidden = state.hidden;
    if (behaviour & Behaviours.text)
        mstate.text = state.text;
    if (behaviour & Behaviours.image)
        mstate.imageFile = state.imageFileRelative;
    if (behaviour & Behaviours.colors)
    {
        mstate.backgroundColor = state.backgroundColor;
        mstate.textColor = state.textColor;
    }
}

/** Resolve a show note for a specified state
 * @param {Object} showNote The source show note object
 * @param {Array} states The array of state objects
 * @returns {Object} The resolved markdown note object with an array of states
 */

function resolveNote(showNote, states)
{
    // Start with defaults
    let mnote = { 
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

    // Apply states
    for (let state of states)
    {
        // Start with a blank state object
        let s = {};
        s.name = state.name;
        mnote.states.push(s);

        // Apply the common state fields
        applyState(s, showNote, state.id, showNote.stateManager.behaviour);

        // Apply the non-linked state fields
        applyState(s, showNote, state.idNonLinked, showNote.stateManager.nonLinkedBehaviour);
    }

    // Return the final note
    return mnote;
}

/** Markdown notes don't support per-state text or image so we need 
 *  to expand any notes that have different text or image between states 
 *  into multiple notes, one for each unique text/image combination. 
 * @param {Object} mnote The markdown note object to expand
 * @returns {Array} An array of markdown note objects, one for each unique text/image combination
 */
function expandMixedNote(mnote)
{
    let newNotes = [];

    for (let s of mnote.states)
    {
        // Ignore if hidden
        if (s.hidden === true || (s.hidden === undefined && mnote.hidden))
            continue;

        // Does text and image match?
        if ((s.text !== undefined && s.text !== mnote.text) || 
            (s.imageFile !== undefined && s.imageFile !== mnote.imageFile))
        {
            // No, so create (or use an existing) replacement node with 
            // the different text and image
            let replacementNote = newNotes.find(n => n.text === s.text && n.imageFile === s.imageFile);
            if (!replacementNote)
            {
                // Copy the note
                replacementNote = structuredClone(mnote);
                newNotes.push(replacementNote);

                // Start with all states hidden and no text or image
                replacementNote.states.forEach(s => {
                    s.hidden = true,
                    delete s.text;
                    delete s.imageFile;
                });

                // Store the text and image on the replacement
                replacementNote.text = s.text;
                replacementNote.imageFile = s.imageFile;
            }

            // Make this state as visible in the replacement note
            let replacementState = replacementNote.states.find(rs => rs.name === s.name);
            replacementState.hidden = false;

            // Make this state as hidden in the original note
            s.hidden = true;
        }

        // Remove the text and image from this stae
        delete s.text;
        delete s.imageFile;
    }

    if (newNotes.length == 0)
        return [mnote];

    // Return the original note plus any new notes, but only if the
    // original note has at least one visible state
    if (mnote.states.every(x => x.hidden))
        return [ ...newNotes ];
    else
        return [ mnote, ...newNotes ];
}

/** Helper to find the most frequent value in an array 
 * @param {Array} arr The array to analyze
 * @returns {any} The most frequent value
 */
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

/** Clean up redundant states on a note objectn.
 * @param {Object} mnote The markdown note object to clean up
 */
function cleanupStates(mnote)
{
    simplify("backgroundColor");
    simplify("textColor");
    simplify("hidden");

    // Updates the note object and it's states to the most frequent value
    // for a field is on the note itself, and states have the less frequent
    // values.  This reduces the amount of conditions logic in the final markdown.
    function simplify(field)
    {
        // Get all the values of this field across the note and its states
        let values = [mnote[field], ...mnote.states.filter(s => s[field] !== undefined && (field === 'hidden' || s.hidden !== false)).map(s => s[field])];

        // Work out which is most frequent and make that the note's value, and 
        // the less frequent values on the states
        let mostFreq = mostFrequent(values);
        if (mnote[field] != mostFreq)
        {
            for (let s of mnote.states)
            {
                if (s[field] === mostFreq)
                    delete s[field];
                else 
                    s[field] = mnote[field];
            }   
            mnote[field] = mostFreq;
        }
    }

    // Delete any state fields that are the same as the note's field or
    // fields that aren't used because the note is hidden
    for (let s of mnote.states)
    {
        if (s.hidden == true || (s.hidden === undefined && mnote.hidden))
        {
            delete s.backgroundColor;
            delete s.textColor;
            delete s.text;
            delete s.imageFile;
        }

        if (s.hidden === mnote.hidden)
            delete s.hidden;
        if (s.backgroundColor === mnote.backgroundColor)
            delete s.backgroundColor;
        if (s.textColor === mnote.textColor)
            delete s.textColor;
        if (s.text === mnote.text)
            delete s.text;
        if (s.imageFile === mnote.imageFile)
            delete s.imageFile;
    }

    // Filter out any redundant states that have no fields left
    mnote.states = mnote.states.filter(s => Object.keys(s).length > 1);
}

/** Escape a state name for use in markdown.  If it contains any non-alphanumeric characters 
    it will be quoted and any quotes escaped.
 * @param {string} name The state name to escape
 * @returns {string} The escaped state name
 */
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


/** The JSON dump of the v1 show notes uses hard coded names for the
 *  color indicies used in Cantabile.  This function maps those names 
 *  to the color index that name represents.
 * @param {string} name The color name to map
 * @returns {string} The color index name to use in markdown
 */
function mapColor(name)
{
    if (colorMap[name] === undefined)
        return name;

    return `color${colorMap[name]}`;
}

/** Migrate v1 show notes to the new markdown format
 * @param {Object} v1raw The raw v1 show notes object
 * @returns {string} The markdown representation of the show notes
 */
export function migrate(v1raw)
{
    // Crack input
    let { showNotes, states } = v1raw;

    // If there are no show notes, return an empty string
    if (showNotes.length == 0)
        return "";

    // Process each note object
    let mnotes = [];
    for (let showNote of showNotes)
    {
        // Resolve note into a markdown note object with an array of states
        let mnote = resolveNote(showNote, states);

        console.log(`----- Show note #${mnote.id} -----`);
        console.log(`Resolved:`);
        console.log(JSON.stringify(mnote, null, 4));

        // Expand mixed mode notes 
        // (ie: where text and image differ between states)
        let expanded = expandMixedNote(mnote);
        mnotes.push(...expanded);

        console.log(`Expanded:`);
        console.log(JSON.stringify(expanded, null, 4));
        console.log("\n\n");
    }

    // Remove redundant state fields
    mnotes.forEach(n => cleanupStates(n));


    // Now render to markdown
    let md = 
`!! NOTE: These notes were migrated from the old show notes format.
!! If you make changes here they will be saved with your song but will only be 
!! visible in this new Show Notes viewer.  In Cantabile's main window you will 
!! still see your original notes and not any modifications made here.

`;
    for (let mnote of mnotes)
    {
        md += `!section `;

        if (mnote.hidden)
        {
            let shownStates = mnote.states.filter(s => s.hidden !== true);
            if (shownStates.length > 0)
                md += `visible(${shownStates.map(s => escapeStateName(s.name)).join(",")})=true `;
        }
        else
        {
            let hiddenStates = mnote.states.filter(s => s.hidden === true);
            if (hiddenStates.length > 0)
                md += `visible(${hiddenStates.map(s => escapeStateName(s.name)).join(",")})=false `;
        }

        md += formatColorAttributes("fg", "textColor");
        md += formatColorAttributes("bg", "backgroundColor");

        if (mnote.imageFile && mnote.imageFile != "")
        {
            md += `image=\"${mnote.imageFile.replace(/\\/g, "/")}\" `;
        }

        if (mnote.alignment != "Center")
            md += `align=${mnote.alignment.toLowerCase()} `;
        if (mnote.fontSize != 16)
            md += `size=${mnote.fontSize} `;
        if (mnote.bold)
            md += `bold `;
        if (mnote.fixedPitch)
            md += `fixed `;

        md += "\n";
        if (mnote.fixedPitch)
            md += "```\n";
        md += mnote.text;
        if (mnote.fixedPitch)
        {
            if (!mnote.text.endsWith("\n"))
                md += "\n";
            md += "```";
        }
        md += "\n";
        md += "!/section\n\n"

        // Helper for format color attributes
        function formatColorAttributes(prefix, field)
        {
            let r = "";
            if (mnote[field] != "Default")
                r += `${prefix}=${mapColor(mnote[field])} `;

            let otherColors = [... new Set(mnote.states.map(x => x[field]).filter(x => x !== undefined))];

            for (let c of otherColors)
            {
                let color = c == "Default" ? "" : c;
                r += `${prefix}(${mnote.states.filter(s => s[field] === c).map(s => escapeStateName(s.name)).join(",")})=${mapColor(color)} `;
            }

            return r;
        }
    }
    return md;
}

