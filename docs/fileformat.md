# DaoAuthor fileformat

Uses Excel spreadsheet.

Following sheets should exist (details below):
- `settings` - general settings
- `regions` - high-level regions and associated treatments
- `themes` - themes and levels, i.e. lower-level specifications of audio loops
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

Note: can `level` have multiple values? If so, why? random choice?!

## themes

Each row is a theme, level (within a theme) and/or audio file (within the level and theme).

In general missing values inherit the value from first non-missing value above.

Note:
- a `theme` is a set of related musical "levels" or treatments
- all levels within a theme should have the same tempo
- a `level` is a musical treatment comprising a set of tracks to play (repeatedly)
- a `track` is one or more audio files to play each time the level loops
- a track with more than one audio file can play them in sequence or play one chosen at random
- tracks and levels are played in sync
- transitions between levels only occur at specified beats
- a `oneshot` track does not end when the level ends or repeat if the level repeats

The columns in this sheet specifically for a `theme` are:
- `theme:` - theme name/ID, i.e. group of related music levels (note trailing colon)
- `description` - theme description (string, optional)
- `tempo` - tempo, should be specified only for `theme` as a whole

The columns in this sheet specifically for a `level` are:
- `level:` - level name/ID, i.e. a specific set of loops making up a musical treatment (note trailing colon)
- `description` - (string, optional)
- `nextlevel` - comma-separated list of names/IDs of level(s) to transition to when this level has completed. To loop a level put its ID here. 
- `beats` - length of level in beats (required unless `seconds` is specified).
- `seconds` - length of level in seconds (optional, overrides `beats` if specified)
- `endbeats` - comma-separated list of beat numbers after which a transition to another level can take place

The columns in this sheet specifically for a `track` (a single looped cell within a level) are:
- `track:` - track name/ID, required for oneshot tracks, optional otherwise
- `description` - track description
- `type` - track type, default `sequence`; one of `sequence` (all files played in order), `oneshot` (file(s) played once in non-looping track), `random` (files selected at random), `shuffle` (files played in a random order)

There are then any number of consecutively numbered `fileN:` sections (i.e. starting with columns `file1:`, `file2:`, etc.)

The columns in this sheet specifically for a `fileN:` (a single file within a track and level) are:
- `fileN:`- name of the audio file. Currently .wav is recommended
- `beats` - length of file in beats (defaults to level length in beats)
- `seconds` - length of file in seconds (optional, overrides `beats` if specified)
- `delaybeats` - delay before start of file, beats (default 0); in a sequence this is relative to the end of the previous file, otherwise to the start of the level.
- `delayseconds` - delay before start of file, seconds (overriders delaybeats if specified)
- `volume1` - initial volume of file

Not yet supported:
- `fadebeats` - optional time (beats) over which to fade to `volume2`; if fadebeats and fadeseconds omitted volume remains at `volume1`
- `fadesconds` - optional time (seconds) over which to fade to `volume2`; if specified overrides fadebeats
- `volme2` - volume after `fadetimebeats`, if specified (default is `volume1`)

## transitions

NOT YET SUPPORTED; SUBJECT TO CHANGE

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

