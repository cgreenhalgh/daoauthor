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

export interface Row {
  [propName:string]: string
}
// generic spreadsheet sheet type
export interface Sheet {
  headings: string[]
  rows: Row[]
}

// read generic representation of sheet
export function readSheet(sheet:any): Sheet {
  let headings:string[] = []
  let prefix = ''
  for (let c=0; true; c++) {
    let cell = sheet[cellid(c,0)]
    if (!cell)
      break
    let heading = String(cell.v).trim()
    // heading with ':' makes that a prefix added to subsequent column names
    let ix = heading.indexOf(':')
    if (ix>=0) {
      prefix = heading.substring(0, ix)
      let suffix = heading.substring(ix+1)
      if (prefix.length>0 && suffix.length>0) {
        headings.push(prefix+'_'+suffix)
      } else {
        headings.push(prefix+suffix)
      }
    } else if (prefix.length>0) {
      headings.push(prefix+'_'+heading)
    } else {
      headings.push(heading)
    }
    //console.log(`Found heading ${cell.v} at column ${c}, ${cellid(c,0)}`)
  }
  let rows:Row[] = []
  for (let r=1; true; r++) {
    let row:Row = {}
    let empty = true
    for (let c=0; c<headings.length; c++) {
      let cell = sheet[cellid(c,r)]
      if (cell) {
        let value = String(cell.v).trim()
        if (value.length>0) {
          row[headings[c]] = value
          empty = false
        }
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
  onexitenable:string[]
  onexitdisable:string[]
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
  for (let ri=0; ri<sheet.rows.length; ri++) {
    let row = sheet.rows[ri]
    //console.log(row)
    let id = row['region']
    if (!id) {
      console.log(`Warning: missing "region" name at row ${ri+2}`)
      id = "_R"+(ri+2)
    }
    if (!row['theme']) {
      console.log(`Error: region "${row.region}" missing "theme" at row ${ri+2}`)
      //continue;
    }
    if (!row['level']) {
      console.log(`Error: region "${row.region}" missing "level" at row ${ri+2}`)
      //continue;
    }
    if (row['waypoint'] && !row['rangemetres']) {
      console.log(`Error: region "${row.region}" has waypoint "${row.waypoint}" but no "rangemetres" at row ${ri+2}`)
    }
    regions.push({
      region: id,
      group: row['group'],
      gps: 'n'!=row['gps'],
      routes: splitList(row['routes']),
      waypoint: row['waypoint'],
      rangemetres: row['rangemetres'] ? Number(row['rangemetres']) : 0,
      description: row['description'],
      priority: row['priority'] ? Number(row['priority']) : 0,
      enabledatstart: 'n'!=row['enabledatstart'],
      neighbours: splitList(row['neighbours']),
      enable: splitList(row['enable']),
      disable: splitList(row['disable']),
      onexitenable: splitList(row['onexitenable']),
      onexitdisable: splitList(row['onexitdisable']),
      theme: row['theme'],
      level: row['level'],
      oneshot: row['oneshot'] ? row['oneshot'] : null
      })
  }
  return regions
}

export interface Theme {
  id: string
  description?: string
  tempo: number
  levels: Level[]
}
export interface Level {
  theme: Theme
  id: string
  description?: string
  nextlevel: string[]
  beats?: number
  seconds: number
  minbeats?: number
  minseconds?: number
  endeverybeats?: number
  endbeats: number[]
  tracks: Track[]
}
export enum TrackType {
  Sequence = 0,
  Oneshot,
  //Random,
  Shuffle
}
export interface Track {
  level: Level
  id: string
  description?: string
  tracktype: TrackType
  files: TrackFile[]
}

export interface TrackFile {
  file: string
  beats?: number
  seconds: number
  delaybeats?: number
  delayseconds: number
  volume1: number
  fadebeats?: number
  fadeseconds?: number
  volume2?: number
}

const SAMPLE_RATE = 44100
const SMALL_TIME = 0.5/SAMPLE_RATE

export function readThemes(workbook:any) : Theme[] {
  let s = workbook.Sheets['themes']
  if (!s) {
    throw new Error('no "themes" sheet in workbook')
  }
  let sheet = readSheet(s)
  let themes: Theme[] = []
  let theme: Theme = null
  let level: Level = null
  let track: Track = null
  for (let row of sheet.rows) {
    //console.log(row)
    if (row['theme']) {
      if (!row['theme_tempo']) 
        console.log(`Error: theme "${row.theme}" has no "tempo"`)
      theme = {
        id: row['theme'].toLowerCase(),
        description: row['theme'],
        tempo: row['theme_tempo'] ? Number(row['theme_tempo']) : 120,
        levels: []
      }
      for (let t of themes) {
        if (t.id == theme.id) {
          console.log(`Error: duplicate theme "${theme.id}"`)      
        }
      }
      themes.push(theme)
      level = null
      track = null
    } // theme
    if (row['level']) {
      if (!theme){
        console.log(`Error: level "${row.level}" found before any theme`)
        continue
      }
      if (!row['level_beats'] && !row['level_seconds']) {
        console.log(`Error: theme "${theme.id}" level "${row.level}" has no length "beats" or "seconds" specified`)
      }
      let minbeats = row['level_minbeats'] ? Number(row['level_minbeats']) : null
      level = {
        theme: theme,
        id: row['level'].toLowerCase(),
        description: row['level_description'],
        nextlevel: splitList(row['level_nextlevel']),
        beats: row['level_beats'] ? Number(row['level_beats']) : null,
        seconds: row['level_seconds'] ? Number(row['level_seconds']) : Number(row['level_beats'])*60/theme.tempo,
        minbeats: minbeats,
        minseconds: row['level_minseconds'] ? Number(row['level_minseconds']) : (minbeats ? minbeats*60/theme.tempo : null),
        endeverybeats: row['level_endeverybeats'] ? Number(row['level_endeverybeats']) : null,
        endbeats: splitList(row['level_endeverybeats']).map((b) => Number(b)),
        tracks: []
      }
      if (level.nextlevel.length==0) {
        console.log(`Warning: theme ${theme.id} level ${row.level} has no next level (default to loop)`)
        level.nextlevel.push(level.id)
      }
      // always end
      level.endbeats.push(level.seconds)
      if (level.endeverybeats) {
        for (let i=1; i*level.endeverybeats*60/theme.tempo <=level.seconds + SMALL_TIME; i++) {
          let found = false
          let beat = i*level.endeverybeats
          for (let b of level.endbeats) {
            if (Math.abs(b-beat)<SMALL_TIME) {
              found = true
              break
            }
          }
          if (!found) {
            level.endbeats.push(beat)
          }
        }
      } 
      if (level.minseconds!==null) {
        if (row['level_endeverybeats'] || row['level_endeverybeats']) {
          // filter
          level.endbeats = level.endbeats.filter((t) => { return t>=level.minseconds-SMALL_TIME; })
          level.minseconds = null
        } else {
          if (level.seconds < level.minseconds) {
            console.log(`Warning: theme ${theme.id} level ${level.id} min time was greater than duration (${level.minseconds} vs ${level.seconds})`)
            level.minseconds = level.seconds
          }
        }
      }
      level.endbeats.sort((a,b) => { return a-b; })
      //console.log(`${theme.id} ${level.id} endeverybeats ${level.endeverybeats} -> endbeats`, level.endbeats)
      for (let l of theme.levels) {
        if (l.id == level.id) {
          console.log(`Error: duplicate level "${level.id}" in theme ${theme.id}`)
        }
      }
      theme.levels.push(level)
      track = null
    } // level
    if (row['track']) {
      if (!level) {
        console.log(`Error: track "${row.track}" found before level in theme ${theme.id}`)
        continue
      }
      let tracktype = TrackType.Sequence
      let ttname = row['track_type'] ? row['track_type'].toLowerCase() : 'sequence'
      if ('sequence'==ttname)
        tracktype = TrackType.Sequence
      else if ('oneshot'==ttname)
        tracktype = TrackType.Oneshot
      else if ('random'==ttname) {
        //console.log(`Note: track type "random" treated as "shuffle" in track "${row.track}" in theme ${theme.id} level ${level.id}`)
        tracktype = TrackType.Shuffle
      } else if ('shuffle'==ttname)
        tracktype = TrackType.Shuffle
      else {
        console.log(`Error: track "${row.track}" in theme ${theme.id} level ${level.id} has unknown "type": "${row.track_type}"`)
        tracktype = TrackType.Sequence
      }
      track = {
        level: level,
        id: row['track'].toLowerCase(),
        description: row['track_description'],
        tracktype: tracktype,
        files: []
      }
      for (let t of level.tracks) {
        if (t.id == track.id) {
          console.log(`Error: duplicate track "${track.id}" in theme ${theme.id} level ${level.id}`)
        }
      }
      level.tracks.push(track)
    }// track
    for (let i=1, prefix='file'+i; row[prefix]; i++, prefix='file'+i) {
      //console.log('file '+prefix)
      if (!track) {
        console.log(`Error: file ${i} found before track in theme ${theme.id} level ${level.id}`)
        continue
      }
      // should this use level.seconds?!
      let beats = row[prefix+'_beats'] ? Number(row[prefix+'_beats']) : level.beats
      let delaybeats = row[prefix+'_delaybeats'] ? Number(row[prefix+'_delaybeats']) : 0
      let fadebeats = row[prefix+'_fadebeats'] ? Number(row[prefix+'_fadebeats']) : null
      let file : TrackFile = {
        file: row[prefix],
        beats: beats,
        seconds: row[prefix+'_seconds'] ? Number(row[prefix+'_seconds']) : (beats ? beats*60/theme.tempo : level.seconds),
        delaybeats: delaybeats,
        delayseconds: row[prefix+'_delayseconds'] ? Number(row[prefix+'_delayseconds']) : delaybeats*60/theme.tempo,
        // could be 0!
        volume1: row[prefix+'_volume1']!==null && row[prefix+'_volume1']!==undefined && row[prefix+'_volume1']!='' ? Number(row[prefix+'_volume1']) : 1,
        fadebeats: fadebeats,
        // could be 0!
        fadeseconds: row[prefix+'_fadeseconds']!==null && row[prefix+'_fadeseconds']!==undefined && row[prefix+'_fadeseconds']!='' ? Number(row[prefix+'_fadeseconds']) : (fadebeats ? fadebeats*60/theme.tempo : null),
        // could be 0!
        volume2: row[prefix+'_volume2']!==null &&  row[prefix+'_volume2']!==undefined && row[prefix+'_volume2']!='' ? Number(row[prefix+'_volume2']) : null
      }
      track.files.push(file)
    } // file
  } // row
  // check nextlevels
  for(let theme of themes) {
    for (let level of theme.levels) {
      for (let nextlevel of level.nextlevel) {
        let l = theme.levels.find((l2) => {return l2.id==nextlevel;})
        if (!l)
          console.log(`Error: theme ${theme.id} level ${level.id} has unknown nextlevel ${nextlevel}`)
      }
    }
  }
  return themes
}


export interface Transition {
  fromtheme?: string
  fadeoutseconds: number
}
const SHORT_FADE_TIME = 0.003

// read settings in particular from sheet 'settings'
export function readTransitions(workbook:any): Transition[] {
  let s = workbook.Sheets['transitions']
  if ( !s) 
    throw new Error(`no "transitions" sheet in workbook`)
  let sheet = readSheet(s)
  let transitions: Transition[] = []
  for (let row of sheet.rows) {
    let transition : Transition = {
      fromtheme: row["fromtheme"],
      fadeoutseconds: row["fadeoutseconds"] ? Number(row["fadeoutseconds"]) : SHORT_FADE_TIME
    }
    transitions.push(transition)
  }
  return transitions
}
