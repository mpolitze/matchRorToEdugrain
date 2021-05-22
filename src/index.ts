import winston  from 'winston';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';

//import options from './options';
//import helpOptions from './helpOptions';

import commands from './commands';

const pkgjson  = require('../package.json');

const options = [
    { name: 'command', defaultOption: true, defaultValue: 'help' },
    { name: 'verbose', alias: 'v', type: Boolean, description: 'Enable verbose logging.'},
    { name: 'version', type: Boolean, description: 'Print version.'},
    { name: 'help', alias: 'h', type: Boolean, description: 'Print command help.'},
  ];

async function main(){
    const opts = commandLineArgs(options, { stopAtFirstUnknown: true });
    const argv = opts._unknown || []
    const command = (opts.command as string).toLowerCase();

    if(!commands[command]){
        console.log(`Unknown command ${command}. Use "${pkgjson.name} help" for a list of available commands.`);
        return;
    }
    
    const logger = winston.createLogger({
        level: opts.verbose ? 'verbose' : 'info',
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
        transports: [new winston.transports.Console()]
    });

    const copts = commandLineArgs(commands[command].Options(), { argv, partial: true });

    if(copts._unknown){
        console.log(`Unknown option ${copts._unknown[0]}. Use "${pkgjson.name} ${command} --help" for help.`);
        return;
    }

    if(opts.version){
        console.log(`${pkgjson.name} version ${pkgjson.version}`);
        return;
    }

    if(opts.help){
        const usage = commandLineUsage(commands[command].Usage());
        console.log(usage);
        return;
    }
    
    try{
        await commands[command].Run({logger:logger, options: copts });
    }
    catch(e){
        if(typeof e === "string"){
            logger.error(e.substring(0,Math.min(e.length, 5000)));
        }
        else{
            logger.error(e);
        }
    }
}



main();