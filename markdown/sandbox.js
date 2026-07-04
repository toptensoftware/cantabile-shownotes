/*
import { parseAndRenderShowNotes } from "./showNotes.js";

var html = parseAndRenderShowNotes(`
!document width=1000px
# heading


!include test.pdf

`)
console.log(html.html);
console.log(html.script);

*/

import fs from "fs";
import { migrate } from "./migrate.js";


let v1raw = JSON.parse(fs.readFileSync(import.meta.dirname + "/migrate-test-data.json", "utf8"));
let markdown = migrate(v1raw);
console.log(markdown);