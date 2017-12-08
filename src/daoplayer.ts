// daoplayer-specific stuff
import { Settings, Region, Theme, Level, Track, TrackType, TrackFile, Transition } from './sheet'

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

interface SectionMap {
  // key is level name
  [propName:string]: DaoSection[]
}

// info about a track in construction
interface TrackInfo {
  theme: Theme
  baseTrack: boolean
  daotrack: DaoTrack
  nextTrackPos?: number
  // key is level
  levelSections: SectionMap
}

interface TrackInfoMap {
  // key is trackname, i.e. theme or theme:N
  [propName:string]: TrackInfo
}

interface OneshotTrackInfo {
  name: string
  daotrack: DaoTrack
  nextTrackPos: number
  oneshotSections: OneshotSectionMap
}
interface OneshotSectionMap {
  // key is theme:level
  [propName:string]: DaoSection
}
interface OneshotTrackInfoMap {
  // key is trackname, i.e. track name
  [propName:string]: OneshotTrackInfo
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
const SHORT_FADE_TIME = 0.003
const END_SECTION = "_END"

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
    if (a.self!=b.self) return a.self ? -1 : 1
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

interface DpTransition {
  fade: number
}
interface TransitionMap {
  [propName:string]:DpTransition
}

export class DaoplayerGenerator {

  dp: Daoplayer
  tracks: TrackInfoMap = {}
  oneshotTracks: OneshotTrackInfoMap = {}
  themes: Theme[]
  themeTransitions: TransitionMap
  defaultTransition: DpTransition = {
    fade: SHORT_FADE_TIME
  }
  
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
    
  getTheme(id:string) : Theme {
    for (let theme of this.themes) {
      if (theme.id == id)
        return theme
    }
    return null
  }
  getLevel(theme:Theme, id:string) : Level {
    if (!theme)
      return null
    for (let level of theme.levels) {
      if (level.id == id)
        return level
    }
    return null
  }
  
  addTransitions(transitions: Transition[]) {
    this.themeTransitions = {}
    for (let t of transitions) {
      let transition:DpTransition = {
        fade: t.fadeoutseconds
      }
      if (!t.fromtheme)
        this.defaultTransition = transition
      else {
        this.themeTransitions[t.fromtheme] = transition
      }
    }
  }

  getTransition(fromtheme: string) : DpTransition {
    let transition = this.themeTransitions[fromtheme]
    if (transition===undefined)
      return this.defaultTransition
    return transition
  }
      
  addRegions(regions: Region[]) {
    // add init region
    let initscene:DaoScene = {
        name: DEFAULT_SCENE,
        partial: false,
        title: 'Initialisation scene',
        waypoints: {},
        routes: {},
        tracks: [],
        updatePeriod: 1.0
    }
    initscene.onload = VAR_ENABLED+'={}; '
    // init scene oneshot tracks are at _END
    for (let trackName in this.oneshotTracks) {
      let trackInfo = this.oneshotTracks[trackName]
      let trackRef : DaoTrackRef = {
          name: trackInfo.daotrack.name,
          volume: 0, 
          pos: "["+JSON.stringify(END_SECTION)+"]",
          update: false
      }
      initscene.tracks.push(trackRef)
    }
    for (let region of regions) {
      // init enabled?
      initscene.onload = initscene.onload + VAR_ENABLED+'['+JSON.stringify(region.region)+']='+region.enabledatstart+';\n'
    }
    // sections of themes - map theme -> map level -> array (permutations) of section names
    let sectionIndex = {}
    // section end point index - map theme -> map section -> array of section time of end points
    let endpointIndex = {}
    // section min end index, only when endpoint not applicable - map theme -> map section -> min time seconds (or undefined)
    let minendIndex = {}
    // next level(s) - map theme -> map section (for level) -> array of level ids
    let nextlevelIndex = {}
    for (let trackName in this.tracks) {
      let trackInfo = this.tracks[trackName]
      if (!trackInfo.baseTrack)
        continue
      sectionIndex[trackInfo.theme.id] = {}
      endpointIndex[trackInfo.theme.id] = {}
      minendIndex[trackInfo.theme.id] = {}
      nextlevelIndex[trackInfo.theme.id] = {}
      for (let levelId in trackInfo.levelSections) {
        let sections = trackInfo.levelSections[levelId]
        sectionIndex[trackInfo.theme.id][levelId] = []
        for (let section of sections) {
          sectionIndex[trackInfo.theme.id][levelId].push(section.name)
        }
      }
      // for now all permutations of a section have the same endpoints and same next level(s)
      // and the same volume profile
      for (let level of trackInfo.theme.levels) {
        let endpoints = level.endbeats.map((b) => { return b*60/trackInfo.theme.tempo; })
        // always start
        endpoints.splice(0,0,0.0)
        let nextlevels = level.nextlevel
        // set for sections
        for (let section of trackInfo.levelSections[level.id]) {
          endpointIndex[trackInfo.theme.id][section.name] = endpoints
          if (level.minseconds!==null && level.minseconds!==undefined)
            minendIndex[trackInfo.theme.id][section.name] = level.minseconds
          nextlevelIndex[trackInfo.theme.id][section.name] = nextlevels
        }
      }
    }
    initscene.onload = initscene.onload + "window.dpSectionIndex=" + JSON.stringify(sectionIndex) + ";\n"
    initscene.onload = initscene.onload + "window.dpEndpointIndex=" + JSON.stringify(endpointIndex) + ";\n"
    initscene.onload = initscene.onload + "window.dpMinendIndex=" + JSON.stringify(minendIndex) + ";\n"
    initscene.onload = initscene.onload + "window.dpNextlevelIndex=" + JSON.stringify(nextlevelIndex) + ";\n"
    // section volume index - map base track name (theme) or oneshot track name -> section name -> array of volume1, optionally: section time, volume2
    let volumeIndex = {}
    // map theme -> (regular) track names (theme:track)
    let themeTNames = {}
    for (let theme of this.themes) {
      themeTNames[theme.id] = []
      for (let level of theme.levels) {
        for (let track of level.tracks) {
          // which daotrack is this track of this level allocated to?
          var trackName:string
          if (track.tracktype==TrackType.Oneshot) {
            trackName = track.id
          } else {
            trackName = theme.id+':'+track.id
            if (themeTNames[theme.id].indexOf(trackName)<0)
              themeTNames[theme.id].push(trackName)
          }
          if (volumeIndex[trackName]===undefined)
            volumeIndex[trackName] = {}
          let sectionPos = 0
          let volumes=[]
          // each file volume
          for(let file of track.files) {
            sectionPos += file.delayseconds
            if (sectionPos >= level.seconds) {
              console.log(`Warning: theme ${theme.id} level ${level.id} file ${file.file} starts after end of level`)
              break
            }
            volumes.push(sectionPos)
            let volume = file.volume1
            volumes.push(volume)
            if (file.fadeseconds!==null && file.volume2!==null) {
              if (sectionPos+file.fadeseconds>level.seconds) {
                console.log(`Warning: theme ${theme.id} level ${level.id} track ${track.id} file ${file.file} has fade past end of level`)
                volumes.push(level.seconds-SHORT_FADE_TIME)
              } else if (file.fadeseconds>file.seconds) {
                console.log(`Warning: theme ${theme.id} level ${level.id} track ${track.id} file ${file.file} has fade longer than length (${file.fadeseconds} vs ${file.seconds})`)
                volumes.push(sectionPos+file.seconds)
              } else {
                volumes.push(sectionPos+file.fadeseconds)
              }
              volume = file.volume2
              volumes.push(volume)
            }
            sectionPos += file.seconds
            if (sectionPos> level.seconds) {
              sectionPos = level.seconds
            }
            // short fade at the end
            volumes.push(sectionPos-SHORT_FADE_TIME)
            volumes.push(volume)
            volumes.push(sectionPos)
            volumes.push(0)
          }
          if (track.tracktype==TrackType.Oneshot) {
            // one shot section name: theme.id+':'+level.id
            volumeIndex[trackName][theme.id+':'+level.id] = volumes
          } else if (track.tracktype==TrackType.Shuffle) {
            // regular track permutation section names: level.id+':P'+pi
            let ps = this.getPermutations(track.files.length)
            for (let pi in ps) {
              volumeIndex[trackName][level.id+':P'+pi] = volumes
            }
          } else {
            // sequence = level.id+'P0'
            volumeIndex[trackName][level.id+':P0'] = volumes
          }
        }
      }
    }
    initscene.onload = initscene.onload + "window.dpVolumeIndex=" + JSON.stringify(volumeIndex) + ";\n"
    initscene.onload = initscene.onload + "window.dpThemeTNames=" + JSON.stringify(themeTNames) + ";\n"
    // oneshot track names
    let oneshotTrackNames = []
    for (let trackName in this.oneshotTracks) {
      oneshotTrackNames.push(trackName)
    }
    initscene.onload = initscene.onload + "window.dpOneshotTNames=" + JSON.stringify(oneshotTrackNames) + ";\n"
    // oneshot index - map theme -> map level -> map track -> section name
    let oneshotIndex = {}
    for (let theme of this.themes) {
      oneshotIndex[theme.id] = {}
      for (let level of theme.levels) {
        oneshotIndex[theme.id][level.id] = {}
        for (let track of level.tracks) {
          if (track.tracktype!=TrackType.Oneshot)
            continue
          oneshotIndex[theme.id][level.id][track.id] = theme.id+':'+level.id
        }
      }
    }
    initscene.onload = initscene.onload + "window.dpOneshotIndex=" + JSON.stringify(oneshotIndex) + ";\n"
    // transitions - map theme -> { fade: s }
    let transitions = {}
    for (let theme of this.themes) {
      let transition = this.getTransition(theme.id)
      transitions[theme.id] = transition
    }
    initscene.onload = initscene.onload + "window.dpTransitions=" + JSON.stringify(transitions) + ";\n"
    // theme(s)
    initscene.onload = initscene.onload + 'window.dpTh=null;window.dpNextTh=null;window.dpNextThT=0;window.dpNew=false;\n'+
        "window.dpUpdateTheme=function(theme,level,ntps,ntvs,load,tps,tvs,tss,sceneTime,totalTime){"+
          "if(load){window.dpNew=true;}"+
          "if(window.dpNextThT<=totalTime){window.dpTh=window.dpNextTh;}\n"+
          "ntps[theme]=[];"+
          // base track volume
          "ntvs[theme]=[];"+
          // current track volume
          "for(var ti in window.dpThemeTNames[theme]) {"+
            "var tname=window.dpThemeTNames[theme][ti];"+
            "ntvs[tname]=[sceneTime,tvs[tname]];"+
          "}"+
          "var ntime=sceneTime;"+
          "if(theme!=window.dpTh){"+
            // change theme
            "daoplayer.log('switch to theme '+theme);window.dpNextTh=theme;window.dpNextThT=totalTime;"+
          "}else {"+
            // same theme - preserve 'current' section if any
            // Note: just relying on volume didn't work
            "if(tss[theme] && tvs[theme]>0 && tss[theme].startTime<sceneTime-"+SMALL_TIME+"){"+
              // is it "our" scene playing?
              "if(window.dpNew && tss[theme].name!="+JSON.stringify(END_SECTION)+" && tss[theme].name.substr(0,level.length+1)==level+':'){window.dpNew=false;}"+
              "ntps[theme].push(tss[theme].startTime);"+
              "ntps[theme].push(tss[theme].name);"+
              // mark theme section as playing
              "ntvs[theme].push(tss[theme].startTime);"+
              "ntvs[theme].push(1);"+
              "if(window.dpNew) {"+
                // quick change => first suitable end?
                "var eps=window.dpEndpointIndex[theme][tss[theme].name];var ep=null;"+
                "for (var i=0;i<eps.length;i++) if(eps[i]>=sceneTime+"+SHORT_FADE_TIME+"-tss[theme].startTime){ep=eps[i];break;}"+
                "var mine=window.dpMinendIndex[theme][tss[theme].name]; if (mine!==undefined){"+
                  "if(tss[theme].startTime+mine<sceneTime){ep=sceneTime-tss[theme].startTime;}else{ep=mine;}"+
                "}"+
                "ntime=(ep!==undefined) ? tss[theme].startTime+ep : tss[theme].endTime;"+
                "ntps[theme].push(ntime);"+
                "ntvs[theme].push(ntime);"+
              "} else {"+
                "ntime=tss[theme].endTime; ntps[theme].push(ntime); ntvs[theme].push(ntime);"+
              "}"+
              // volumes for current section/level
              "for(var ti in window.dpThemeTNames[theme]) {"+
                "var tname=window.dpThemeTNames[theme][ti];"+
                "var vs=window.dpVolumeIndex[tname][tss[theme].name];"+
                "if(vs) {"+
                  // include any before ntime (less a short fade) and hope it copes (it should)
                  // but we need to stop at/before ntime
                  "var i; for(i=0; i<vs.length && vs[i]+tss[theme].startTime<ntime+"+SMALL_TIME+"-"+SHORT_FADE_TIME+"; i+=2)"+
                   "{ntvs[tname].push(tss[theme].startTime+vs[i]);ntvs[tname].push(vs[i+1]);}"+
                  // interpolate last value e.g. if early end in fade
                  "if(i<vs.length && i>=2 && vs[i-2]!=vs[i]) {"+
                    "ntvs[tname].push(ntime-"+SHORT_FADE_TIME+");ntvs[tname].push(vs[i-1]+(vs[i+1]-vs[i-1])*(ntime-sceneTime)/(vs[i]-vs[i-2]));"+
                  "}"+
                  // v short fade
                  "ntvs[tname].push(ntime);ntvs[tname].push(0);"+
                "}else{"+
                  "ntvs[tname].push(sceneTime);ntvs[tname].push(0);"+
                  "ntvs[tname].push(ntime);ntvs[tname].push(0);"+
                "}"+
              "}"+
            "}"+
            //"daoplayer.log('ntps#1 '+JSON.stringify(ntps[theme]));"+
          "}"+
          // default start immediate
          "if(ntps[theme].length==0){ntime=sceneTime;ntps[theme].push(sceneTime);ntvs[theme].push(sceneTime);}"+
          // what section?
          "var sections; var nlevel; var nsection=null; if(window.dpNew || !tss[theme]) {"+
            // change to "our" scene... (or if we've lost where we are)
            "nlevel=level; sections=window.dpSectionIndex[theme][level];"+
          "} else {"+
            // line up the next scene... (this will keep changing but that's OK - it should fix when it has changed)
            "var nextlevels=window.dpNextlevelIndex[theme][tss[theme].name];"+
            "nlevel=nextlevels[Math.floor(Math.random()*nextlevels.length)];"+
            "sections=window.dpSectionIndex[theme][nlevel];"+
          "}"+
          "if(sections.length>0){nsection=sections[Math.floor(Math.random()*sections.length)];ntvs[theme].push(1);}"+
          "else{nsection="+JSON.stringify(END_SECTION)+";ntvs[theme].push(0);}"+
          "ntps[theme].push(nsection);"+
          // volumes for next layer tracks
          "for(var ti in window.dpThemeTNames[theme]) {"+
            "var tname=window.dpThemeTNames[theme][ti];"+
            "var vs=window.dpVolumeIndex[tname][nsection];"+
            "if(vs) {"+
              "var i; for(i=0; i<vs.length; i+=2)"+
              "{ntvs[tname].push(ntime+vs[i]);ntvs[tname].push(vs[i+1]);}"+
            "}else{"+
              "ntvs[tname].push(ntime);ntvs[tname].push(0);"+
            "}"+
          "}"+

          // each oneshot track
          "for(var ti=0;ti<window.dpOneshotTNames.length;ti++){"+
            "var tname=window.dpOneshotTNames[ti];"+
            "ntps[tname]=[];"+
            // initial volume
            "ntvs[tname]=[sceneTime,tvs[tname]];"+
            // TODO oneshot volumes
            "var endTime=sceneTime;"+
            // get 'current' section if any
            "if(tss[tname] && tss[tname].name!="+JSON.stringify(END_SECTION)+" && tss[tname].startTime<sceneTime-"+SMALL_TIME+"){"+
              "ntps[tname].push(tss[tname].startTime);"+
              "ntps[tname].push(tss[tname].name);"+
              "endTime=tss[tname].endTime;"+
              "var vs=window.dpVolumeIndex[tname][tss[tname].name];"+
              "if(vs) {"+
                // include any before ntime and hope it copes (it should)
                // but we need to stop at/before ntime
                "var i; for(i=0; i<vs.length && vs[i]+tss[tname].startTime<ntime+"+SMALL_TIME+"; i+=2)"+
                 "{ntvs[tname].push(tss[tname].startTime+vs[i]);ntvs[tname].push(vs[i+1]);}"+
                // interpolate last value e.g. if early end in fade
                "if(i<vs.length && i>=2 && vs[i-2]!=vs[i]) {"+
                  "ntvs[tname].push(ntime);ntvs[tname].push(vs[i-1]+(vs[i+1]-vs[i-1])*(ntime-sceneTime)/(vs[i]-vs[i-2]));"+
                "}"+
              "}else{"+
                "ntvs[tname].push(sceneTime);ntvs[tname].push(0);"+
                "ntvs[tname].push(ntime);ntvs[tname].push(0);"+
              "}"+
            "}"+
            // oneshot in next level?
            "if(window.dpOneshotIndex[theme][nlevel][tname]){"+
              // match time to theme/level - gap first?
              "if(endTime<ntime){ntps[tname].push(endTime);ntps[tname].push("+JSON.stringify(END_SECTION)+");}"+
              "ntps[tname].push(ntime);"+
              "ntps[tname].push(theme+':'+nlevel);"+
              // volumes for next layer oneshot track
              "var vs=window.dpVolumeIndex[tname][theme+':'+nlevel];"+
              "if(vs) {"+
                "var i; for(i=0; i<vs.length; i+=2)"+
                "{ntvs[tname].push(ntime+vs[i]);ntvs[tname].push(vs[i+1]);}"+
              "}else{"+
                "ntvs[tname].push(ntime);ntvs[tname].push(0);"+
              "}"+
            "} else {ntps[tname].push(endTime); ntvs[tname].push(endTime);}"+
            // then silence
            "ntps[tname].push("+JSON.stringify(END_SECTION)+");ntvs[tname].push(0);"+
          "}"+
       "};"
    
    initscene.onload = initscene.onload + "window.dpOxEn=[]; window.dpOxDis=[];\n"
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
      this.dp.scenes.push(scene)
      if (output_speak_scene) {
        scene.onload = scene.onload+'daoplayer.speak('+JSON.stringify('region '+region.region)+', true); '
      }
      // last scene enable/disable
      scene.onload = scene.onload + 
        "for(var i=0; i<window.dpOxEn.length; i++){"+VAR_ENABLED+"[window.dpOxEn[i]]=true;}"+
        "window.dpOxEn=[];"+
        "for(var i=0; i<window.dpOxDis.length; i++){"+VAR_ENABLED+"[window.dpOxDis[i]]=false;}"+
        "window.dpOxDis=[];"
      // on load, enable/disable
      for (let rname of region.enable)
        scene.onload = scene.onload + VAR_ENABLED+'['+JSON.stringify(rname)+']=true; '
      for (let rname of region.disable)
        scene.onload = scene.onload + VAR_ENABLED+'['+JSON.stringify(rname)+']=false; '
      for (let rname of region.onexitenable)
        scene.onload = scene.onload + "window.dpOxEn.push("+JSON.stringify(rname)+");"
      for (let rname of region.onexitdisable)
        scene.onload = scene.onload + "window.dpOxDis.push("+JSON.stringify(rname)+");"
      
      if (!region.theme || !region.level) {
        // give up!
        continue
      }
        
      // transition to theme/level
      // TODO oneshots
      if (region.theme && region.level) {
        let theme = this.getTheme(region.theme)
        let level = this.getLevel(theme, region.level)
        if (!theme) {
          console.log(`Error: region ${region.region} refers unknown theme "${region.theme}"`)
        } else if (!level) {
          console.log(`Error: region ${region.region} refers to unknown level "${region.level}" of theme ${region.theme}`)
        } else {
          let baseTrackInfo = this.tracks[this.getBaseTrackName(theme)]
          if (!baseTrackInfo) {
            console.log(`Internal error: could not find base track for theme ${theme.id}`)
            process.exit(-1)
          }
          let sections = baseTrackInfo.levelSections[level.id]
          if (!sections) {
            console.log(`Internal error: could not find levelSections for level ${level.id} in base track for theme ${theme.id}`)
            process.exit(-1)
          }
          if (sections.length==0) {
            console.log(`Internal error: no section(s) found for level ${level.id} in base track for theme ${theme.id}`)
            process.exit(-1)
          }
          for (let trackName in this.tracks) {
            let trackInfo = this.tracks[trackName]
            if (trackInfo.theme!==theme) {
              // diff theme - default to off/stop
              // configure other theme end
              let trackRef : DaoTrackRef = {
                name: trackInfo.daotrack.name,
                volume: "trackVolume>0 && sceneTime<window.dpTransitions["+JSON.stringify(trackInfo.theme.id)+"].fade ?"+
                  " [sceneTime,trackVolume,window.dpTransitions["+JSON.stringify(trackInfo.theme.id)+"].fade,0] : 0", 
                // TODO fix up null handling?!
                pos: null, //"sceneTime<window.dpTransitions["+JSON.stringify(trackInfo.theme.id)+"].fade ? [sceneTime,trackPos] : ["+JSON.stringify(END_SECTION)+"]", 
                update: true
              }
              scene.tracks.push(trackRef)
            } else {
              // same theme
              let trackRef : DaoTrackRef = {
                name: trackInfo.daotrack.name,
                volume: "ntvs['"+trackName+"']", 
                pos: "ntps['"+region.theme+"']", 
                update: true
              }
              scene.tracks.push(trackRef)
            }
          }
          // oneshot tracks - all handled in every scene
          for (let trackName in this.oneshotTracks) {
            let trackInfo = this.oneshotTracks[trackName]
            let trackRef : DaoTrackRef = {
                name: trackInfo.daotrack.name,
                volume: "ntvs['"+trackName+"']",
                pos: "ntps['"+trackName+"']", 
                update: true
            }
            scene.tracks.push(trackRef)
          }
        } // theme & level found
      } // theme & level set
      // ntps = new track positions
      scene.onload = scene.onload + "var ntps={}; var ntvs={}; window.dpUpdateTheme('"+region.theme+"','"+region.level+"',ntps,ntvs, true,tps,tvs,tss,sceneTime,totalTime);"
      scene.onupdate = scene.onupdate + "var ntps={}; var ntvs={}; window.dpUpdateTheme('"+region.theme+"','"+region.level+"',ntps,ntvs, false,tps,tvs,tss,sceneTime,totalTime);"
      
      // transition check
      scene.onupdate = scene.onupdate + transitionCheck(region, scene, regions)
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
  
  getBaseTrackName(theme: Theme) : string {
    return theme.id
  }
  addTheme(theme: Theme) {
    //console.log('add themes...')
    // theme -> track (more than one if concurrent files)
    // give every track a placeholder track for level/section holding
    let baseTrackName = this.getBaseTrackName(theme)
    let baseTrack: DaoTrack = {
        name: baseTrackName,
        files: [],
        sections: [],
        title: 'Theme '+theme.id+' track 0',
        unitTime: 0,
        maxDuration: 0,
        pauseIfSilent: true
    }
    this.dp.tracks.push(baseTrack)
    let baseTrackInfo = {
      theme: theme,
      baseTrack: true,
      daotrack: baseTrack,
      levelSections: {}
    }
    this.tracks[baseTrackName] = baseTrackInfo
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
            // later...
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
        let trackInfo : TrackInfo = this.tracks[trackName]
        if (!trackInfo) {
          let daotrack : DaoTrack = {
              name: trackName,
              files: [],
              sections: baseTrack.sections,
              title: 'Theme '+theme.id+' track '+track.id,
              unitTime: 0,
              maxDuration: 0,
              pauseIfSilent: true
          }
          this.dp.tracks.push(daotrack)
          trackInfo = {
            theme: theme,
            baseTrack: false,
            daotrack: daotrack,
            levelSections: {}
          }
          this.tracks[trackName] = trackInfo
        }
      }
      // track permutations
      baseTrackInfo.levelSections[level.id] = []
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
        baseTrackInfo.levelSections[level.id].push(section)

        for (let track of level.tracks) {
          if (track.tracktype==TrackType.Oneshot) {
            continue
          }
          let fileTrackPos = trackPos
          let trackName = theme.id+':'+track.id
          let trackInfo : TrackInfo = this.tracks[trackName]
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
            trackInfo.daotrack.files.push(fileRef)
            // TODO: volume1
            fileTrackPos += length
          } // file
        } // track
        // extra second for debug ?!
        trackPos += level.seconds+SECTION_GAP
      } // permutation
      // no gap?!

      // one shot tracks
      for (let track of level.tracks) {
        if (track.tracktype!=TrackType.Oneshot) {
          continue
        }
        // make tracks
        let trackName = track.id
        let trackInfo : OneshotTrackInfo = this.oneshotTracks[trackName]
        if (!trackInfo) {
          let daotrack : DaoTrack = {
              name: trackName,
              files: [],
              sections: [],
              title: 'Oneshot track '+track.id,
              unitTime: 0,
              maxDuration: 0,
              pauseIfSilent: true
          }
          this.dp.tracks.push(daotrack)
          trackInfo = {
            name: trackName,
            daotrack: daotrack,
            nextTrackPos: 0,
            oneshotSections: {}
          }
          this.oneshotTracks[trackName] = trackInfo
        }
        // no permutations (now, anyway)
        if (track.files.length==0) {
          console.log(`Warning: theme ${theme.id} level ${level.id} oneshot track ${track.id} has no file`)
          continue;
        }
        if (track.files.length>1) {
          console.log(`Warning: theme ${theme.id} level ${level.id} oneshot track ${track.id} has ${track.files.length} files; only first will play`)
        }
        let file = track.files[0]
        let sectionName = theme.id+':'+level.id
        let section : DaoSection = {
            name: sectionName,
            title: 'Theme '+theme.id+' level '+level.id+' oneshot on track '+track.id,
            description: level.description,
            trackPos: trackInfo.nextTrackPos,
            length: file.delayseconds+file.seconds
        }
        trackInfo.daotrack.sections.push(section)
        trackInfo.oneshotSections[sectionName] = section
        let fileRef:DaoFileRef = {
            path: file.file,
            trackPos: trackInfo.nextTrackPos+file.delayseconds,
            filePos: 0,
            length: file.seconds,
            repeats: 1
        }
        trackInfo.daotrack.files.push(fileRef)
        // TODO: volume1
        trackInfo.nextTrackPos = trackInfo.nextTrackPos + section.length + SECTION_GAP
      } // track (oneshot)
    } // level
    // add _END section (for silence)
    let section : DaoSection = {
        name: END_SECTION,
        title: `End (silence)`,
        trackPos: trackPos
        // default length is all (-1)
    }
    sections.push(section)
  }

  addThemes(themes: Theme[]) {
    this.themes = themes
    // each theme becomes a set of tracks...
    for (let theme of themes)
      this.addTheme(theme)
    // add _END section to oneshot tracks (for silence)
    for (let trackName in this.oneshotTracks) {
      let trackInfo = this.oneshotTracks[trackName]
      let section : DaoSection = {
          name: END_SECTION,
          title: `End (silence)`,
          trackPos: trackInfo.nextTrackPos
          // default length is all (-1)
        }
      trackInfo.daotrack.sections.push(section)
    }
  }
  
  getData(): Daoplayer {
    return this.dp
  }
}
