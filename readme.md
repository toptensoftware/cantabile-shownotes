# Cantabile Show Notes 2

This is a feature preview of the new Show Notes feature (aka "Show Notes 2") currently under development
for Cantabile Performer.

The primary difference between these show notes and the existing show notes is the use of 
Markdown as the language for authoring show notes.  ie: instead of creating "note items" in Cantabile
you author a single text file with all your show notes.

Eventually there will be an automatic conversion process to convert the  old format show notes to the new format
however this isn't supported yet.

The new show notes are not included in the Cantabile installation package and needs to be manually 
installed (see below)

## Features

Currently implemented and working:

* Based on [Markdown](https://www.markdownguide.org/)
* Custom extensions to Markdown for Cantabile specific features and easier formatting
* Conditional sections of the document based on the selected Cantabile Song State.
* Support for inline ABC music notation
* Support for inline ChordPro notation
* Support for MusicXML
* Support for PDF files (either individual pages, or entire document)
* Support for migrating old show notes to new format
* Support for embedded variables eg: `$(SongName)`
* Support for column splits

TODO/Suggestions:

* ability to !include chord and abc formats
* auto-scroll based on Cantabile Song state
* auto-scroll based on transport position
* multiple notes documents
* mulitple views on a single notes document
* conditional inclusion based on expression (as opposed to state)
* show note bindings for remote scrolling
* ability to insert named anchor points that bindings can scroll to
* a directive to set default PDF resolution
* error, info, warning and message directives
* better reporting of syntax/formatting errors
* editing tools (formatting, insert section, insert image etc...)
* integration into Cantabile's main application window


## Installation

[Video Walkthrough](https://www.dropbox.com/scl/fi/kd0orqf5xv0rqf9j42jq4/CantabileShowNotes2-setup.mkv?rlkey=smobd7zxgi1uowysjjlmru00g&dl=0)

To install Show Notes 2:

1. Install the latest build of Cantabile 4.0 (4350 or later)
    - [download here](https://www.cantabilesoftware.com/download)
2. Install GhostScript if you need PDF support.
    - [download here](https://ghostscript.com/releases/gsdnld.html)
    - install the Ghostscript for Windows (64 bit) - Ghostscript AGPL Release
3. Install the `shownotes2.webfolder`
    - [download here](https://github.com/toptensoftware/cantabile-shownotes/releases/download/latest/shownotes2.webfolder)
    - Copy the downloaded `shownotes2.webfolder` to your "Resources" directory.
    - The resources directory is typically `C:\Users\YOURUSERNAME\Documents\Cantabile\Resources`
    - To check your resources folder location go to Cantabile -> Tools -> Options -> File Locations -> Resources
4. Restart Cantabile if already running (note this requires Cantabile Performer, other editions not supported)


## Usage

[Video Walkthrough](https://www.dropbox.com/scl/fi/brirs0bbs111g110ad6fe/CantabileShowNotes2-usage.mkv?rlkey=tt8h1xwa1eg5wb3uitky3fgw2&dl=0)

Show Notes 2 runs externally to Cantabile and uses Cantabile's built-in network server:

1. Make sure the network server is enabled in Cantabile -> Tools -> Options -> Miscellaneous -> Network Server
2. If you have PDF or image files you'd like to embed in your notes you can configure one or more directories where you'll store those files in Cantabile -> Tools -> Options -> Miscellaneous -> Network Server -> Asset Search Path.
3. Start a web browser (Chrome, Edge, Firefox etc...) and navigate to http://localhost:35007/shownotes2/

The browser will now show the show notes for the currently loaded song.  When you switch songs the newly selected song's show notes will be displayed.

The header area shows:

* The currently selected song
* The currently selected state
* An "Edit" button to edit the notes
* A theme selector switch to switch between Dark and Light modes.

To edit the show notes, click the "Edit" button at the top right.  This will split the screen and show a text editor on the right where you can enter your Markdown notes.

Changes you make to the song's show notes will be stored in the currently loaded song file - just make sure you save the song in Cantabile if you want to keep any changes you've made.

## Markdown Reference

For standard Markdown formatting instructions, [see here](https://www.markdownguide.org/).  The rest of this section covers extensions specific to Cantabile Show Notes.

### Sections

Sections allow marking parts of your document for special behaviour.  This includes conditional display and some simple formatting attributes.

eg: suppose you wanted to change the foreground color of a block of text

```txt
!section fg=green
This text will appear green
!/section
```

The available set of attributes include:

* `fg` - foreground color (any html color, or #rrggbb format)
* `bg` - background color (any html color, or #rrggbb format)
* `visible` - hide or show the section (`true` or `false`)
* `align` - set text alignment (`left`, `right` or `center`)
* `fixed` - fixed font formatting compatible with Cantabile's old show notes "fixed" format
* `size` - set the text size in pixels (don't include a unit suffix)
* `bold` - `true` or `false`
* `image` - sets a background image for the section
* anything else will be treated as a css style attribute.

For attributes values with spaces, enclose in double quotes

eg:
```txt
!section image="my background image.png"

!/section
```

### Nested Sections

Sections can be nested:

```txt
!section bg=white

!section fg=green
Green on white
!/section

!section fg=orange
Orange on white
!/section

!/section
```


### State Sensitive Sections

Section attributes can be conditional based on the currently selected Cantabile Song State:

eg: to only show a section when the current Cantabile song state is `Chorus1` or `Chorus2`

```txt
!section visible(Chorus1,Chorus2)=true
Let it be, let it be, let it be, let it be
Whisper words of wisdom, let it be
!/section
```

eg: to hide a section in all states except "Verse1"

```txt
!section visible(Verse1)=false
Let it be, let it be, let it be, let it be
Whisper words of wisdom, let it be
!/section
```

eg: to change the size and color of a section in the "Intro" state:

```txt
!section fg(Intro)=orange size(Intro)=24
This will be colored orange and size 24 but only in when Intro state is active
!/section
```

### ABC Music Notation

ABC notation is a text based markup format for music notation.  For details
on how to write ABC notation, [see here](https://abcnotation.com/).

To include ABC notation in show notes, use a [Markdown fenced code block](https://www.markdownguide.org/extended-syntax/#fenced-code-blocks) with the language
set to `abc`

`````txt
```abc
M:4/4
K:G
|:GABc dedB|dedB dedB|c2ec B2dB|c2A2 A2BA|
  GABc dedB|dedB dedB|c2ec B2dB|A2F2 G4:|
|:g2gf gdBd|g2f2 e2d2|c2ec B2dB|c2A2 A2df|
  g2gf g2Bd|g2f2 e2d2|c2ec B2dB|A2F2 G4:|
```
`````


### Lyric Chord Annotations

Lyric with chord annotations is supported by using a [Markdown fenced code block](https://www.markdownguide.org/extended-syntax/#fenced-code-blocks) with the language
set to `chord`, `chordpro` or `ultimate-guitar`.


`````txt
```chord
       Am         C/G        F          C
Let it be, let it be, let it be, let it be
C                G              F  C/E Dm C
Whisper words of wisdom, let it be`.substring(1);
```
`````


`````
```ultimate-guitar
[Chorus]
       Am         C/G        F          C
Let it be, let it be, let it be, let it be
C                G              F  C/E Dm C
Whisper words of wisdom, let it be
```
`````

`````
```chordpro
Let it [Am]be, let it [C/G]be, let it [F]be, let it [C]be
[C]Whisper words of [G]wisdom, let it [F]be [C/E] [Dm] [C]
```
`````

See [ChordPro](https://www.chordpro.org/) website for more.


### MusicXML Support

Show notes can render `.musicxml` and `.mxl` files with `!include`

```
!include my-score.musicxml
```

or

```
!include my-score.mxl
```

You can also use fenced code blocks for musicxml however this tends to be very verbose and not recommended:

`````
```musicxml
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <movement-title>Prelude to a Tragedy</movement-title>
  etc...
  etc...
  etc...
```
`````


### Image Includes

Images can be included using standard Markdown syntax:

```
![my image](my-image.png)
```

or more simply with the `!include` directive:

```
!include myimage.png
```

See locating asset files below for how image files are located.

### PDF Support

PDF rendering is supported if GhostScript is installed on the same machine
as Cantabile.

To include all pages of the PDF:

```
!include my-score.pdf
```

To include a specific page, append the page number as a query string:

```
!include my-score.pdf?page=1
```

See locating asset files below for how PDF files are located.




### Column Splits

Create column splits with the `!split` directive.

eg:

`````
!split 50 50

Left Column Content
Goes Here

!split

Right Column Content
Goes Here

!/split
`````

* `!split N N` - with column ratios (eg: `50 50`) starts a 
  column split with that many columns in the ratios specified.
* `!split` - on its own starts a new column
* `!/split` - ends the split section

You can also use any standard CSS units on the split declaration. Any
integer value without a units is automatically converts to `fr` units.

eg: this would create a split with 100px column on the left and
    the remaining space for the right column and with a 50 pixel
    gap between the columns

```
!split 100px 1fr; gap=50px
```


### Document Settings

Document wide settings can be specified using the `!document` directive.

eg: force the width of the displayed document to 900px (the default is 1000px)

```
!document width=900px
```

eg: remove the default 1000px width:

```
!document width=
```

eg: constain the width to no more that 1000px:

```
!document width= max-width=1000px
```

eg: set the background color for the whole document:

```
!document bg=navy
```


## Locating Asset Files

When referencing image, PDF and other asset files in your markdown, Cantabile uses the following strategy to locate the file:

1. The same directory as the current song is checked.
2. All directories in the Asset Search path are checked in order.

The Asset Search path is a set of directories you can configure in Cantabile ->  Tools -> Options -> Miscellaneous -> Network Server -> Asset Search Path.

This allows two basic approaches to storing asset files for songs, either:

* store them in the same directory as your song
* store everything in a separate assets directory

## Contributing

This repository contains the entire client-side implementation of Show Notes.  

If you're interested in contributing to this project, please [see here](readme-dev.md).

## Issues and Suggestions

This is a feature preview and still under development.  If you find issues
or have suggestions please [get in touch](contact@cantabilesoftware.com).

## License

This project is licensed under the MIT License - see the LICENSE file for details.
