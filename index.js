#!/usr/bin/env node

/**
 * @fileoverview Main/entry point for CRNOW
 * @author Pradeep Gouribhatla
 
 **********************************************************
 **********************************************************
 * Modules/High level flow
 *  1. Configure instance and do required setup
 *     (a) prompt for user credentials
 *     (b) verify credentials : PENDING
 *     (c) upload scoped app and provide access to tables
 *     (d) sync rules from git
 *     (e) generate script specific rule condition xml
 *  
 *  2. Run crnow with update set /scoped app sys id
 *     (a) fetch files from the instance
 *     (b) loop the files and determine matching rule
 *     (c) Run rules and save the result
 *        
 *  3. Process eslint result 
 *     (a) create a http server or just a html file
 *     (b) use template engine? Handlebars or dot.js?
 *     (c) open the file with results 
 *
 **********************************************************
 **********************************************************
*/

"use strict";
const config = require("./scripts/configure"),
    util = require("./scripts/basic-util");

//Main function
async function main() {
    // Get the command(or option)
    let rcrUtil;
    const { option, optionVal } = util.getRCRCmdOptions();

    //Run respective module based on option
    switch (option) {
        case "-configure":
            await config.initialInstanceConfig();
            break;

        case "-syncrules":
            await config.syncAllRules();
            break;

        case "-reset":
            await config.resetInstanceConfiguration();
            break;

        case "-update":
            util.updateRCR();
            break;

        case "-updateset":
            rcrUtil = require("./scripts/rcr-util");
            if (!optionVal) util.showHelpText();
            await rcrUtil.reviewUpdateSet(optionVal);
            break;

        case "-scopedapp":
            rcrUtil = require("./scripts/rcr-util");
            if (!optionVal) util.showHelpText();
            await rcrUtil.reviewScopedApp(optionVal);
            break;

        case "-deltarun":
            rcrUtil = require("./scripts/rcr-util");
            if (!optionVal) util.showHelpText();
            await rcrUtil.reviewDeltaFiles(optionVal);
            break;

        case "-help":
            util.showHelpText();
            break;

        default:
            util.showHelpText();
            break;
    }
}

/******************************
 ******************************
 * Calling Main 
 ******************************
 ******************************/

(async function() {
    try {
        util.showRCRLogo();
        await main();
    } catch (error) {
        console.error(error);
        console.log("Oops!! Something went wrong.. Try reconfiguring");
        util.showHelpText();
        process.exit(1);
    }
})();

/*******************************
 ******* END OF RCR   **********
 *******************************/
