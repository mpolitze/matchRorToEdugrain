# EduGain to ROR Organization Mapping

A sequence of approaches towards automatically matching EduGain Entity IDs and ROR IDs based on the published datasets. 

Currently uses
* Edugain Entity Database
* ROR Export
* Wikidata Query

## How to run

This small set of scripts is developed and run using yarn 2 and typescipt.

To run or develop clone the git repository then...

Transpile Typescript to JavaScript
```sh
yarn run build
```

Download most recent ROR Dumop, Edugain Metadata and Wikidata export. You can add `--verbose` for more output.
```sh
yarn start UpdataData
```

Start matching ROR and Edugain based on the downloaded files.
```sh
yarn start MatchRor2Edugain
```

Run 
```sh
yarn start help
```
for more information and optional commandline arguments.

## Set up Development Environment

Actually most files should be under version control. To re-run setup proceed as follows:

Install yarn 2
```sh
yarn install berry
```

Install dependencies
```sh
yarn install
```

(Optional) Install SDK for VS Code
```sh
yarn dlx @yarnpkg/pnpify --sdk vscode 
```