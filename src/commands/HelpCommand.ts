import commandLineUsage from "command-line-usage";
import { ICommand, ILogger, IOptions } from "../ICommand";

const pkgjson  = require('../../package.json');

import commands from '.';

export default class HelpCommand implements ICommand{
    Name(){
        return "Help";
    }

    Usage(){
        return [{
            header: `${pkgjson.name} - ${pkgjson.version}`,
            content: 'Experimental CLI to run different analysis commands on federated infrastructures.',

        },{
            header: 'Synopsis',
            content: [ 
                `${pkgjson.name} [--verbose] <command> <options>`,
                `${pkgjson.name} --version`,
            ]
        },{
            content: `Run "${pkgjson.name} <command> --help" for more information`
        },{
            header: 'Available Commands',
            content: Object.entries(commands).reduce((c, [ _, o ]) => c+"\n"+o.Name(), "").trim()
        }]
    }

    Options(){
        return [];
    }

    async Run(args : { logger:ILogger, options:IOptions }){
        const usage = commandLineUsage(this.Usage())
        console.log(usage)
    }
}