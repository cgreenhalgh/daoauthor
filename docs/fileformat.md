# DaoAuthor fileformat

Uses Excel spreadsheet.

Following sheets should exist (details below):
- `settings` - general settings
- `regions` - high-level regions and associated treatments
- `themes` - themes and levels, i.e. lower-level specifications of audio loops
- `oneshots` - one-off (non-looped) audio samples
- `transitions` - specifications of theme/level transitions

## settings

`settings` sheet should have columns `setting` and `value`.

The standard values for `setting` are:
- `tool` - should (currently) be `daoauthor-1`; used to check file compatibility with tools
- `title` - name of experience
- `description` - description of experience
- `author` - author name
- `version` - version of experience (string)
- `outfile` - name of file to write 
- `contextfile` - name of [daoplayer-style context file](https://github.com/cgreenhalgh/daoplayer/blob/master/docs/fileformat.md) to use to specify waypoints and routes

## regions

Each row is a region/treatment, i.e. an association between a 
trigger zone (route, area, other condition) and a musical treatment 
(specified by an initial theme and level, see below).

Note:
- only one region may be active at any time; this determines the audio treatment.
- Each region may be enabled or disabled; only enabled regions can be active. 
- Each region may have a priority; the highest priority enabled region should normally be made active
- A region can be triggered by proximity to a route (A-B path), waypoint, having GPS or not having GPS.

The columns in this sheet which define a `region` are:
- `region` - region ID/name
- `group` - group of regions to which this belongs (optional, string) - transitions within a group are always considered.
- `gps` - (default "y") "y" => the region is triggered by having GPS (at all); "n" => region is triggered by NOT having GPS
- `routes` - comma-separated list of names of routes that will trigger region (string, optional)
- `waypoint` - name of waypoint that will trigger region (string, optional); if used a `rangemetres` must also be specified
- `rangemetres` - range in metres from `waypoint` (if specified) up to which region will be triggered
- `description` - (optional, string)
- `priority`- (number, default 0) priority with which a region will be triggered.
- `enabledatstart` - (default "y") whether region is enabled at start; "n" => not initially enabled
- `neighbours` - comma-separated list of regions to which transitions are expected
- `enable` - comma-separated list of regions which should be enabled when this region becomes active
- `disable` - comma-separated list of regions which should be disabled when this region becomes active
- `theme` and `level` - theme and level that are transitioned to when this region becomes active
- `oneshot` - name of oneshot audio that is triggered when this region becomes active

## themes

Each row is a theme, level (within a theme) and/or audio file (within the level and theme).

In general missing values inherit the value from first non-missing value above.

Note:
- a `theme` is a set of related musical "levels" or treatments
- all levels within a theme should have the same tempo
- a `level` is a musical treatment comprising a set of audio loops to play
- files and levels are played in sync
- transitions between levels only occur at specified beats

The columns in this sheet specifically for a `theme` are:
- `theme` - theme name/ID, i.e. group of related music levels
- `tempo` - tempo, should be specified only for `theme` as a whole

The columns in this sheet specifically for a `level` are:
- `level` - level name/ID, i.e. a specific set of loops making up a musical treatment
- `description` - (string, optional)
- `nextlevel` - name/ID of level to transition to when this level has completed. To loop a level put its ID here. 
- `beats` - length of level in beats.
- `endbeats` - comma-separated list of beat numbers after which a transition to another level can take place

The columns in this sheet specifically for a `file` (a single looped cell within a level) are:
- `file`- name of the audio file. Currently .wav is recommended
- `volume1` - initial volume of file
- `fadetimebeats` - optional time (beats) over which to fade to `volume2`; if omitted volume remains at `volume1`
- `volme2` - volume after `fadetimebeats`, if specified (default is `volume1`)

## oneshots

Each row is an audio same to be played to completion. 
Can be specified in a region (when the region becomes active) 
or in a transition (when a transition occurs).

The colums in this sheet are:
- `oneshot` - name/ID Of oneshot
- `file`- audio file name
- `volume` - volume to play file
- `seconds` - length of file in seconds

## transitions

Each row specifies how a theme (or layer) transition should be handled.

The default transition behaviour is currently undefined, but is likely to be an abrupt cut or fast cross-fade.

The columns in this sheet are:
- `fromtheme` - name/ID of theme transitioning from
- `fromlevel` - name/ID of level transitioning from (optional, if blank entry will apply to any level in that theme)
- `totheme` - name/ID of theme transitioning to
- `tolevel` - name/ID of level transitioning to (optional, if blank entry will apply to any level in that theme)
- `fadeoutseconds` - duration of fade out applied to theme/level being left (seconds, default very short)
- `delayseconds` - delay between start of fade out and start of fade in (seconds, default 0, i.e. cross-fade); can be larger than `fadeoutseconds` to add a gap
- `fadeinseconds` - duration of fade in applied to theme/level being started (seconds, default very short)

