// daoplayer-specific stuff
import { Settings, Region, Theme, Level, Track, TrackType, TrackFile } from './sheet'

// daoplayer JSON file format
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
const VAR_ENABLED = "window.ren"

// info about a region check
interface RegionCheck {
  route?: string
  waypoint?: string
  rangemetres: number
  priority: number
  toRegion: string
  self: boolean
  gps: boolean
}

// info about a track in construction
interface TrackInfo {
  track: DaoTrack
  nextTrackPos?: number
}

interface TrackInfoMap {
  [propName:string]: TrackInfo
}

// info about a level permutation
interface LevelPermutation {
  // track name -> sequence of files
  [propName:string]: TrackFile[]
}

const debug = true
const output_speak_scene = false

const SECTION_GAP = 1

const SAMPLE_RATE = 44100
const SMALL_TIME = 0.5/SAMPLE_RATE

function getRegion(regions: Region[], id: string): Region {
  for (let region of regions)
    if (id==region.region)
      return region
  return null
}


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
      code = code+'waypoints['+JSON.stringify(check.waypoint)+'].distance!==undefined && waypoints['+JSON.stringify(check.waypoint)+'].distance<'+check.rangemetres
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

export class DaoplayerGenerator {

  dp: Daoplayer
  tracks: TrackInfoMap = {}
  
  init(settings:Settings) {
    this.dp = {
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
    if (settings.contextfile) {
      this.dp.merge.push(settings.contextfile)
    } else {
        console.log('Warning: no contextfile specified in settings')
    }
  }

  addRegions(regions: Region[]) {
    // add init region
    let initscene:DaoScene = {
        name: DEFAULT_SCENE,
        partial: false,
        title: 'Initialisation scene',
        waypoints: {},
        routes: {},
        updatePeriod: 1.0
    }
    initscene.onload = VAR_ENABLED+'={}; '
    for (let region of regions) {
      // init enabled?
      initscene.onload = initscene.onload + VAR_ENABLED+'['+JSON.stringify(region.region)+']='+region.enabledatstart+'; '
    }
    initscene.onload = initscene.onload + transitionCheck(null, initscene, regions)
    initscene.onupdate = transitionCheck(null, initscene, regions)
    // scenes enabled?
    this.dp.scenes.push(initscene)
    for (let region of regions) {
      let scene:DaoScene = {
          name: region.region,
          partial: false,
          tracks: [],
          title: `Default scene for region ${region.region}`,
          updatePeriod: 1.0,
          waypoints: {},
          routes: {},
          onload: "",
          onupdate: ""
      }
      if (output_speak_scene) {
        scene.onload = scene.onload+'daoplayer.speak('+JSON.stringify('region '+region.region)+', true); '
      }
      // on load, enable/disable
      for (let rname of region.enable)
        scene.onload = scene.onload + VAR_ENABLED+'['+JSON.stringify(rname)+']=true; '
      for (let rname of region.disable)
        scene.onload = scene.onload + VAR_ENABLED+'['+JSON.stringify(rname)+']=false; '
      // transition check
      scene.onupdate = scene.onupdate + transitionCheck(region, scene, regions)
      this.dp.scenes.push(scene)
    }
  }

  // get permutations of N indexes 0..N-1
  getPermutations(n: number) : number[][] {
    let getPs = (i: number, ps: number[][]): number[][] => {
      let nps: number[][] = []
      for (let p of ps) {
        for (let j=0; j<=p.length; j++) {
          let np = p.slice()
          np.splice(j, 0, i)
          nps.push(np)
        }
      }
      return nps
    }
    if (n<1)
      return []
    let ps = [[0]]
    for (let i=1; i<n; i++) {
      ps = getPs(i, ps)
      //console.log(`getPs ${i} -> ${ps.length}`, ps)
    }
    return ps
  }
  
  addTheme(theme: Theme) {
    //console.log('add themes...')
    // theme -> track (more than one if concurrent files)
    let themeTracks : TrackInfoMap = {}
    // give every track a placeholder track for level/section holding
    let baseTrack: DaoTrack = {
        name: theme.id+':',
        files: [],
        sections: [],
        title: 'Theme '+theme.id+' track 0',
        unitTime: 0,
        maxDuration: 0
    }
    // level -> section
    let trackPos = 0
    let sections: DaoSection[] = baseTrack.sections
    for (let level of theme.levels) {
      // permutations... (single, empty)
      let permutations: LevelPermutation[] = [{}]
      // expand permutations for each track
      nexttrack:
      for (let track of level.tracks) {
        //console.log(`theme ${theme.id} level ${level.id} track ${track.id}, ${permutations.length} permutations so far`)
        let options: TrackFile[][] = []
        switch (track.tracktype) {
          case TrackType.Oneshot:
            // TODO
            console.log(`Warning: ignored oneshot track "${track.id}" in theme ${theme.id} level ${level.id} - not yet supported`)
            continue nexttrack
          case TrackType.Sequence:
            // all in order
            options = [track.files]
            break
          case TrackType.Shuffle:
            options = this.getPermutations(track.files.length).map((ixs) => ixs.map((ix) => track.files[ix]))
            //console.log(`shuffle ${track.files.length} files -> ${options.length} options`, options)
            break
        }
        if (options.length>0) {
          let newPermutations: LevelPermutation[] = []
          for (let permuation of permutations) {
            for (let option of options) {
              let np = { ...permuation }
              np[track.id] = option
              newPermutations.push(np)
            }
          }
          permutations = newPermutations
        }
      }
      if (permutations.length>1) {
        console.log(`got ${permutations.length} permutations for theme ${theme.id} level ${level.id}`)
      }
      // make tracks
      for (let track of level.tracks) {
        if (track.tracktype==TrackType.Oneshot) {
          continue
        }
        let trackName = theme.id+':'+track.id
        let trackInfo : TrackInfo = themeTracks[trackName]
        if (!trackInfo) {
          let daotrack : DaoTrack = {
              name: trackName,
              files: [],
              sections: [],
              title: 'Theme '+theme.id+' track '+track.id
          }
          trackInfo = { 
            track: daotrack
          }
          themeTracks[trackName] = trackInfo
        }
      }
      // track permutations
      for (let pi=0; pi<permutations.length; pi++) {
        let permutation = permutations[pi]
        let section : DaoSection = {
            name: level.id+':P'+pi,
            title: 'Theme '+theme.id+' level '+level.id+(permutations.length>1 ? ' permutation '+pi : ''),
            description: level.description,
            trackPos: trackPos,
            length: level.seconds
        }
        sections.push(section)
        for (let track of level.tracks) {
          if (track.tracktype==TrackType.Oneshot) {
            continue
          }
          let fileTrackPos = trackPos
          let trackName = theme.id+':'+track.id
          let trackInfo : TrackInfo = themeTracks[trackName]
          for (let file of permutation[track.id]) {
            fileTrackPos += file.delayseconds
            if ( fileTrackPos>= trackPos+level.seconds+SMALL_TIME) {
              console.log(`Warning: track ${track.id} file "${file.file}" starts after end of theme ${theme.id} level ${level.id}`)
              continue
            }
            let length = file.seconds
            if ( fileTrackPos+length > trackPos+level.seconds+SMALL_TIME ) {
              length = trackPos+level.seconds - fileTrackPos
              console.log(`Warning: track ${track.id} file "${file.file}" truncated at ${length}/${file.seconds} seconds by end of theme ${theme.id} level ${level.id}`)
            }
            let fileRef:DaoFileRef = {
                path: file.file,
                trackPos: fileTrackPos,
                filePos: 0,
                length: length,
                repeats: 1
            }
            trackInfo.track.files.push(fileRef)
            // TODO: volume1
            fileTrackPos += length
          } // file
        } // track
        // extra second for debug ?!
        trackPos += level.seconds+SECTION_GAP
      } // permutation
      // no gap?!
    }
    //for (let i=1; i<tracks.length; i++) 
    // no clone?!
    //tracks[i].sections = tracks[0].sections
    this.dp.tracks.push(baseTrack)
    for (let ti in themeTracks) {
      this.dp.tracks.push(themeTracks[ti].track)
    }
  }

  addThemes(themes: Theme[]) {
    // each theme becomes a set of tracks...
    for (let theme of themes)
      this.addTheme(theme)
  }
  
  getData(): Daoplayer {
    return this.dp
  }
}
