# daoauthor

Authoring tools for location-based audio.

Concept: specify behevaiour using text files tailored for 
conciseness and domain-specific expression, and compile to 
configuration files/scripts for use with 
[daoplayer](https://github.com/cgreenhalgh/daoplayer) or
[daoplayer2](https://github.com/cgreenhalgh/daoplayer2)/
[dymo-core](https://github.com/dynamic-music/dymo-core).

Status: regions and within-theme transitions working but not well tested. 
See TODO list below.

By Chris Greenhalgh <chris.greenhalgh@nottingham.ac.uk>
Copyright (c) The University of Nottingham, 2017

## Build

```
docker build -t daoauthor .
```

Interactive shell:
```
docker run -it --rm -v `pwd`/data:/root/work/data daoauthor
```
In container
```
cd /root/work/data
node ../dist/index.js mobile\ music\ ex1.1.xlsx
```
Results should be written to the `data` directory and accessible externally.

## TODO

At least some of the outstanding items:

- debug track (e.g. narrative) timing glitches on (?) load/update in quick succession
- transition - override first level
- `choice` track type (exactly one of the files, i.e. permutations [0], [1], [2], ...)
- continuous controllers?? e.g. volume from proximity?
- within level transitions? i.e. to the same time in the other level??
- region time limits (e.g. `disableafter`?)
- debug script timeouts
- between theme beat alignment?
- `globalvolume` ??
- other more sophisticated transitions??
