var request = require('request');
var requestp = require('request-promise');
var path = require('path');
var Promise = require('bluebird');
var fs = Promise.promisifyAll(require("fs"));
var deferred = require('deferred');
var merge = require('deepmerge');

module.exports = {
    filterSetup: function(kWorkflowJob,newTrackJson) {
        sails.log("filterSetup()");
        var g = sails.config.globals.jbrowse;

        // read blast json file
        var blastfile = g.jbrowsePath + g.dataSet[0].dataPath + newTrackJson[0].jblastData;
        var blastFilterFile = g.jbrowsePath + g.dataSet[0].dataPath + newTrackJson[0].filterSettings;
        
        sails.log('blastfile',blastfile);
        try {
            var content = fs.readFileSync(blastfile, 'utf8');
        } catch(e) {
            sails.log.error("failed to read blast file",blastfile);
            return;
        }
        //sails.log('content',content.length,content);
        this.blastData = JSON.parse(content);
        
        var filter = {
            "score": {
                "type": "abs",
                "min": Math.floor(this.getLowest('Hsp_bit-score')),
                "max": Math.ceil(this.getHighest('Hsp_bit-score')),
                "val": Math.floor(this.getLowest('Hsp_bit-score'))
            },
            "evalue": {
                "type": "exp",
                "min": this.getLowest10('Hsp_evalue'),
                "max": this.getHighest10('Hsp_evalue'),
                "val": this.getHighest10('Hsp_evalue')
            },
            "identity": {
                "type": "pct",
                "min": Math.floor(this.getLowestPct('Hsp_identity')),
                "max": Math.ceil(this.getHighestPct('Hsp_identity')),
                "val": Math.floor(this.getLowestPct('Hsp_identity'))
            },
            "gaps": {
                "type": "pct",
                "min": Math.floor(this.getLowestPct('Hsp_gaps')),
                "max": Math.ceil(this.getHighestPct('Hsp_gaps')),
                "val": Math.ceil(this.getHighestPct('Hsp_gaps'))
            }
        };
        
        sails.log('filter',filter);
        try {
            fs.writeFileSync(blastFilterFile,JSON.stringify(filter));
        } catch(e) {
            sails.log.error("failed to write",blastFilterFile);
        }
    },
    // builds initial gff (unfiltered) from blast results
    filterDo: function(kWorkflowJob,newTrackJson) {
        sails.log("filterDo()");
        var g = sails.config.globals.jbrowse;
        var blastdata = g.jbrowsePath + g.dataSet[0].dataPath + newTrackJson[0].jblastData;
        var blastgff = g.jbrowsePath + g.dataSet[0].dataPath + newTrackJson[0].jblastGff;
        
        try {
            var content = fs.readFileSync(blastdata, 'utf8');
        } catch(e) {
            sails.log.error("failed to read blast json",blastdata);
            return;
        }
        var blastJSON = JSON.parse(content);
        
        var blastData = blastJSON.BlastOutput.BlastOutput_iterations.Iteration.Hit;

        var str = "";
        for(var x in blastData) {
            var qstart = blastData[x].Hsp["Hsp_query-from"];
            var qend = blastData[x].Hsp["Hsp_query-to"];
            var hstart = parseInt(blastData[x].Hsp["Hsp_hit-from"]);
            var hend = parseInt(blastData[x].Hsp["Hsp_hit-to"]);
            var strand = hend - hstart > 0 ? "+" : "-";
            var score = blastData[x].Hsp["Hsp_bit-score"];
            var seq = kWorkflowJob.data.sequence.seq;
            str += "ctgA\t";                            // 1 seqid
            str += "blastn:blastdb\t";                  // 2 source
            str += "blastn\t";                          // 3 type
            str += qstart+"\t";                         // 4 start
            str += qend+"\t";                           // 5 end
            str += score+"\t";                          // 6 score
            str += strand+"\t";                        // 7 strand
            str += ".\t";                               // 8 phase
            str += "blastHit="+x;
                str += ";Name="+blastData[x].Hit_def+"\t";
            str += "\n";
            
            //console.log(str);
        }
        fs.writeFileSync(blastgff,str);
        sails.log("file written",blastgff);
        
    },
    writeFilterSettings: function(requestData,cb) {
        var asset = requestData.asset;
        var dataSet = requestData.dataSet;
        var filterData = requestData.filterParams;
        
        sails.log.debug('fitlerData',filterData);
        
        var g = sails.config.globals.jbrowse;
        var filterfile = g.jbrowsePath + dataSet +'/'+ g.jblast.blastResultPath+'/'+asset+'_filtersettings.json';
        
        try {
            var f = JSON.parse(fs.readFileSync(filterfile));
            
        }catch (err) {
            sails.log.error('failed to open',filterfile);
            return err;
        }
        var merged = merge(f,filterData);
        
        convert2Num(merged);
        
        sails.log.debug("merged",JSON.stringify(merged, null, 4));
        
        try {
            fs.writeFileSync(filterfile,JSON.stringify(merged));
        } catch (err) {
            sails.log.error('failed to write',filterfile);
            return err;
        }
        cb(merged);
        return 0;
        
    },
    applyFilter: function(filterData,requestData) {
        var g = sails.config.globals.jbrowse;
        var asset = requestData.asset;
        var dataSet = requestData.dataSet;
        //var filterData = requestData.filterParams;
        
        var resultFile = g.jbrowsePath + dataSet +'/'+ g.jblast.blastResultPath+'/'+asset+'.json';
        var blastGffFile = g.jbrowsePath + dataSet + '/' + g.jblast.blastResultPath+'/'+asset+'.gff3';

        try {
            var content = fs.readFileSync(resultFile, 'utf8');
        } catch(e) {
            sails.log.error("failed to read blast json",resultFile);
            return;
        }
        var blastJSON = JSON.parse(content);
        
        var blastData = blastJSON.BlastOutput.BlastOutput_iterations.Iteration.Hit;


        // determine the sequence (i.e. "ctgA")
        var seqstr = blastJSON.BlastOutput['BlastOutput_query-def'];
        console.log('seqstr',seqstr);
        var seqdata = parseFastaHead(seqstr);
        var sequence = seqdata.seq;

        var str = "";
       
        for(var x in blastData) {
            var selected = 0;
            if (parseFloat(blastData[x].Hsp['Hsp_bit-score']) > filterData.score.val &&
               //+blastData[x].Hsp['Hsp_evalue'] < filterData.evalue.val &&     
               ((parseFloat(blastData[x].Hsp['Hsp_identity']) / parseFloat(blastData[x].Hsp['Hsp_align-len'])) * 100) > filterData.identity.val &&    
               ((parseFloat(blastData[x].Hsp['Hsp_gaps']) / parseFloat(blastData[x].Hsp['Hsp_align-len'])) * 100) < filterData.gaps.val   &&  
               1 ) selected = 1;
       
            if (selected) {
                var qstart = blastData[x].Hsp["Hsp_query-from"];
                var qend = blastData[x].Hsp["Hsp_query-to"];
                var hstart = parseInt(blastData[x].Hsp["Hsp_hit-from"]);
                var hend = parseInt(blastData[x].Hsp["Hsp_hit-to"]);
                var strand = hend - hstart > 0 ? "+" : "-";
                var score = blastData[x].Hsp["Hsp_bit-score"];
                var seq = sequence;
                str += "ctgA\t";                            // 1 seqid
                str += "blastn:blastdb\t";                  // 2 source
                str += "blastn\t";                          // 3 type
                str += qstart+"\t";                         // 4 start
                str += qend+"\t";                           // 5 end
                str += score+"\t";                          // 6 score
                str += strand+"\t";                        // 7 strand
                str += ".\t";                               // 8 phase
                str += "blastHit="+x;
                    str += ";Name="+blastData[x].Hit_def+"\t";
                str += "\n";
            }
            //console.log(str);
        }
        try {
            fs.writeFileSync(blastGffFile,str);
        } catch (err) {
            sails.log.error('failed to write',blastGffFile);
            return;
        }
        sails.log("file written",blastGffFile);
        
        // asset = track label
        sails.hooks['jbcore'].sendEvent("track-update",requestData.asset);
        sails.log ("Announced track update",requestData,requestData.asset);
        
    },
    // get the hightest value of the blast data variable
    getHighest: function(variable) {
        var blastData = this.blastData.BlastOutput.BlastOutput_iterations.Iteration.Hit;
        var val = 0;
        for(var x in blastData) {
            //console.log(variable,blastData[x].Hsp[variable]);
            if (+blastData[x].Hsp[variable] > val)
                val = +blastData[x].Hsp[variable];
        }
        return val;
    },
    // get the lowest value of the blast data variable.
    getLowest: function(variable) {
        var blastData = this.blastData.BlastOutput.BlastOutput_iterations.Iteration.Hit;
        var val = -1;
        for(var x in blastData) {
            if (val === -1) val = +blastData[x].Hsp[variable];
            if (+blastData[x].Hsp[variable] < val)
                val = +blastData[x].Hsp[variable];
        }
        return val;
    },
    // get the hightest value of the blast data variable
    getHighest10: function(variable) {
        var blastData = this.blastData.BlastOutput.BlastOutput_iterations.Iteration.Hit;
        var val = Math.log10(Number.MIN_VALUE);
        //console.log("smallest",val);
        for(var x in blastData) {
            var v = Math.log10(+blastData[x].Hsp[variable]);
            //console.log('v',v,blastData[x].Hsp[variable]);
            if (v > val) val = v;
        }
        return val;
    },
    // get the lowest value of the blast data variable.
    getLowest10: function(variable) {
        var blastData = this.blastData.BlastOutput.BlastOutput_iterations.Iteration.Hit;
        var val = -1;
        for(var x in blastData) {
            var v = Math.log10(+blastData[x].Hsp[variable]);
            if (val === -1) val = v;
            if (v < val)  val = v;
        }
        return val;
    },
    // get the hightest value of the blast data variable as a percent of align-len
    getHighestPct: function(variable) {
        var blastData = this.blastData.BlastOutput.BlastOutput_iterations.Iteration.Hit;
        var val = 0;
        for(var x in blastData) {
            //console.log(variable,blastData[x].Hsp[variable]);
            var cval = parseFloat(blastData[x].Hsp[variable]) / parseFloat(blastData[x].Hsp['Hsp_align-len']) * 100;
            if (cval > val) val = cval;
        }
        return val;
    },
    // get the lowest value of the blast data variable as a percent of align-len
    getLowestPct: function(variable) {
        var blastData = this.blastData.BlastOutput.BlastOutput_iterations.Iteration.Hit;
        var val = -1;
        for(var x in blastData) {
            var cval = parseFloat(blastData[x].Hsp[variable]) / parseFloat(blastData[x].Hsp['Hsp_align-len']) * 100;
            if (val === -1) val = cval;
            if (cval < val) val = cval;
        }
        return val;
    }
};

function parseFastaHead(str) {
    var line = str.split("\n")[0];
    return {
        seq: line.split(" ")[0],
        start: line.split(":")[1].split("..")[0],
        end: line.split("..")[1].split(" ")[0],
        strand: line.split("(")[1].split(" ")[0],
        class: line.split("class=")[1].split(" ")[0],
        length: line.split("length=")[1]
    };
}

function convert2Num(obj) {
    for(var x in obj) {
        if (typeof obj[x].val === 'string')
            obj[x].val = Number(obj[x].val);
    }
}