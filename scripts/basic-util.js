/**
 * @fileoverview basic/simple util functions
 * @author Pradeep Gouribhatla
 */

"use strict";
const chalk = require("chalk"),
    figlet = require("figlet"),
    RCR = require("../config/rcr_constants"),
    parseArgs = require("minimist");

module.exports = (function() {
    const _fileTypes = {
        sys_script_include: "Script Include",
        sys_script_client: "Client Script",
        sys_script: "Business Rule",
        catalog_script_client: "Catalog Client Scripts",
        sysevent_script_action: "Script Action",
        sys_ui_script: "UI Script",
        sys_ui_page: "UI Page"
    };

    const parseCMDLineOptions = function() {
        //get arguments
        let cmdOptionsArr = process.argv.slice(2);
        let rcrArgsObj = parseArgs(cmdOptionsArr);

        global.debug = rcrArgsObj.debug;
        if (global.debug) console.dir(rcrArgsObj);

        let choice, choiceVal;
        if (rcrArgsObj.configure) {
            choice = "configure";
        } else if (rcrArgsObj.defaultInstacne) {
            choice = "defaultInstance";
        } else if (rcrArgsObj.syncrules) {
            choice = "syncrules";
        } else if (rcrArgsObj.reset) {
            choice = "reset";
        } else if (rcrArgsObj.update) {
            choice = "update";
        } else if (rcrArgsObj.help) {
            choice = "help";
        }

        if (choice) return { choice };

        if (!rcrArgsObj.instance) return {};
        global.instanceName = rcrArgsObj.instance;
        global.json = rcrArgsObj.json;
        global.showAllFindings = rcrArgsObj.all;

        if (rcrArgsObj.updateset) {
            choice = "updateset";
            choiceVal = rcrArgsObj.updateset;
        } else if (rcrArgsObj.scopedapp) {
            choice = "scopedapp";
            choiceVal = rcrArgsObj.scopedapp;
        } else if (rcrArgsObj.duration) {
            choice = "duration";
            choiceVal = ~~rcrArgsObj.duration || 7;
        } else if (rcrArgsObj.files) {
            choice = "files";
            try {
                choiceVal = JSON.parse(rcrArgsObj.files);
            } catch (error) {
                console.log(error);
            }
        } else if (rcrArgsObj.saveconfig) {
            choice = "saveconfig";
            choiceVal = {
                instanceName: rcrArgsObj.instance,
                userName: rcrArgsObj.user,
                password: rcrArgsObj.password
            };
        }

        return {
            choice,
            choiceVal
        };
    };

    const getRCRCmdOptions = function() {
        // choice and value
        let choice = null,
            choiceVal = null;

        //get arguments
        let cmdOptionsArr = process.argv.slice(2);
        let cmdOption = cmdOptionsArr[0] || null;

        if (cmdOption) {
            cmdOption = cmdOption.split("-").join("");
            if (cmdOption.indexOf("=") > 0) {
                choice = "-" + cmdOption.split("=")[0];
                choiceVal = cmdOption
                    .split("=")
                    .slice(1)
                    .join("");
            } else {
                choice = "-" + cmdOption;
                choiceVal = cmdOptionsArr[1];
            }
        }

        return {
            choice,
            choiceVal
        };
    };

    const showInfoLevelMessage = function(msg) {
        console.log(chalk.bold(msg));
    };

    const showSuccessMessage = function(msg) {
        console.log(chalk.bgGreen(" " + msg + " "));
    };

    const showErrMessage = function(msg) {
        console.log(chalk.bgRed(" " + msg + " "));
    };

    const showWrongCmdText = function() {
        console.log("Oops!! That's not a command which I can understand..");
    };

    const showHelpText = function() {
        console.log(chalk.gray("CRNOW usage instructions below:"));
        console.log(chalk.gray(RCR.USAGE_INS));
    };

    const showRCRLogo = function() {
        console.log(chalk.red.redBright(figlet.textSync("SNOW-RCR", { horizontalLayout: "full" })));
    };

    const getTypeByClass = function(className) {
        return _fileTypes[className];
    };

    const getClassByType = function(type) {
        return Object.keys(_fileTypes).find(key => _fileTypes[key] === type);
    };

    const updateRCR = function() {
        //TODO:: TEST THIS
        const exec = require("child_process").exec;
        exec("npm update sn-rcr", function(error, stdout, stderr) {
            if (error !== null) {
                console.log("Updating SNOW RCR failed", error);
            }
        });
    };

    return {
        showInfoLevelMessage,
        showSuccessMessage,
        showErrMessage,
        showHelpText,
        showRCRLogo,
        parseCMDLineOptions,
        getRCRCmdOptions,
        getTypeByClass,
        getClassByType,
        updateRCR
    };
})();
