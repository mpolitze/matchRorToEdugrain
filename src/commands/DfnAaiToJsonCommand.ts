import parser  from 'fast-xml-parser';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';

import { ICommand, ILogger, IOptions } from '../ICommand'

type Dict<T> = { [id: string] : T; };

class IdpInfo{
    DisplayName: Dict<string> = {};
    Logo?:string;
}

export default class DfnAaiToJsonCommand implements ICommand{
    Name(){
        return "DfnAai2Json";
    }

    Usage(){
        return [{
            header: `DFN AAI XML to JSON`,
            content: 'Convert DFN AAI Metadata information for WAYF selector from XML format to JSON.',

        },{
            header: `Synopsis`,
            content: `${this.Name()} [<metadata url>] [-o {underline path}] [-i]`,

        },{
            header: 'Options',
            optionList: this.Options().filter(o => o.name!='metadata'),
        }];
    }

    Options(){
        return [
            {defaultOption: true, name: 'metadata', alias:'m', defaultValue:'https://www.aai.dfn.de/fileadmin/metadata/dfn-aai-basic-metadata.xml', type: String, description:'URL to Federation metadata XML.', typeLabel: '{underline path}'},
            {name: 'out', alias:'o', defaultValue:'./dfnaai.json', type: String, description:'Path to write converted federation JSON file.', typeLabel: '{underline path}'},
            {name: 'imgToBase64', alias:'i', defaultValue:false, type: Boolean, description:'Output base64 encoded images instead of URLs.'}            
        ];
    }

    async Run({ logger, options } : { logger:ILogger, options:IOptions }){
        logger.verbose(`Loading federation metadata from ${options.metadata}.`);
        const response = await axios.get(options.metadata);
        const allEntities = parser.parse(response.data, { ignoreNameSpace : true, ignoreAttributes : false, attributeNamePrefix : '', textNodeName: 'text'});
        const idpEntities = (allEntities.EntitiesDescriptor.EntityDescriptor as Array<any>)        
            .filter(e => e.IDPSSODescriptor);

        logger.verbose(`Got ${idpEntities.length} IdPs.`);

        const obj = idpEntities.reduce((o, e) => ({...o , ...entityToObject(e)}), {}) as Dict<IdpInfo>;
    
        const outPath = path.resolve(options.out);

        if(!options.imgToBase64){
            logger.verbose(`Writing file ${outPath}`);
            await fs.writeFile(outPath,JSON.stringify(obj));
        }else{
            logger.verbose(`Requesting IdP logos.`);
            const imgs = await loadLogoBase64(obj, logger);
            logger.verbose(`Writing file ${outPath}`);
            await fs.writeFile(outPath,JSON.stringify(imgs));
        }
    }
}

function entityToObject(e:Dict<any>){
    return {
        [e.entityID]: {
            DisplayName : getDisplayName(e),
            Logo : getLogo(e), 
        }
    } as Dict<IdpInfo>;
}

function getDisplayName(entity:any){
    const dns = makeArray(entity.IDPSSODescriptor.Extensions.UIInfo.DisplayName);
    return dns.reduce((o, dn) => ({
        ...o, 
        [dn.lang]: dn.text
    }),{}) as Dict<string>;
}

function getLogo(entity:any){
    const logos = makeArray(entity.IDPSSODescriptor.Extensions.UIInfo.Logo);
    return logos.reduce((o, logo) => ({
        logo: logo.height * logo.width > o.size ? logo.text : o.logo,
        size: Math.max(logo.height * logo.width, o.size)
    }) , { size:-1, logo:undefined }).logo as string;
}

async function loadLogoBase64(entities:Dict<IdpInfo>, logger:ILogger){
    const downloadImgs = Object.entries(entities).map(async ([id, e]) => {
        const o = {} as Dict<IdpInfo>;
        o[id] = { ...e } ;
        delete o[id].Logo;        
        if(!e.Logo) return;
        try{
            const response =  await axios.get(e.Logo, {responseType: 'arraybuffer'});
            const mime = response.headers['content-type'].split(';')[0] ?? 'image/jpeg';
            const imgBase64 = 'data:' + mime +';base64,' + Buffer.from(response.data).toString('base64');
            o[id].Logo = imgBase64;
        }
        catch(err){
            logger.warn(`\tHTTP error for ${e.Logo}: ${err.response ? err.response.status : err.message}`);
        }
        return o;
    });

    const imgs = (await Promise.all(downloadImgs)).reduce((o, e) => ({...o, ...e}), {});

    return imgs || {};
}

function makeArray(x:any){
    return [x].flat().filter((e:any)=>e);
}