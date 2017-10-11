/**
 * @fileoverview initiates/starting point for performing code review on given command
 * @author Pradeep Gouribhatla
 */

"use strict";

const parseXML = require("xml2js").parseString,
    CLIEngine = require("eslint").CLIEngine,
    axios = require("axios"),
    openURLUtil = require("openurl"),
    instance = require("./instance"),
    util = require("./basic-util"),
    nowHelper = require("./now-util"),
    ruleHelper = require("./rule-util"),
    resultsUtil = require("./results-util"),
    RCR = require("../config/rcr_constants");

module.exports = (function() {
    //Initialze/fetch instnace data. If instance not configured. Throw an error.
    const initialize = async function() {
        if (instance.isConfigured()) return;
        try {
            await instance.initialize();
        } catch (error) {
            throw new Error("Instance not configured");
        }
    };

    function _getRulesObject(rules, severity = 2) {
        let rulesObj = {};
        if (Array.isArray(rules)) rules.forEach(rule => (rulesObj[rule] = severity));
        return rulesObj;
    }

    async function _getSimplePayload(xmlPayload, scriptClass, scriptFName) {
        try {
            let simpleRecordObj = {};
            let payloadObj = await parseXMLWrapper(xmlPayload);
            let recordObj = payloadObj["record_update"][scriptClass][0];
            Object.keys(recordObj).forEach(attr => {
                if (attr == "$") return;
                simpleRecordObj[attr] = recordObj[attr][0];
                //TODO:  if (typeof simpleRecordObj[attr] == 'object')
            });
            return simpleRecordObj;
        } catch (error) {
            console.error("Error parsing file : " + scriptFName);
        }
    }

    async function parseXMLWrapper(xmlPayload) {
        return await new Promise((resolve, reject) => {
            parseXML(xmlPayload, { ignoreAttrs: true }, (err, data) => {
                if (err) reject(err);
                else resolve(data);
            });
        });
    }

    const reviewUpdateSet = async function(updateSetId) {
        // Initialize instance
        await initialize();

        if (!updateSetId || !instance.isConfigured()) return;

        let filesData = await nowHelper.fetchUpdateSetFiles(updateSetId);
        if (!Array.isArray(filesData) || filesData.length == 0) {
            console.log("Oops! Could not find any files (which can be linted) in the given update set");
            return;
        }

        let reviewResultsList = [];

        try {
            //TODO :: change to functional approach
            //let reviewResults = await Promise.all(filesData.map(async (fileData) => {
            for (let i = 0; i < filesData.length; i++) {
                let fileData = filesData[i];
                const xmlPayload = fileData.payload;
                const scriptFName = fileData.target_name;
                const _lastIndex = fileData.name.lastIndexOf("_");
                const scriptClass = fileData.name.substring(0, _lastIndex);

                const scriptPayload = await _getSimplePayload(xmlPayload, scriptClass, scriptFName);
                const script = scriptPayload.script;
                //console.dir(scriptPayload);

                //get matching rules for record
                const rules = await ruleHelper.getAllRulesForRecord(scriptPayload);
                //console.dir(rules);

                /******************************************************
                ********             REVIEW FILE               ********
                *******************************************************/
                let _results = reviewFile(script, rules, scriptFName);
                /******************************************************/

                // _results.forEach(rs => {
                //     rs.messages.forEach( msg => console.log(msg)); // });
                //return thisFileResults;

                //Code smells
                if (!_results || _results.length <= 0) return [];

                let thisFileResults = _results[0];
                thisFileResults.fileName = scriptFName;
                thisFileResults.fileSysId = scriptPayload.sys_id;
                thisFileResults.updatedBy = scriptPayload.sys_updated_by;
                thisFileResults.class = scriptPayload.sys_class_name;
                thisFileResults.type = util.getTypeByClass(scriptPayload.sys_class_name);

                const scriptLines = script.split("\n");
                const noOfLines = scriptLines.length;
                thisFileResults.messages.forEach(rl => {
                    const errlineNo = rl.line - 1;
                    let stLineNo = errlineNo - 1 <= 0 ? 0 : errlineNo - 1;
                    let enLineNo = errlineNo + 1 >= noOfLines - 1 ? noOfLines : errlineNo + 2;
                    rl.source_lines = scriptLines.slice(stLineNo++, enLineNo).map(ln => {
                        return {
                            line: stLineNo++,
                            source: ln,
                            erClass: stLineNo - 2 == errlineNo ? "error" : ""
                        };
                    });
                });

                if (global.debug)
                    console.log("Code smells count for (" + scriptFName + ") :: " + thisFileResults.errorCount);
                reviewResultsList.push(thisFileResults);
            } //}));

            const completeResultsObj = {
                reportRunAt: new Date(),
                instanceName: instance.getInstanceName(),
                instanceURL: instance.getFullURL,
                userName: instance.getUserName(),
                results: reviewResultsList
            };

            // handle reviewResults in a separate template
            // console.dir(completeResultsObj);
            const htmlFilePath = resultsUtil.saveResultsToHTMLFile(completeResultsObj);
            if (!htmlFilePath) throw new Error("Error generating HTML file");

            openURLUtil.open("file://" + htmlFilePath);
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to parse the update set files");
            process.exit(1);
        }
    };

    const reviewScopedApp = async function(scopedAppId) {
        // Initialize instance
        await initialize();

        if (!scopedAppId || !instance.isConfigured()) return;

        let filesData = await nowHelper.fetchScopedAppFiles(scopedAppId);
        if (!Array.isArray(filesData) || filesData.length == 0) {
            console.log("Oops! Could not find any files (which can be linted) in the given scoped app");
            return;
        }

        let reviewResultsList = [];

        try {
            //TODO :: change to functional approach
            //let reviewResults = await Promise.all(filesData.map(async (fileData) => {
            for (let i = 0; i < filesData.length; i++) {
                let scriptPayload = filesData[i];
                const script = scriptPayload.script;
                const scriptFName = scriptPayload.sys_name;
                //get matching rules for record
                const rules = await ruleHelper.getAllRulesForRecord(scriptPayload);
                //console.dir(rules);

                /******************************************************
                ********             REVIEW FILE               ********
                *******************************************************/
                let _results = reviewFile(script, rules, scriptFName);
                /******************************************************/

                //Code smells
                if (!_results || _results.length <= 0) return [];

                let thisFileResults = _results[0];
                thisFileResults.fileName = scriptFName;
                thisFileResults.fileSysId = scriptPayload.sys_id;
                thisFileResults.updatedBy = scriptPayload.sys_updated_by;
                thisFileResults.class = scriptPayload.sys_class_name;
                thisFileResults.type = util.getTypeByClass(scriptPayload.sys_class_name);

                const scriptLines = script.split("\n");
                const noOfLines = scriptLines.length;
                thisFileResults.messages.forEach(rl => {
                    const errlineNo = rl.line - 1;
                    let stLineNo = errlineNo - 1 <= 0 ? 0 : errlineNo - 1;
                    let enLineNo = errlineNo + 1 >= noOfLines - 1 ? noOfLines : errlineNo + 2;
                    rl.source_lines = scriptLines.slice(stLineNo++, enLineNo).map(ln => {
                        return {
                            line: stLineNo++,
                            source: ln,
                            erClass: stLineNo - 2 == errlineNo ? "error" : ""
                        };
                    });
                });

                //console.log("Code smells count for (" + scriptFName + ") :: " + thisFileResults.errorCount);
                reviewResultsList.push(thisFileResults);
            } //}));

            const completeResultsObj = {
                reportRunAt: new Date(),
                instanceName: instance.getInstanceName(),
                instanceURL: instance.getFullURL,
                userName: instance.getUserName(),
                results: reviewResultsList
            };

            if (saveResultsToHTMLFile) {
                // handle reviewResults in a separate template
                const htmlFilePath = resultsUtil.saveResultsToHTMLFile(completeResultsObj);
                if (!htmlFilePath) throw new Error("Error generating HTML file");
                openURLUtil.open("file://" + htmlFilePath);
            } else {
                // console.dir(completeResultsObj);
            }
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to parse the scoped app files");
            process.exit(1);
        }
    };

    const reviewDeltaFiles = async function(deltaDays) {
        // Initialize instance
        await initialize();

        if (!deltaDays || !instance.isConfigured()) return;

        if (deltaDays <= 0 || deltaDays > RCR.max_delta_days) {
            console.log("Delta days cannot exceed " + RCR.max_delta_days + " days");
            return;
        }

        let filesData = await nowHelper.fetchDeltaFiles(deltaDays);
        if (!Array.isArray(filesData) || filesData.length == 0) {
            console.log("Oops! Could not find any files which are updates in last " + deltaDays + " days");
            return;
        }

        let reviewResultsList = [];

        try {
            //TODO :: change to functional approach
            //let reviewResults = await Promise.all(filesData.map(async (fileData) => {
            for (let i = 0; i < filesData.length; i++) {
                let scriptPayload = filesData[i];
                const script = scriptPayload.script;
                const scriptFName = scriptPayload.sys_name;
                //get matching rules for record
                const rules = await ruleHelper.getAllRulesForRecord(scriptPayload);
                //console.dir(rules);

                /******************************************************
                ********             REVIEW FILE               ********
                *******************************************************/
                let _results = reviewFile(script, rules, scriptFName);
                /******************************************************/

                //Code smells
                if (!_results || _results.length <= 0) return [];

                let thisFileResults = _results[0];
                thisFileResults.fileName = scriptFName;
                thisFileResults.fileSysId = scriptPayload.sys_id;
                thisFileResults.updatedBy = scriptPayload.sys_updated_by;
                thisFileResults.class = scriptPayload.sys_class_name;
                thisFileResults.type = util.getTypeByClass(scriptPayload.sys_class_name);

                const scriptLines = script.split("\n");
                const noOfLines = scriptLines.length;
                thisFileResults.messages.forEach(rl => {
                    const errlineNo = rl.line - 1;
                    let stLineNo = errlineNo - 1 <= 0 ? 0 : errlineNo - 1;
                    let enLineNo = errlineNo + 1 >= noOfLines - 1 ? noOfLines : errlineNo + 2;
                    rl.source_lines = scriptLines.slice(stLineNo++, enLineNo).map(ln => {
                        return {
                            line: stLineNo++,
                            source: ln,
                            erClass: stLineNo - 2 == errlineNo ? "error" : ""
                        };
                    });
                });

                //console.log("Code smells count for (" + scriptFName + ") :: " + thisFileResults.errorCount);
                reviewResultsList.push(thisFileResults);
            } //}));

            const completeResultsObj = {
                reportRunAt: new Date(),
                instanceName: instance.getInstanceName(),
                instanceURL: instance.getFullURL,
                userName: instance.getUserName(),
                results: reviewResultsList
            };

            await appendFilesSource(reviewResultsList);

            if (global.json) {
                const _results = [];
                completeResultsObj.results.forEach(result => {
                    const _result = {};
                    _result.instance = completeResultsObj.instanceName;
                    _result.file = {
                        sysid: result.fileSysId,
                        type: result.class,
                        name: result.fileName
                    };
                    _result.reviews = result.messages
                        .filter(reviewObj => {
                            return global.showAllFindings ? true : reviewObj.developer != "UNKNOWN";
                        })
                        .map(reviewObj => {
                            return {
                                line: reviewObj.line,
                                ruleid: reviewObj.ruleId,
                                message: reviewObj.message,
                                developer: reviewObj.developer,
                                error_level: reviewObj.severity == 2 ? "error" : "warning" //TODO
                            };
                        });
                    _results.push(_result);
                });
                console.log(JSON.stringify(_results));
            } else {
                //Show in browser
                const htmlFilePath = resultsUtil.saveResultsToHTMLFile(completeResultsObj);
                if (!htmlFilePath) throw new Error("Error generating HTML file");
                openURLUtil.open("file://" + htmlFilePath);
            }
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to parse files");
            process.exit(1);
        }
    };

    const appendFilesSource = async function(reviewResults) {
        if (!Array.isArray(reviewResults)) return;

        const filesList = reviewResults.map(file => {
            return { fileType: file.class, fileSysId: file.fileSysId };
        });
        try {
            var devTags = await nowHelper.fetchMultipleFileTags(filesList);
            if (!devTags) throw new Error("DEBUG: Could not get dev tags");
        } catch (error) {
            console.log(error);
            return;
        }

        Object.keys(devTags).forEach(fileId => {
            const reviewDataObj = reviewResults.find(_file => _file.fileSysId == fileId);
            reviewDataObj.messages.forEach(rl => {
                const thisTagObj = devTags[fileId];
                // ex - {"shyam":[15,16,17,4,7,10],"chaitanya":[8,9,13,14],"anil.akula":[5,6],"admin.readonly":[3,11], "UNKNOWN": [2,1,23,22]}
                Object.entries(thisTagObj).forEach(entry => {
                    if (entry[1].indexOf(rl.line) >= 0 && entry[0] != "UNKNOWN") rl.developer = entry[0];
                });
                //if (!rl.developer) rl.developer = "UNKNOWN";
            });
        });
    };

    const reviewFileWithPayloadObj = function(payloadObj) {
        const fileName = payloadObj.sys_name;
        const script = payloadObj.script;
        // get matching rules for record
        const rules = ruleHelper.getAllRulesForRecord(payloadObj);

        //review file
        reviewFile(script, rules, fileName);
    };

    const reviewFiles = async function(filesObjArr) {
        if (!Array.isArray(filesObjArr)) return [];
        // Initialize instance
        await initialize();
        let reviewResultsList = [];

        try {
            //TODO :: change to functional approach
            //let reviewResults = await Promise.all(filesData.map(async (fileData) => {
            for (let i = 0; i < filesObjArr.length; i++) {
                const fileMetaData = filesObjArr[i];
                if (!fileMetaData.sys_id || !fileMetaData.type) continue;

                const scriptPayload = await nowHelper.fetchSNFile(fileMetaData.type, fileMetaData.sys_id);

                const script = scriptPayload.script;
                const scriptFName = scriptPayload.sys_name;
                //get matching rules for record
                const rules = await ruleHelper.getAllRulesForRecord(scriptPayload);
                //console.dir(rules);

                /******************************************************
                ********             REVIEW FILE               ********
                *******************************************************/
                let _results = reviewFile(script, rules, scriptFName);
                /******************************************************/

                //Code smells
                if (!_results || _results.length <= 0) return [];

                let thisFileResults = _results[0];
                thisFileResults.fileName = scriptFName;
                thisFileResults.fileSysId = scriptPayload.sys_id;
                thisFileResults.updatedBy = scriptPayload.sys_updated_by;
                thisFileResults.class = scriptPayload.sys_class_name;
                thisFileResults.type = util.getTypeByClass(scriptPayload.sys_class_name);

                const scriptLines = script.split("\n");
                const noOfLines = scriptLines.length;
                thisFileResults.messages.forEach(rl => {
                    const errlineNo = rl.line - 1;
                    let stLineNo = errlineNo - 1 <= 0 ? 0 : errlineNo - 1;
                    let enLineNo = errlineNo + 1 >= noOfLines - 1 ? noOfLines : errlineNo + 2;
                    rl.source_lines = scriptLines.slice(stLineNo++, enLineNo).map(ln => {
                        return {
                            line: stLineNo++,
                            source: ln,
                            erClass: stLineNo - 2 == errlineNo ? "error" : ""
                        };
                    });
                });

                //console.log("Code smells count for (" + scriptFName + ") :: " + thisFileResults.errorCount);
                reviewResultsList.push(thisFileResults);
            } //}));

            const completeResultsObj = {
                reportRunAt: new Date(),
                instanceName: instance.getInstanceName(),
                instanceURL: instance.getFullURL,
                userName: instance.getUserName(),
                results: reviewResultsList
            };

            await appendFilesSource(reviewResultsList);

            if (global.json) {
                const _results = [];
                completeResultsObj.results.forEach(result => {
                    const _result = {};
                    _result.instance = completeResultsObj.instanceName;
                    _result.file = {
                        sysid: result.fileSysId,
                        type: result.class,
                        name: result.fileName
                    };
                    _result.reviews = result.messages
                        .filter(reviewObj => {
                            return global.showAllFindings ? true : reviewObj.developer != "UNKNOWN";
                        })
                        .map(reviewObj => {
                            return {
                                line: reviewObj.line,
                                ruleid: reviewObj.ruleId,
                                message: reviewObj.message,
                                developer: reviewObj.developer,
                                error_level: reviewObj.severity == 2 ? "error" : "warning" //TODO
                            };
                        });
                    _results.push(_result);
                });
                console.log(JSON.stringify(_results));
            } else {
                //Show in browser
                const htmlFilePath = resultsUtil.saveResultsToHTMLFile(completeResultsObj);
                if (!htmlFilePath) throw new Error("Error generating HTML file");
                openURLUtil.open("file://" + htmlFilePath);
            }
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to parse files");
            process.exit(1);
        }
    };

    const reviewFile = function(script, rules, fileName) {
        if (!script || !Array.isArray(rules)) return;

        // LINT SCRIPTS HERE
        var cli = new CLIEngine({
            envs: ["browser", "mocha"],
            useEslintrc: false,
            rules: _getRulesObject(rules),
            rulePaths: [__dirname + "/.." + RCR.snow_rules_dir]
        });

        //var report = cli.executeOnFiles(["files/"]); //if files are saved in folder
        var report = cli.executeOnText(script, fileName); //TODO : fileName

        return report.results || [];
    };

    return {
        reviewUpdateSet,
        reviewScopedApp,
        reviewDeltaFiles,
        reviewFiles,
        reviewFileWithPayloadObj,
        reviewFile
    };
})();
