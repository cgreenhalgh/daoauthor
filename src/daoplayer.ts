// daoplayer-specific stuff
import { Settings, Region } from './sheet'


export interface DaoMeta {
  mimetype:string
  version:number
  title?:string
  description?:string
  artist?:string
}
export interface DaoTrack {
  
}
export interface DaoTrackRef {
  
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

const DEFAULT_SCENE = "Start"

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

export function addRegions(dp: Daoplayer, regions: Region[]) {
  for (let region of regions) {
    let scene:DaoScene = {
      name: region.region+':default',
      partial: false,
      tracks: [],
      title: `Default scene for region ${region.region}`,
      updatePeriod: 1.0,
      waypoints: {},
      routes: {}
    }
    dp.scenes.push(scene)
  }
}