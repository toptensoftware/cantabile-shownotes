import { parseAndRenderShowNotes } from "./showNotes.js";

var html = parseAndRenderShowNotes(`
!document width=1000px
# heading


!include test.pdf

`)
console.log(html.html);
console.log(html.script);