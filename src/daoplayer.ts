// daoplayer-specific stuff
import { Settings, Region, Theme, Level, LevelFile } from './sheet'


export interface DaoMeta {
  mimetype:string
  version:number
  title?:string
  description?:string
  artist?:string
}
export interface DaoTrack {
  name: string
  pauseIfSilent?: boolean // default false
  files: DaoFileRef[]
  sections?: DaoSection[]
  unitTime?: number
  maxDuration?: number
  defaultNextSectionCost?: number
  defaultEndCost?: number
  title?: string
  description?: string
}
export interface DaoTrackRef {
  name: string
  volume: any // default 1, number or string (code)
  pos: any // default current, number or string (code) evaluating to array of sceneTime,trackPos values
  // prepare?: boolean // unused
  update?: boolean // default true
}
export interface DaoFileRef {
  path: string
  trackPos?: number // default 0
  filePos?: number // default 0
  length?: number // default -1 => all
  repeats?: number // default 1
}
export interface DaoSection {
  name:string
  trackPos?: number // default 0
  length?: number // default next section; -1 => end of track
  // startCost?: number
  // endCost?: number
  // endCostExtra?: number
  // next?: {name,cosst}[]
  title?: string
  description?: string 
}
export interface DaoVars {
  [propName:string]: any
}
export interface DaoNameMap {
  [propName:string]: string
}
export interface DaoScene {
  name:string
  partial:boolean
  tracks?:DaoTrackRef[]
  constants?:DaoVars
  vars?:DaoVars
  onload?:string
  onupdate?:string
  updatePeriod?:number
  waypoints?:DaoNameMap
  routes?:DaoNameMap
  title?:string
  description?:string
  artist?:string
}
export interface Daoplayer {
  meta:DaoMeta
  merge?:string[]
  defaultScene?:string
  tracks?:DaoTrack[]
  scenes?:DaoScene[]
}

const DEFAULT_SCENE = "_init"

export function init(settings:Settings): Daoplayer {
  let dp: Daoplayer = {
    meta: {
      mimetype: 'application/x-daoplayer-composition',
      version: 1,
      title: settings.title,
      description: settings.description,
      artist: settings.author
    },
    merge: [],
    defaultScene: DEFAULT_SCENE,
    tracks: [],
    scenes: []
  }
  if (settings.contextfile)
    dp.merge.push(settings.contextfile)
  else 
    console.log('Warning: no contextfile specified in settings')
  return dp
}

function getRegion(regions: Region[], id: string): Region {
  for (let region of regions)
    if (id==region.region)
      return region
  return null
}

const VAR_ENABLED = "window.ren"

interface RegionCheck {
  route?: string
  waypoint?: string
  rangemetres: number
  priority: number
  toRegion: string
  self: boolean
  gps: boolean
}

const debug = true

// return javascript of transition check to add to onload/onupdate
function transitionCheck(region: Region, scene: DaoScene, regions: Region[]): string {
  // go to the scene which is enabled, highest priority 
  // for now waypoints will go before routes of same priority as they are not considered in nearest
  let checks:RegionCheck[] = []
  if (region) {
    // add region's own waypoint and/or route
    if (region.waypoint)
      checks.push({ waypoint: region.waypoint, rangemetres: region.rangemetres, self:true, toRegion: region.region, priority: region.priority, gps:true })
    for (let route of region.routes)
      checks.push({ route: route, rangemetres: 0, self:true, toRegion: region.region, priority: region.priority, gps:true })
    // rest of group
    if (region.group) {
      for (let r of regions) {
        if (region.group==r.group && region!==r) {
          if (r.waypoint)
            checks.push({ waypoint: r.waypoint, rangemetres: r.rangemetres, self:false, toRegion: r.region, priority: r.priority, gps:true })
          for (let route of r.routes)
            checks.push({ route: route, rangemetres: 0, self:false, toRegion: r.region, priority: r.priority, gps:true })
        }
      }
    }
    // neighbours
    for (let neighbour of region.neighbours) {
      let nregion = getRegion(regions, neighbour)
      if (!nregion) {
        console.log(`Error: region ${region.region} has unknown neighbour ${neighbour}`)
        continue
      }
      if (nregion.waypoint)
        checks.push({ waypoint: nregion.waypoint, rangemetres: nregion.rangemetres, self:false, toRegion: nregion.region, priority: nregion.priority, gps:true })
      for (let route of nregion.routes)
        checks.push({ route: route, rangemetres: 0, self:false, toRegion: nregion.region, priority: nregion.priority, gps:true })
    }
  }
  // add all?
  if (!region || (!region.waypoint && region.routes.length==0 && region.neighbours.length==0)) {
    for (let r of regions) {
      if (r.waypoint)
        checks.push({ waypoint: r.waypoint, rangemetres: r.rangemetres, self:false, toRegion: r.region, priority: r.priority, gps:true })
      for (let route of r.routes)
        checks.push({ route: route, rangemetres: 0, self:false, toRegion: r.region, priority: r.priority, gps:true })
    }
  }
  // wildcards
  for (let r of regions) {
    if (!r.waypoint && r.routes.length==0) {
      checks.push({ rangemetres:0, self: region==r, toRegion: r.region, priority: r.priority, gps: r.gps })
    }
  }
  // sort GPS / priority / waypoint>route / (region)
  checks.sort((a,b) => {
    if (a.gps!=b.gps) return a.gps ? -1 : 1
    if (a.priority!=b.priority) return a.priority>b.priority ? -1 : 1
    if (a.waypoint && !b.waypoint) return -1
    if (b.waypoint && !a.waypoint) return 1
    return a.toRegion.localeCompare(b.toRegion)
  })
  let code = ''
  for (let check of checks) {
    code = code+'if ('+VAR_ENABLED+'['+JSON.stringify(check.toRegion)+'] && '
    if (check.waypoint) {
      scene.waypoints[check.waypoint] = check.waypoint
      code = code+'waypoints['+JSON.stringify(check.waypoint)+']!==undefined && waypoints['+JSON.stringify(check.waypoint)+']<'+check.rangemetres
    } else if (check.route) {
      scene.routes[check.route] = check.route
      code = code+'routes['+JSON.stringify(check.route)+'].nearest'
    } else if (check.gps) {
      code = code+'activity!==null && activity!="NOGPS"'
    } else {
      code = code+'(activity===null || activity=="NOGPS")'
    }
    code = code+') { '
    if (!check.self) {
      code = code+'daoplayer.setScene('+JSON.stringify(check.toRegion)+')'
    } else {
      code = code+'/*self*/'
    }
    code = code+';} else '
  }
  code = code+'{}; '
  return code
}

export function addRegions(dp: Daoplayer, regions: Region[]) {
  // add init region
  let initscene:DaoScene = {
    name: DEFAULT_SCENE,
    partial: false,
    title: 'Initialisation scene',
    waypoints: {},
    routes: {}
  }
  initscene.onload = VAR_ENABLED+'={}; '
  for (let region of regions) {
    // init enabled?
    initscene.onload = initscene.onload + VAR_ENABLED+'['+JSON.stringify(region.region)+']='+region.enabledatstart+'; '
  }
  initscene.onload = initscene.onload + transitionCheck(null, initscene, regions)
  // scenes enabled?
  dp.scenes.push(initscene)
  for (let region of regions) {
    let scene:DaoScene = {
      name: region.region+':default',
      partial: false,
      tracks: [],
      title: `Default scene for region ${region.region}`,
      updatePeriod: 1.0,
      waypoints: {},
      routes: {},
      onload: "",
      onupdate: ""
    }
    if (debug)
      scene.onload = scene.onload+'daoplayer.speak('+JSON.stringify('region '+region.region)+', true); '
    // on load, enable/disable
    for (let rname of region.enable)
      scene.onload = scene.onload + VAR_ENABLED+'['+JSON.stringify(rname)+']=true; '
    for (let rname of region.disable)
        scene.onload = scene.onload + VAR_ENABLED+'['+JSON.stringify(rname)+']=false; '
    // transition check
    scene.onupdate = scene.onupdate + transitionCheck(region, scene, regions)
    dp.scenes.push(scene)
  }
}

function addTheme(dp: Daoplayer, theme: Theme) {
  // theme -> track (more than one if concurrent files)
  let tracks : DaoTrack[] = []
  let track: DaoTrack = {
    name: theme.id+':0',
    files: [],
    sections: [],
    title: 'Theme '+theme.id+' track 0'
  }
  tracks.push(track)
  let secondsPerBeat = 60.0 / theme.tempo
  // level -> section
  let trackPos = 0
  for (let level of theme.levels) {
    let length = level.beats*secondsPerBeat
    let section : DaoSection = {
      name: level.id,
      title: 'Theme '+theme.id+' level '+level.id,
      description: level.description,
      trackPos: trackPos,
      length: length
    }
    tracks[0].sections.push(section)
    // files
    for (let i=0; i<level.files.length; i++) {
      let file = level.files[i]
      if (i>=tracks.length) {
        track = {
          name: theme.id+':'+i,
          files: [],
          sections: [],
          title: 'Theme '+theme.id+' track '+i
        }
        tracks.push(track)
      }
      track = tracks[i]
      let fileRef:DaoFileRef = {
        path: file.file,
        trackPos: trackPos,
        filePos: 0,
        length: length,
        repeats: 1
      }
      track.files.push(fileRef)
    }
    // no gap?!
    trackPos += length
  }
  //for (let i=1; i<tracks.length; i++) 
  // no clone?!
  //tracks[i].sections = tracks[0].sections
  for (let track of tracks)
    dp.tracks.push(track)
}

export function addThemes(dp: Daoplayer, themes: Theme[]) {
  // each theme becomes a set of tracks...
  for (let theme of themes)
    addTheme(dp, theme)
}