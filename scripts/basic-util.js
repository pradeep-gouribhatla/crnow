/**
 * @fileoverview basic/simple util functions
 * @author Pradeep Gouribhatla
 */

"use strict";
const chalk = require("chalk"),
    figlet = require("figlet"),
    RCR_CONST = require("../config/rcr_constants");

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

    const getRCRCmdOptions = function() {
        // option and value
        let option = null,
            optionVal = null;

        //get arguments
        let cmdOptionsArr = process.argv.slice(2);
        let cmdOption = cmdOptionsArr[0] || null;

        if (cmdOption) {
            cmdOption = cmdOption.split("-").join("");
            if (cmdOption.indexOf("=") > 0) {
                option = "-" + cmdOption.split("=")[0];
                optionVal = cmdOption
                    .split("=")
                    .slice(1)
                    .join("");
            } else {
                option = "-" + cmdOption;
                optionVal = cmdOptionsArr[1];
            }
        }

        return {
            option,
            optionVal
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
        console.log(chalk.gray(RCR_CONST.USAGE_INS));
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
            sys.print("stdout: " + stdout);
            sys.print("stderr: " + stderr);
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
        getRCRCmdOptions,
        getTypeByClass,
        getClassByType,
        updateRCR
    };
})();
