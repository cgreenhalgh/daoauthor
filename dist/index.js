"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const xlsx = require("xlsx");
const fs = require("fs");
const sheet_1 = require("./sheet");
const daoplayer_1 = require("./daoplayer");
const TOOL = "daoauthor-1";
if (process.argv.length != 3) {
    console.log('Usage: node ... EXCELFILE');
    process.exit(-1);
}
let excelfile = process.argv[2];
console.log(`read ${excelfile}`);
try {
    let workbook = xlsx.readFile(excelfile);
    let settings = sheet_1.readSettings(workbook);
    if (TOOL != settings.tool) {
        console.log(`Spreadsheet settings tool is incompatible: expected ${TOOL}, found ${settings.tool}`);
        process.exit(-1);
    }
    let title = settings.title;
    let version = settings.version;
    console.log(`read "${title}" version ${version}`);
    let daoplayer = new daoplayer_1.DaoplayerGenerator();
    daoplayer.init(settings);
    let themes = sheet_1.readThemes(workbook);
    console.log(`read ${themes.length} themes`);
    daoplayer.addThemes(themes);
    let regions = sheet_1.readRegions(workbook);
    console.log(`read ${regions.length} regions`);
    daoplayer.addRegions(regions);
    console.log(`added ${regions.length} regions`);
    if (settings.outfile) {
        console.log(`write daoplayer file ${settings.outfile}`);
        fs.writeFileSync(settings.outfile, JSON.stringify(daoplayer.getData(), null, '  '), { encoding: 'utf8' });
    }
}
catch (err) {
    console.log(`Error: ${err.message}`);
}
//# sourceMappingURL=index.js.map