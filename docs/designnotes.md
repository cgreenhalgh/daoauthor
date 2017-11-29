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

