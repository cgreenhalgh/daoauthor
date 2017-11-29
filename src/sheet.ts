// spreadsheet handling
//import * as xlsx from 'xlsx'

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
export interface Sheet {
  headings: string[]
  rows: any[]
}

// read generic representation of sheet
export function readSheet(sheet:any): Sheet {
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
export interface Settings {
  tool?: string
  title?: string
  description?: string
  author?: string
  version?: string
  outfile?: string
  contextfile?: string
}

// read settings in particular from sheet 'settings'
export function readSettings(workbook:any): Settings {
  let s = workbook.Sheets['settings']
  if ( !s) 
    throw new Error(`no "settings" sheet in workbook`)
  let sheet = readSheet(s)
  let settings: Settings = {}
  for (let row of sheet.rows) {
    if (row.value)
      settings[row.setting] = row.value
  }
  return settings
}

export interface Region {
  region:string
  group?:string
  gps:boolean
  routes:string[]
  waypoint?:string
  rangemetres:number
  description?:string
  priority:number
  enabledatstart:boolean
  neighbours:string[]
  enable:string[]
  disable:string[]
  theme:string
  level:string
  oneshot?:string
}

function splitList(l:string) :string[] {
  if (!l)
    return []
  let vs = l.split(',')
  let res = []
  for (let v of vs) {
    res.push(v.trim())
  }
  return res
}

// read regions
export function readRegions(workbook:any) : Region[] {
  // read regions
  let s = workbook.Sheets['regions']
  if (!s) {
    throw new Error('no "regions" sheet in workbook')
  }
  let sheet = readSheet(s)
  let regions: Region[] = []
  for (let row of sheet.rows) {
    if (!row['region']) {
      console.log(`Error: missing "region" name`)
      continue
    }
    if (!row['theme']) {
      console.log(`Error: region "${row.region}" missing "theme"`)
      continue;
    }
    if (!row['level']) {
      console.log(`Error: region "${row.region}" missing "level"`)
      continue;
    }
    regions.push({
      region: row['region'] as string,
      group: row['group'] as string,
      gps: 'n'!=row['gps'],
      routes: splitList(row['routes'] as string),
      waypoint: row['waypoint'] as string,
      rangemetres: row['rangemetres'] ? Number(row['rangemetres']) : 0,
      description: row['description'] as string,
      priority: row['priority'] ? Number(row['priority']) : 0,
      enabledatstart: 'n'!=row['enabledatstart'],
      neighbours: splitList(row['neighbours'] as string),
      enable: splitList(row['enable'] as string),
      disable: splitList(row['disable'] as string),
      theme: row['theme'] as string,
      level: row['level'] as string,
      oneshot: row['oneshot'] ? row['oneshot'] as string : null
      })
  }
  return regions
}