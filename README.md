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

- level transition short fades 
- check/fix why "glitch" scene won't transition on a single beat
- `onexitenable`, `onexitdisable`
- theme transitions: fade out, delay (based on neighbours?!)
- region time limits (e.g. `disableafter`?)
- debug script timeouts
- between theme beat alignment?
- `globalvolume` ??
