import { ICommand } from '../ICommand';

import DfnAaiToJsonCommand from './DfnAaiToJsonCommand';
import MatchRorToEdugain from './MatchRorToEdugainCommand';
import UpdateData from './UpdateDataCommand';
import HelpCommand from './HelpCommand';

const c = [
    new DfnAaiToJsonCommand(),
    new MatchRorToEdugain(),
    new UpdateData(),
    new HelpCommand(),
] as ICommand[];

const commands = c.reduce((o, c) => ({...o, [c.Name().toLowerCase()]: c}), {}) as {[key:string] : ICommand};

export default commands;