/**
 * @module
 * @description
 * 
 * This job service is functionally equivelant to basicWorkflowService, however,
 * NCBI operations are sent through galaxy workflow for processing. 
 * 
 * Job submission example:
 * ::
 *   var postData = {
 *         service: "jblast",
 *         dataset: "sample_data/json/volvox",
 *         region: ">ctgA ctgA:44705..47713 (- strand) class=remark length=3009\nacatccaatggcgaacataa...gcgagttt",
 *         workflow: "NCBI.blast.workflow.js"
 *     };
 *   $.post( "/job/submit", postData , function( result ) {
 *       console.log( result );
 *   }, "json");
 *
 * Configuration:
 * ::
 *        // Galaxy settings
 *        galaxy: {
 *            // Galaxy API path
 *            galaxyUrl: "http://localhost:8080",
 *            
 *            // Galaxy installation path
 *            galaxyPath: "/var/www/html/galaxy",
 *           
 *            // Galaxy API key (you must obtain this from your Galaxy installation)
 *            galaxyAPIKey: "c7be32db9329841598b1a5705655f633",
 *
 *            // The default Galaxy History where workflows will execute
 *            historyName: "Unnamed history"
 *        },
 *       
 *        jblast: {
 *           // The subdir where blast results will be deposited (i.e. ``sample_data/json/volvox/jblastdata``)
 *           blastResultPath: "jblastdata",
 *           
 *           // The category for successful blast results in the track selector
 *           blastResultCategory: "JBlast Results",
 *           
 *           // Track template of the blast result track that will be inserted in trackList.json
 *           trackTemplate: "jblastTrackTemplate.json",
 *           
 *           // Type of file that will be imported for processing blast.
 *           import: ["blastxml"],
 *           
 *           
 *           // BLAST profiles
 *           // blast profiles are parameter lists that translate to blastn cli parameters sets
 *           // (i.e. for "remote_htgs" would translate to "blastn -db htgs -remote")
 *           // These will override any default parameters defined in ``blastjs``
 *           // 
 *           // Blast profiles generally apply to basicWorkflowService only
 *           // and do no apply to galaxyService.
 *           // 
 *           // Our example uses a subset of htgs, an NCBI curated blast database.
 *           // So, it is our default profile.
 *           defaultBlastProfile: 'htgs',
 *           blastProfiles: {
 *               'htgs': {
 *                   'db': 'htgs'
 *               },
 *               'remote_htgs': {
 *                   'db': 'htgs',
 *                   'remote': ""
 *               }
 *           }
 *       },
 *       // list of services that will get registered.
 *       services: {
 *           'galaxyService':          {name: 'galaxyService',         type: 'workflow', alias: "jblast"},
 *           'filterService':            {name: 'filterService',         type: 'service'},
 *           'entrezService':            {name: 'entrezService',         type: 'service'}
 *       },
 * 
 * 
 */


module.exports = {

    fmap: {
        get_workflows:      'get',
        get_hit_details:    'get'
    },
    init: function(params,cb) {
        sails.log(">>> galaxyService.init");
        //galaxyProc.init(cb);        var cb2 = cb;
        // TODO: check that galaxy is running

        galaxyUtils.init(function(history) {

            historyId = history.historyId;
            cb(null,'success');

        }, function(err) {
            sails.log.error("failed galaxy.init",err);
            cb(err);
        });

        
        
    },
    /**
     * job service validation
     * 
     * @param {object} params - parameters
     * @returns {val} 0 if successful, otherwise failure
     */
    validateParams: function(params) {
        if (typeof params.workflow === 'undefined') return "workflow not defined";
        if (typeof params.region === 'undefined') return "region not undefined";
        return 0;   // success
    },
    /**
     * job service generate name
     * 
     * @param {object} params - parameters
     * @returns {string} name of job
     */
    generateName(params) {
        return params.workflow;
    },
    /**
     * job service begin
     * 
     * @param {object} kJob - kue job object
     */
    beginProcessing:  function(kJob) {    
        //return galaxyUtils.beginProcessing(kJob);
        //params.monitorFn = this.monitorWorkflow;
        return galaxyUtils.beginProcessing(kJob);
    },
    get_workflows:  function(req,res) {     
        //return galaxyProc.getWorkflows(req,res);
        galaxyUtils.galaxyGET("/api/workflows",function(workflows,err) {
            if (err !== null) {
                return res.serverError({status:'error',msg:"galaxy GET /api/workflows failed",err:err});
            }
            return res.ok(workflows);
        });
    },
    get_hit_details:  function(req,res) {   
        //return galaxyProc.getHitDetails(req,res);
        
        var params = req.allParams();

        var asset = params.asset;
        var hitkey = params.hitkey;
        var dataset = params.dataset;

        filter.getHitDetails(hitkey, dataset, asset, function(hitData) {
           res.ok(hitData); 
        });
    }
};
