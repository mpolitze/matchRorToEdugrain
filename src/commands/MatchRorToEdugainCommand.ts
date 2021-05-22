import { ICommand, ILogger, IOptions } from "../ICommand";

import parser from 'fast-xml-parser';
import axios from 'axios';
import { promises as fs } from 'fs';
import path from 'path';
import { URL } from 'url';

import { JSDOM } from 'jsdom';
import * as d3 from 'd3';

interface IRorObject {
    status: string;
    name: string;
    aliases: string[];
    wikipedia_url: string;
    external_ids: {
        FundRef: {
            all: string | string[],
            preferred: string | null
        },
        OrgRef: {
            all: string | string[],
            preferred: string | null
        },
        ISNI: {
            all: string | string[],
            preferred: string | null
        },
        GRID: {
            all: string | string[],
            preferred: string | null
        },
        Wikidata: {
            all: string | string[],
            preferred: string | null
        }
    },
    country: {
        country_name: string,
        country_code: string
    },
    id: string;
    labels: string[];
    links: string[];
    types: ("Education" | "Government" | "Nonprofit" | "Facility" | "Healthcare" | "Company")[];
    acronyms: string[];
}

interface IRorObjectExtended extends IRorObject{    
    links_url:URL[];
}

interface IFederationObject {
    entityID: string;
    IDPSSODescriptor: {
        Extensions: {
            Scope: { text: string },
            UIInfo: {
                DisplayName: {
                    text: string,
                    lang: string
                }[],
                InformationUrl: {
                    text: string,
                    lang: string,
                }[]
            },
        }
    }
    Organization: {
        OrganizationName: {
            text: string,
            lang: string,
        }[],
        OrganizationDisplayName: {
            text: string,
            lang: string,
        }[],
        OrganizationURL: {
            text: string,
            lang: string,
        }[],
    }
}

interface IWikiDataExportObject{
    results: {
        bindings:{
            api: {value:string},
            rorid: {value:string}
        }[]
    }
}

export default class MatchRorToEdugainCommand implements ICommand {
    Name() {
        return 'MatchRor2Edugain';
    }

    Usage() {
        return [];
    }

    Options() {
        return [
            { name: 'federationPath', defaultValue: './data/edugain-v1.xml' },
            { name: 'rorPath', defaultValue: './data/ror.json' },
            { name: 'wikidataPath', defaultValue: './data/wikidata-ror-api.json' },
            { name: 'outDir', defaultValue: './out/' }
        ];
    }

    async Run({ logger, options }: { logger: ILogger, options: IOptions }) {
        const federationPath = path.resolve(options.federationPath);
        const federationXML = (await fs.readFile(federationPath)).toString('utf-8');
        const allEntities = parser.parse(federationXML, { ignoreNameSpace : true, ignoreAttributes : false, attributeNamePrefix : '', textNodeName: 'text'});
        const idpEntities = (allEntities.EntitiesDescriptor.EntityDescriptor as Array<IFederationObject>)        
            .filter(e => e.IDPSSODescriptor);
 
        logger.verbose(`Got ${idpEntities.length} IdPs from federation.`);
 
        const rorPath = path.resolve(options.rorPath);
        const ror = require(rorPath) as IRorObjectExtended[];
 
        for(let r of ror){
            r.links_url = r.links.map(l => new URL(l));
        }

        logger.verbose(`Got ${ror.length} Orgs from ROR.`);

        const wikidataPath = path.resolve(options.wikidataPath);
        const wikidata = require(wikidataPath) as IWikiDataExportObject;
        const wd = [] as {rorid:string, entityId:string}[];

        for(let w of wikidata.results.bindings){
            wd.push({rorid:`https://ror.org/${w.rorid.value}`, entityId:w.api.value});
        }

        logger.verbose(`Got ${wd.length} results from Wikidata.`);


        const allMatchByIdP = {}  as {[x:string]:{[y:string]:number}};
        const allMatchByRor = {}  as {[x:string]:{[y:string]:number}};

        logger.verbose(`Step 1 "name": trying to match based on IdP OrganizationDisplayName to ROR name and aliases`);
        const nameMatchByIdP = {}  as {[x:string]:{[y:string]:number}};
        const nameMatchByRor = {}  as {[x:string]:{[y:string]:number}};
        let startTime = Date.now();
        let nomatch = 0;
        for(let idp of idpEntities){
            const {text:name} = getBestText(idp.Organization.OrganizationDisplayName);
            for(let r of ror){
                if(r.name == name || r.aliases.indexOf(name) >= 0){
                    nameMatchByIdP[idp.entityID] = nameMatchByIdP[idp.entityID] || {};
                    nameMatchByIdP[idp.entityID][r.id] = 2;

                    nameMatchByRor[r.id] = nameMatchByRor[r.id] || {};
                    nameMatchByRor[r.id][idp.entityID] = 2;
                    
                    allMatchByIdP[idp.entityID] = allMatchByIdP[idp.entityID] || {};
                    allMatchByIdP[idp.entityID][r.id] = allMatchByIdP[idp.entityID][r.id] + 2 || 2;

                    allMatchByRor[r.id] = allMatchByRor[r.id] || {};
                    allMatchByRor[r.id][idp.entityID] = allMatchByRor[r.id][idp.entityID] + 2 || 2;
                }
            }
            if(!nameMatchByIdP[idp.entityID]){
                //logger.warn(`Cold not find ${name} in ROR.`);
                nomatch++;
            }
        }
        logger.verbose(`Cold not find match for ${nomatch} Entities based on name.`);
        logger.verbose(`Took ${Date.now() - startTime}ms to calculate.`);
        
        logger.verbose(`Step 2 "url": trying to match based on IdP OrganizationURL to ROR Links based on hostname`);
        startTime = Date.now();
        nomatch = 0;
        const urlMatchByIdP = {}  as {[x:string]:{[y:string]:number}};
        const urlMatchByRor = {}  as {[x:string]:{[y:string]:number}};
        for(let idp of idpEntities){
            const url = new URL(getBestText(idp.Organization.OrganizationURL).text);
            const host = url.host;
            for(let r of ror){
                if(r.links_url.findIndex(l => l.host == host) >= 0){
                    urlMatchByIdP[idp.entityID] = urlMatchByIdP[idp.entityID] || {};
                    urlMatchByIdP[idp.entityID][r.id] = 1;

                    urlMatchByRor[r.id] = urlMatchByRor[r.id] || {};
                    urlMatchByRor[r.id][idp.entityID] = 1;

                    allMatchByIdP[idp.entityID] = allMatchByIdP[idp.entityID] || {};
                    allMatchByIdP[idp.entityID][r.id] = allMatchByIdP[idp.entityID][r.id] + 1 || 1;

                    allMatchByRor[r.id] = allMatchByRor[r.id] || {};
                    allMatchByRor[r.id][idp.entityID] = allMatchByRor[r.id][idp.entityID] + 1 || 1;
                }
            }

            if(!urlMatchByIdP[idp.entityID]){
                nomatch++;
            }
        }
        logger.verbose(`Cold not find match for ${nomatch} Entities based on url hostname.`);
        logger.verbose(`Took ${Date.now() - startTime}ms to calculate.`);

        logger.verbose(`Step 3 "wikidata": trying to match based on IdP entityId to wikidata api endpoint`);
        startTime = Date.now();
        nomatch = 0;
        const wikidataMatchByIdP = {}  as {[x:string]:{[y:string]:number}};
        const wikidataMatchByRor = {}  as {[x:string]:{[y:string]:number}};
        for(let idp of idpEntities){
            for(let w of wd){
                if(idp.entityID == w.entityId){
                    wikidataMatchByIdP[idp.entityID] = wikidataMatchByIdP[idp.entityID] || {};
                    wikidataMatchByIdP[idp.entityID][w.rorid] = 10;

                    wikidataMatchByRor[w.rorid] = wikidataMatchByRor[w.rorid] || {};
                    wikidataMatchByRor[w.rorid][idp.entityID] = 10;

                    allMatchByIdP[idp.entityID] = allMatchByIdP[idp.entityID] || {};
                    allMatchByIdP[idp.entityID][w.rorid] = allMatchByIdP[idp.entityID][w.rorid] + 10 || 10;

                    allMatchByRor[w.rorid] = allMatchByRor[w.rorid] || {};
                    allMatchByRor[w.rorid][idp.entityID] = allMatchByRor[w.rorid][idp.entityID] + 10 || 10;
                }
            }

            if(!wikidataMatchByIdP[idp.entityID]){
                nomatch++;
            }
        }
        logger.verbose(`Cold not find match for ${nomatch} Entities based on url hostname.`);
        logger.verbose(`Took ${Date.now() - startTime}ms to calculate.`);


        let nameResults = {uniqe: 0, ambiq: 0, nomat: 0};
        let urlResults = {uniqe: 0, ambiq: 0, nomat: 0};
        let wikidataResults = {uniqe: 0, ambiq: 0, nomat: 0};
        let allResults = {uniqe: 0, ambiq: 0, nomat: 0};
        let scoreResults = {uniqe: 0, ambiq: 0, nomat: 0};

        for(let { entityID } of idpEntities){
            if(nameMatchByIdP[entityID]){
                let rors = Object.keys(nameMatchByIdP[entityID]);
                let n = rors.length;
                let m = rors.reduce((p, r) => p + Object.keys(nameMatchByRor[r]).length, 0);
                if(n == 1 && m == 1){
                    nameResults.uniqe++;
                }else{
                    nameResults.ambiq++;
                }
            }else{
                nameResults.nomat++;
            }

            if(urlMatchByIdP[entityID]){
                let rors = Object.keys(urlMatchByIdP[entityID]);
                let n = rors.length;
                let m = rors.reduce((p, r) => p + Object.keys(urlMatchByRor[r]).length, 0);
                if(n == 1 && m == 1){
                    urlResults.uniqe++;
                }else{
                    urlResults.ambiq++;
                }
            }else{
                urlResults.nomat++;
            }

            if(wikidataMatchByIdP[entityID]){
                let rors = Object.keys(wikidataMatchByIdP[entityID]);
                let n = rors.length;
                let m = rors.reduce((p, r) => p + Object.keys(wikidataMatchByRor[r]).length, 0);
                if(n == 1 && m == 1){
                    wikidataResults.uniqe++;
                }else{
                    wikidataResults.ambiq++;
                }
            }else{
                wikidataResults.nomat++;
            }

            if(allMatchByIdP[entityID]){
                let rors = Object.keys(allMatchByIdP[entityID]);
                let n = rors.length;
                let m = rors.reduce((p, r) => p + Object.keys(allMatchByRor[r]).length, 0);
                if(n == 1 && m == 1){
                    allResults.uniqe++;
                }else{
                    allResults.ambiq++;
                }
            }else{
                allResults.nomat++;
            }

            if(allMatchByIdP[entityID]){
                let rors = Object.entries(allMatchByIdP[entityID]);
                let maxScore = rors.reduce((p, r) => Math.max(p, r[1]), 0);
                let maxScoreRors = rors.filter(r => r[1] == maxScore);

                let n = maxScoreRors.length;
                let m = maxScoreRors.reduce((p, r) => p + Object.entries(allMatchByRor[r[0]]).filter(e => e[1] >= maxScore).length, 0);
                if(n == 1 && m == 1){
                    scoreResults.uniqe++;
                }else{
                    scoreResults.ambiq++;
                }
            }else{
                scoreResults.nomat++;
            }
        }

        logger.verbose(`Results`);
        logger.verbose(`step\tuniqe\tnomat\tambiq`);
        logger.verbose(`name\t${nameResults.uniqe}\t${nameResults.nomat}\t${nameResults.ambiq}`);
        logger.verbose(`url\t${urlResults.uniqe}\t${urlResults.nomat}\t${urlResults.ambiq}`);
        logger.verbose(`wikidata\t${wikidataResults.uniqe}\t${wikidataResults.nomat}\t${wikidataResults.ambiq}`);
        logger.verbose(`all\t${allResults.uniqe}\t${allResults.nomat}\t${allResults.ambiq}`);
        logger.verbose(`scores\t${scoreResults.uniqe}\t${scoreResults.nomat}\t${scoreResults.ambiq}`);

        logger.verbose(`Writing results to files...`);
        await fs.mkdir(path.resolve(options.outDir), { recursive: true });
        await fs.writeFile(path.resolve(options.outDir, 'results-name.json'), JSON.stringify(nameMatchByIdP, null, '  '));
        await fs.writeFile(path.resolve(options.outDir, 'results-url.json'), JSON.stringify(urlMatchByIdP, null, '  '));
        await fs.writeFile(path.resolve(options.outDir, 'results-wikidata.json'), JSON.stringify(wikidataMatchByIdP, null, '  '));
        await fs.writeFile(path.resolve(options.outDir, 'results-scores.json'), JSON.stringify(allMatchByIdP, null, '  '));
        logger.verbose(`done.`);
    }
}

function getBestText(textnode: { text: string, lang: string } | { text: string, lang: string }[]) {
    textnode = [textnode].flat() as { text: string, lang: string }[];

    return textnode.filter(n => n.lang == "en")[0] ||
        textnode[0];
}


async function drawHeatmap(data:{x:string, y:string, v:number}[], outPath:string){
    const xRange = Object.keys(data.reduce((o,d) => { o[d.x] = 1; return o; }, {} as any));
    const yRange = Object.keys(data.reduce((o,d) => { o[d.y] = 1; return o; }, {} as any));

    const minValue = data.reduce((o,d) => d.v < o ? d.v : o , Infinity);
    const maxValue = data.reduce((o,d) => d.v > o ? d.v : o , -Infinity);

    const width = 512;
    const height = 512;

    const fakeDom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

    const document = d3.select(fakeDom.window.document);
    const body = document.select('body');

    // Make an SVG Container
    const svg = body.append('div').attr('class', 'container')
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // Build X scales and axis:
    const x = d3.scaleBand()
        .range([0, width])
        .domain(xRange)
        .padding(0.01);
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))

    // Build X scales and axis:
    const y = d3.scaleBand()
        .range([height, 0])
        .domain(yRange)
        .padding(0.01);
    svg.append("g")
        .call(d3.axisLeft(y));

    // Build color scale
    var myColor = d3.scaleLinear()
        .range(["white", "#69b3a2"] as any[])
        .domain([minValue, maxValue]);

    //Read the data
    svg.selectAll()
        .data(data, (d) => { return d?.x + ':' + d?.y; })
        .enter()
        .append("rect")
        .attr("x", (d,i) => { return x(""+d.x) || 0 })
        .attr("y", (d) => { return y(""+d.y) || 0 })
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .style("fill", (d) => { return myColor(d.v) })

    // Output the result to file
    await fs.writeFile(outPath, body.select('.container').html());
}