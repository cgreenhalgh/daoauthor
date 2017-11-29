import * as xlsx from 'xlsx'

const TOOL = "daoauthor-1"

if (process.argv.length!=3) {
  console.log('Usage: node ... EXCELFILE')
  process.exit(-1)
}
let excelfile = process.argv[2]
console.log(`read ${ excelfile }`)

// excel cell name from column,row (start from 0)
function cellid(c:number,r:number): string {
  let p = String(r+1)
  let rec = (c) => {
    p = String.fromCharCode( ('A'.charCodeAt(0))+(c % 26) ) + p
    c = Math.floor (c/26)
    if (c!=0)
      rec( c-1 )
  }
  rec( c )
  return p 
}

// generic spreadsheet sheet type
interface Sheet {
  headings: string[]
  rows: any[]
}

// read generic representation of sheet
function readSheet(sheet:any): Sheet {
  let headings:string[] = []
  for (let c=0; true; c++) {
    let cell = sheet[cellid(c,0)]
    if (!cell)
      break
    headings.push(cell.v)
    //console.log(`Found heading ${cell.v} at column ${c}, ${cellid(c,0)}`)
  }
  let rows:any[] = []
  for (let r=1; true; r++) {
    let row = {}
    let empty = true
    for (let c=0; c<headings.length; c++) {
      let cell = sheet[cellid(c,r)]
      if (cell) {
        row[headings[c]] = cell.v
        empty = false
      }
    }
    if (empty)
      break
    rows.push(row)
  }
  return { headings: headings, rows: rows}
}

// settings sheet values
interface Settings {
  tool?: string
  title?: string
  description?: string
  author?: string
  version?: string
}

// read settings in particular from sheet 'settings'
function readSettings(workbook:any): Settings {
  let s = workbook.Sheets['settings']
  if ( !s) 
    throw new Error(`no "settings" sheet in workbook ${excelfile}`)
  let sheet = readSheet(s)
  let settings: Settings = {}
  for (let row of sheet.rows) {
    if (row.value)
      settings[row.setting] = row.value
  }
  return settings
}



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
} catch (err) {
  console.log(`Error: ${ err.message }`)
}
