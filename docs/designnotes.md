# DaoAuthor design notes

Inspired by Adrian Hazzard's Yorkshire Sculpture Park soundtrack, 
[daoplayer](https://github.com/cgreenhalgh/daoplayer)'s 
[track and scene](https://github.com/cgreenhalgh/daoplayer/blob/master/docs/fileformat.md)
model, and its applications (Geotracks, The Rough Mile). 
Also by [Elias](https://www.eliassoftware.com/) and other 
adaptive music systems.

## General model

One basic strategy is use of layered loops.

Variation is achieved through:
- adding/removing layers (aka tracks, stems, buses, groups)
- switching between different versions of loop(s) for a layer

See initial [file format](fileformat.md)

## Approach - daoplayer

Initial approach will target [daoplayer](https://github.com/cgreenhalgh/daoplayer),
i.e. compile spreadsheet into daoplayer tracks and scenes.

Each `region` is a `scene` (possibly more than one depending on treatment of levels).

I'm not sure if each level is a scene or not.

At least within a `theme` all audio files are assembled onto a common set of daoplayer `tracks`.

I'm not sure if all audio files in all themes are assembled onto a common set of daoplayer `tracks`; may depend on performance/efficiency.

### Plan A

All files/themes/levels on the same set of synchronized tracks.

Every section is from some valid end point (beat) of some level to the start of a (new or the same) level.

Update within a region will just unfold the next level.

Every theme/level identified explicitly in a region is a possible entry point.

Starting a new region will transition out of the old section (level) asap to the entry point for the new region.
- How will it know if it is in an old region? hope they don't overlap?! sceneTime = 0? Jump immediately to pre-assembled transition?!
- what about layer auto-changes within a region? will they confuse it?

E.g.
- _ -> a/1 (default start)
- a/1(/16) -> a/1 (specified nextlevel)
- a/1/4 -> _ (after given beat)
- a/1/8 -> _
- a/1/12 -> _
- a/1/16 -> _
- a/1/x -> a/2 (entry point in same group) - jump immediate to this to show what is happening?
- a/2/16 -> a/2 (nextlevel)
- _ -> a2

One scene per level? or several levels per scene? 
Try one scene per level...

- Initial region scene is try to get to its entry level; if that is not current it builds the transition to it.
- If that has been reached then it switches to a scene to handle that level.
- it cues up the nextlevel in the track pos
- when reached it switches...
- how does it do set scene from a track pos function? just call daoplayer.setScene?!

For now a oneshot can be on a separate track and allowed to play out.