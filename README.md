# daoauthor

Authoring tools for location-based audio.

Concept: specify behevaiour using text files tailored for 
conciseness and domain-specific expression, and compile to 
configuration files/scripts for use with 
[daoplayer](https://github.com/cgreenhalgh/daoplayer) or
[daoplayer2](https://github.com/cgreenhalgh/daoplayer2)/
[dymo-core](https://github.com/dynamic-music/dymo-core).

Status: just starting...

By Chris Greenhalgh <chris.greenhalgh@nottingham.ac.uk>
Copyright (c) The University of Nottingham, 2017

## Build

```
docker build -t daoauthor .
```
```
docker run -it daoauthor
```
In container
```
cd /root/work
npm install
npm run-script build
node dist/index.js data/mobile\ music\ ex1.1.xlsx
```

## TODO

At least some of the outstanding items:

- `oneshot` tracks
- track/file volumes
- theme transitions
- track/file volume fades
- region time limits (e.g. `disableafter`?)
- level transition short fades
- debug script timeouts
- `globalvolume` ??
