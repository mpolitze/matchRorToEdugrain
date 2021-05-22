import commandLineUsage from 'command-line-usage';

import options from './options';

export default [
{
    header: 'SharePoint copy script for single page web applications',
    content: 'CLI to copy contents of a dist folder to a SharePoint document library using pnpjs.'
},{
    header: 'Command Line Options',
    optionList: options
},{
    header: 'Configuration Files',
    content: [
        { n: 'spconfig.json',       d: 'Connection information for SharePoint. Use interactive mode to generate file.'},
        { n: 'spconfig.local.json', d: 'Override file for local connection information. Values from interactive configuration will be stored here.'},
        { n: 'package.json',        d: 'Read package information from file.'}
    ]
},{
    header: 'Environment Variables',
    content: [
        'For production deployment set following environment Variables (see https://github.com/koltyakov/node-sp-auth-config for details).',
        'Development environment will interactively ask for missing values and store them in "spconfig.local.json".'
    ]
},{
    content: [
        { n: 'SPAUTH_ENV',      d: 'set to "production" for non interactive environments.'},
        { n: 'SPAUTH_FORCE ',   d: 'set to "true" to make SPAUTH_\\{CREDENTIALS\\} variables take precedence.'},
        { n: 'SPAUTH_SITEURL',  d: 'full site URL e.g. "https://sharepoint.ecampus.rwth-aachen.de/vo/pit/".'},
        { n: 'SPAUTH_USERNAME', d: 'user to login to site e.g. "svc_gitlab", needs at least contribute rights to the document library.'},
        { n: 'SPAUTH_DOMAIN',   d: 'user domain e.g. "admin".'},
        { n: 'SPAUTH_PASSWORD', d: 'user password.'},
    ]
}
] as commandLineUsage.OptionList[]
