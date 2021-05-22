import axios from 'axios';
import path from 'path';
import { promises as fs } from 'fs';
import decompress from 'decompress';

import { ICommand, ILogger, IOptions } from "../ICommand";

export default class UpdateDataCommand implements ICommand{
    Name(){
        return "UpdateData";
    }

    Usage(){
        return [{
            header: `Update Data from ROR and Edugain Metadata`,
            content: 'Download most recent version of ROR registry data and Edugain metadata.',

        },{
            header: `Synopsis`,
            content: `${this.Name()} [-o {underline path}]`,

        },{
            header: 'Options',
            optionList: this.Options(),
        }];
    }

    Options(){
        return [
            {name:'outDir', alias:'o', defaultValue:'./data', type: String, description:'Directory to store downloaded data. Default "./data"', typeLabel: '{underline path}'}
        ];
    }

    async Run({options, logger} : { logger:ILogger, options:IOptions }){        
        const outDir = path.resolve(options.outDir);
        await UpdateRordata(logger, outDir);
        await UpdateEdugainData(outDir, logger);
        await UpdateWikiDataData(outDir, logger);
    }
}

async function UpdateEdugainData(outDir: string, logger: ILogger) {
    const edugainDownloadUrl = 'https://mds.edugain.org/edugain-v1.xml';
    const edugainOutFile = path.resolve(outDir, 'edugain-v1.xml');
    logger.verbose(`Getting edugain metadata from ${edugainDownloadUrl}`);
    const edugainXmlResponse = await axios.get(edugainDownloadUrl, { responseType: 'arraybuffer' });

    logger.verbose(`\tWriting to ${edugainOutFile}`);
    await fs.writeFile(edugainOutFile, edugainXmlResponse.data);
}

async function UpdateRordata(logger: ILogger, outDir: string) {
    logger.verbose(`Getting data from ROR github repository`);
    const rorDatasets = await GetGithubFolderContent('ror-community/ror-api/contents/rorapi/data');
    const rorVersion = rorDatasets[rorDatasets.length - 1].name;

    logger.verbose(`\tLatest version ${rorVersion}`);
    const [{ download_url: rorDownloadUrl }] = await GetGithubFolderContent(`ror-community/ror-api/contents/rorapi/data/${rorVersion}`);

    logger.verbose(`\tRelease URL ${rorDownloadUrl}`);
    const rorZipResponse = await axios.get(rorDownloadUrl, { responseType: 'arraybuffer' });

    logger.verbose(`\tDecompressing to ${outDir}`);
    await decompress(rorZipResponse.data, outDir);
}

async function UpdateWikiDataData(outDir: string, logger: ILogger) {
    const wikidateDownloadUrl = 'https://query.wikidata.org/sparql?query=SELECT+DISTINCT+?rorid+?api+WHERE{?i+wdt:P6782+?rorid.?i+wdt:P6269+?api}&format=json';
    const wikidataDownloadFile = path.resolve(outDir, 'wikidata-ror-api.json');
    logger.verbose(`Getting wikidata api information from ${wikidateDownloadUrl}`);
    const wikidataJsonResponse = await axios.get(wikidateDownloadUrl, { responseType: 'arraybuffer' });

    logger.verbose(`\tWriting to ${wikidataDownloadFile}`);
    await fs.writeFile(wikidataDownloadFile, wikidataJsonResponse.data);
}

async function GetGithubFolderContent(path:string){
    const { data } = await axios.get(`https://api.github.com/repos/${path}`);

    return (data as Array<any>).map((d:any) => ({
        name: d.name,
        download_url: d.download_url
    }));
}