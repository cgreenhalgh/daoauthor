import * as xlsx from 'xlsx'
import * as fs from 'fs'
import { Sheet, readSheet, Settings, readSettings, Region, readRegions, Theme, readThemes } from './sheet'
import * as daoplayer from './daoplayer'

const TOOL = "daoauthor-1"

if (process.argv.length!=3) {
  console.log('Usage: node ... EXCELFILE')
  process.exit(-1)
}
let excelfile = process.argv[2]
console.log(`read ${ excelfile }`)

try {
  let workbook = xlsx.readFile(excelfile)

  let settings = readSettings(workbook)
  if (TOOL!=settings.tool) {
    console.log(`Spreadsheet settings tool is incompatible: expected ${TOOL}, found ${settings.tool}`)
    process.exit(-1)
  }
  let title = settings.title
  let version = settings.version
  console.log(`read "${title}" version ${version}`)
  
  let dp = daoplayer.init(settings)
  
  let regions = readRegions(workbook)
  console.log(`read ${regions.length} regions`)
  daoplayer.addRegions(dp, regions)
  
  let themes = readThemes(workbook)
  console.log(`read ${themes.length} themes`)
  daoplayer.addThemes(dp, themes)
  
  if (settings.outfile) {
    console.log(`write daoplayer file ${settings.outfile}`)
    fs.writeFileSync( settings.outfile, JSON.stringify( dp, null, '  '), {encoding: 'utf8'} )
  }
} catch (err) {
  console.log(`Error: ${ err.message }`)
}
