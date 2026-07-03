# Developer Notes

This repository contains the source code for Cantabile Show Notes 2.

## Overview

* Markdown processing is based on a custom fork of commonmarkjs ([see here](https://github.com/toptensoftware/commonmark.js/)) that provides support for parsing directives (eg: !section, !document etc...)
* The [`./markdown`](./markdown) project uses commonmarkjs to parse the markdown and  render final html and script and handles all custom directives
* The [`./editor`](./editor) project contains the editor package that is bundled up as `shownotes2.webfolder` package as served by
  Cantabile's web server
* [CodeOnlyJS](https://codeonlyjs.org/) is used for the front-end web framework
* [cantabile-js](https://github.com/toptensoftware/cantabile-js/tree/v0.3) is used for network access to Cantabile
* [CodeMirror](https://codemirror.net/) is used for the text editor
* [Rollup](https://rollupjs.org/) is used for bundling


## Development Environment

To setup a development environment:

1. Install git - [see here](https://git-scm.com/install/windows)
2. Install NodeJS - [see here](https://nodejs.org/en/download)
3. Create a [fork of the repository](https://github.com/toptensoftware/cantabile-shownotes/fork)
4. At a command prompt, clone the repository - `git clone git@github.com:YOURGITHUBUSERNAME/cantabile-shownotes`
5. Change to the project directory - `cd cantabile-shownotes`
6. Install NPM packages - `npm install`
7. Run the development server - `npm run dev`
8. Make your changes and test at http://localhost:3000
9. Committing and pushing back to github will build the webfolder release package - `git push`
10. Create a [GitHub Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) to contribute your changes back to the official repository








