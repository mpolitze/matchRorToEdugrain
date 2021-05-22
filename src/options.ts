import { DescribedOption } from './ICommand'

export default [
    { name: 'help', alias: 'h', type: Boolean, description: 'Print this help message.'},
    { name: 'src', alias: 's', defaultValue: './dist', type: String, description: 'Root folder of compiled application. Default "./dist".', typeLabel: '{underline path}' },
    { name: 'library', alias: 'l', defaultValue: 'Webapps', type: String, description: 'SharePoint document library to store application. Default "Webapps"', },
    { name: 'config', alias: 'c', defaultValue:'./spconfig.json', type: String, description: 'Path to SharePoint connection information. Will use *.local.json for local overrides. Default: "spconfig.json"', typeLabel: '{underline path}'},
    { name: 'package', alias: 'p', defaultValue:'./package.json', type: String, description: 'Path to node style package information file. Default "./package.json"',  typeLabel: '{underline path}'},
    { name: 'acceptJsonHeader', alias: 'j', type: Boolean, description: 'Add "Accept: application/json;odata=verbose" header to SharePoint API requests.'},
    { name: 'verbose', alias: 'v', type: Boolean, description: 'Enable verbose logging.'},    
] as DescribedOption[]
