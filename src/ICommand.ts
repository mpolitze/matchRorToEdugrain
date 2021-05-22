import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import { Logger as ILogger }  from 'winston';

export { ILogger };

export interface DescribedOption extends commandLineArgs.OptionDefinition{
    description?:string;
}

export interface IOptions{
    [key:string]:string
}

export interface ICommand{
    Name() : string;
    Options() : DescribedOption[];
    Usage() : commandLineUsage.Section[];
    Run( args:{ logger:ILogger, options:{ [key:string]:string } }) : Promise<void>;
}