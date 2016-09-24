#!/usr/bin/env node

var request = require('request'),
    fs = require('fs'),
    path = require('path'),
    getopt = require('node-getopt');
var global = require('./global-rest.js');
var Finder = require('fs-finder');

var getopt = new getopt([
    ['g' , 'gpath=PATH'       , 'set and save Galaxy install path'],
    ['a' , 'apikey=STRING'    , 'set and save Galaxy API key'],
    ['b' , 'blastdb=STRING'   , 'Blast db to download and install [all|htgs|nt|wgs|phiX] (this will take a while)'],
    ['p' , 'blastdb-path=PATH', 'existing database path'],
    ['u' , 'blastdb-uri=URI'  , 'Download from Blastdb URI (rsync://...; this will take a while)'],
    ['w' , 'workflow=ARG'     , '[install|<path>] "install" project wf, or specify .ga file '],
    ['t' , 'tools'            , 'install jblast tools'],
    ['v' , 'view'             , 'view status of config'],
    
    ['h' , 'help'            , 'display this help']
]);              // create Getopt instance
getopt.bindHelp()     // bind option 'help' to default action
opt = getopt.parseSystem(); // parse command line

getopt.setHelp(
  "Usage: jblast-config [OPTION]\n" +
  "\n" +
  "[[OPTIONS]]\n"
);

/* Display help if no arguments are passed */
if (!process.argv.slice(2).length) {
	getopt.showHelp();
	process.exit(1);
}

var gpath = opt.options['gpath'];
var apikey = opt.options['apikey'];

// save gpath or get it if it exists
if (typeof gpath !== 'undefined') global.setConfig('gpath',gpath);
else gpath = global.getConfig('gpath');

// save apikey or get it if it exists
if (typeof apikey !== 'undefined') global.setConfig('apikey',apikey);
else gpath = global.getConfig('apikey');


var dir = Finder.from(gpath).findDirectories('tool-data');
if (dir.length==0) {
    console.log("tool-data dir not found\n");
    process.exit(1);
}
var tooldir = dir[0];
console.log('tool-data directory:',tooldir);

var files = Finder.from(tooldir).exclude('*.sample').findFiles('blastdb.loc');
console.log('files',files);