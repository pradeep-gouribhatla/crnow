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

    async function _getFilePayload(xmlPayload, scriptClass, scriptFName) {
        try {
            let simpleRecordObj = {};
            let payloadObj = await parseXMLWrapper(xmlPayload);
            let recordObj = payloadObj["record_update"][scriptClass][0];
            Object.keys(recordObj).forEach(attr => (simpleRecordObj[attr] = recordObj[attr][0]));
            if (payloadObj["record_update"]["sys_app_file"]) {
                let appFileObj = payloadObj["record_update"]["sys_app_file"][0];
                Object.keys(appFileObj).forEach(attr => (simpleRecordObj[attr] = appFileObj[attr][0]));
            } else {
                simpleRecordObj.sys_class_name = scriptClass;
            }
            return simpleRecordObj;
        } catch (error) {
            console.error("Error parsing file : " + scriptFName);
            if (global.debug) console.error(error);
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

    function printJsonToCmdLine(resultsObj) {
        if (!resultsObj || !Array.isArray(resultsObj.results)) return;

        const reviewResults = resultsObj.results.map(result => {
            const _result = {};
            _result.instance = resultsObj.instanceName;
            _result.file = {
                sysid: result.fileSysId,
                type: result.class,
                name: result.fileName,
                versionId: result.versionSysId
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
            return _result;
        });

        // filter out the results with no findings(ex- if no developer found, we ignore messages in delta case)
        const _cmdLineOutput = reviewResults.filter(rObj => rObj.reviews.length > 0);

        console.log(JSON.stringify(_cmdLineOutput));
    }

    //Show results in browser
    function showResultsInBrowser(resultsObj) {
        if (!resultsObj || !Array.isArray(resultsObj.results)) return;

        if (!global.showAllFindings) {
            resultsObj.results = resultsObj.results.filter(result => {
                result.messages = result.messages.filter(reviewObj => reviewObj.developer != "UNKNOWN");
                return result.messages.length > 0;
            });
        }

        const htmlFilePath = resultsUtil.saveResultsToHTMLFile(resultsObj);
        if (!htmlFilePath) throw new Error("Error generating HTML file");
        openURLUtil.open("file://" + htmlFilePath);
    }

    function displayResults(findingsList, view) {
        const completeResultsObj = {
            reportRunAt: new Date(),
            instanceName: instance.getInstanceName(),
            instanceURL: instance.getFullURL,
            userName: instance.getUserName(),
            results: findingsList
        };

        if (global.json || view == "JSON") {
            printJsonToCmdLine(completeResultsObj);
        } else {
            showResultsInBrowser(completeResultsObj);
        }
    }

    async function appendFilesSource(reviewResults) {
        if (!Array.isArray(reviewResults)) return;

        const filesList = reviewResults.map(file => {
            return { fileType: file.class, fileSysId: file.fileSysId };
        });

        // Get version Ids for the files
        // try {
        //     var versionIdsMap = await nowHelper.fetchFileVersions(filesList);
        // } catch (error) {
        //     console.log(error);
        // }

        // Get developer for the findings
        try {
            var devTags = await nowHelper.fetchMultipleFileTags(filesList);
            if (!devTags) throw new Error("DEBUG: Could not get dev tags");

            devTags.forEach(fileObj => {
                const reviewDataObj = reviewResults.find(_file => _file.fileSysId == fileObj.fileSysId);
                if (!reviewDataObj || !Array.isArray(reviewDataObj.messages)) return;

                reviewDataObj.versionSysId = fileObj.versionSysId;
                reviewDataObj.messages.forEach(rl => {
                    Object.entries(fileObj.tags).forEach(entry => {
                        if (entry[1].indexOf(rl.line) >= 0) rl.developer = entry[0];
                    });
                    if (!rl.developer) rl.developer = "UNKNOWN";
                });
            });
            //console.dir(reviewResults);
        } catch (error) {
            console.log(error);
            return;
        }
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

            //let filesPayloadList = filesData.map(async (fileData) => {});

            //movee this to different function
            let filesPayloadList = [];
            for (let i = 0; i < filesData.length; i++) {
                let fileData = filesData[i];
                const xmlPayload = fileData.payload;
                const scriptFName = fileData.target_name;
                const _lastIndex = fileData.name.lastIndexOf("_");
                const scriptClass = fileData.name.substring(0, _lastIndex);

                const scriptPayload = await _getFilePayload(xmlPayload, scriptClass, scriptFName);
                filesPayloadList.push(scriptPayload);
            } //}));

            let reviewResultsList = getReviewsForFilePayloads(filesPayloadList);

            displayResults(reviewResultsList);
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to parse the update set files");
            if (global.debug) console.error(error);
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
            let reviewResultsList = getReviewsForFilePayloads(filesData);

            await appendFilesSource(reviewResultsList);

            displayResults(reviewResultsList);
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to parse the scoped app files");
            if (global.debug) console.error(error);
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

        let filesPayloadList = await nowHelper.fetchDeltaFiles(deltaDays);
        if (!Array.isArray(filesPayloadList) || filesPayloadList.length == 0) {
            console.log("Oops! Could not find any files which are updates in last " + deltaDays + " days");
            return;
        }

        try {
            let reviewResultsList = getReviewsForFilePayloads(filesPayloadList);

            await appendFilesSource(reviewResultsList);

            displayResults(reviewResultsList);
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to review files");
            if (global.debug) console.log(error);
            process.exit(1);
        }
    };

    const reviewFiles = async function(filesObjArr) {
        if (!Array.isArray(filesObjArr)) return [];
        // Initialize instance
        await initialize();
        let reviewResultsList = [];

        try {
            //TODO :: change to functional approach
            //let reviewResults = await Promise.all(filesObjArr.map(async (fileMetaData) => {
            for (let i = 0; i < filesObjArr.length; i++) {
                const fileMetaData = filesObjArr[i];
                if (!fileMetaData.sys_id || !fileMetaData.type) continue;

                const scriptPayload = await nowHelper.fetchSNFile(fileMetaData.type, fileMetaData.sys_id);

                if (!scriptPayload) continue;

                let fileResults = reviewFileWithPayloadObj(scriptPayload);

                reviewResultsList.push(fileResults);
            } //}));

            await appendFilesSource(reviewResultsList);

            displayResults(reviewResultsList);
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to parse files");
            process.exit(1);
        }
    };

    const reviewFileWithPayloadObj = function(scriptPayload) {
        if (!scriptPayload) return;

        const script = scriptPayload.script;
        const scriptFName = scriptPayload.sys_name || scriptPayload.name;
        //get matching rules for record
        const rules = ruleHelper.getAllRulesForRecord(scriptPayload);
        //console.dir(rules);

        /******************************************************
        ********             REVIEW FILE               ********
        *******************************************************/
        let _results = reviewFile(script, rules, scriptFName);
        /******************************************************/

        //Code smells
        if (!_results || _results.length <= 0) return [];

        let fileResults = _results[0];
        fileResults.fileName = scriptFName;
        fileResults.fileSysId = scriptPayload.sys_id;
        fileResults.updatedBy = scriptPayload.sys_updated_by;
        fileResults.class = scriptPayload.sys_class_name || scriptPayload.sys_source_table;
        fileResults.type = util.getTypeByClass(fileResults.class);

        const scriptLines = script.split("\n");
        const noOfLines = scriptLines.length;
        fileResults.messages.forEach(rl => {
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

        if (global.debug) console.log("Code smells count for (" + scriptFName + ") :: " + fileResults.errorCount);

        return fileResults;
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

    const getReviewsForFilePayloads = function(payloadsList) {
        if (!Array.isArray(payloadsList)) return [];

        return payloadsList.map(reviewFileWithPayloadObj);
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
