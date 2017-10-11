/**
 * @fileoverview Fetch update set or scoped files from instance
 * @author Pradeep Gouribhatla
 */

"use strict";

const fs = require("fs"),
    parseXML = require("xml2js").parseString,
    instance = require("./instance"),
    RCR = require("../config/rcr_constants");

module.exports = (function() {
    //Initialze/fetch instnace data. If instance not configured. Throw an error.
    const initialize = async function() {
        if (instance.isConfigured()) return;
        try {
            (async function() {
                await instance.initialize();
            })();
        } catch (error) {
            throw new Error("Instance not configured");
        }
    };

    const fetchUpdateSetFiles = async function(updateSetId) {
        // Initialize instance
        await initialize();

        if (!updateSetId || !instance.isConfigured()) return;
        //update_set=<sys_id>^type=Client Script^ORtype=Script Include
        try {
            const insHttp = instance.getThisInstanceHttp();
            const typeQuery = RCR.supported_file_types
                .map((ftype, i) => "^" + (i > 0 ? "OR" : "") + "type=" + ftype)
                .join("");

            const res = await insHttp.request({
                method: "GET",
                url: instance.getFullURL() + RCR.update_set_api,
                params: {
                    sysparm_query: RCR.update_set_api_query + updateSetId + typeQuery,
                    sysparm_fields: RCR.update_set_api_field_params
                }
            });

            if (res && res.status == 200) {
                if (!res.data || !Array.isArray(res.data.result) || res.data.result.length <= 0) {
                    console.log("Oops! No script files found in the given update set.");
                    return [];
                }
                //console.log(JSON.stringify(res.data));

                return res.data.result;
            } else {
                throw new Error("Oops!! Something went wrong. Failed to fetch fetching update set files");
            }
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to fetch fetching update set files");
            process.exit(1);
        }
    };

    const fetchAndSaveUpdateSetFiles = async function(updateSetId) {
        let filesData = await fetchUpdateSetFiles(updateSetId);
        if (!Array.isArray(filesData)) return;
        try {
            //TODO
            // save files into respective folders
            filesData.forEach(script => {
                const scriptFName = script.target_name;
                const scriptPayload = script.payload;
                const scriptWithPathName = "./files/" + scriptFName + ".js";
                parseXML(scriptPayload, (err, result) => {
                    if (err) {
                        console.error("Error parsing file : " + scriptWithPathName);
                        console.log(err);
                        return;
                    }

                    const script = result.record_update.sys_script_include[0].script[0];
                    fs.writeFile(scriptWithPathName, script, err => {
                        if (err) {
                            console.error("Error parsing file : " + scriptWithPathName);
                            console.log(err);
                            return;
                        }
                        if (global.debug) console.log(scriptFName + " File saved succesfully");
                    });
                });
            });
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to save update set files locally");
            process.exit(1);
        }
    };

    const fetchSNFile = async function(fileClass, fileSysID) {
        if (!fileClass || !fileSysID) return;

        const insHttp = instance.getThisInstanceHttp();
        const res = await insHttp.get(RCR.table_api_url + fileClass + "/" + fileSysID);

        if (res && res.status == 200) {
            if (!res.data || !res.data.result) {
                console.log("Oops! No data found in the script file.");
                return;
            }
            return res.data.result;
        } else {
            throw new Error("Oops!! Failed to fetch file" + fileClass + ":" + fileSysID);
        }
    };

    const fetchScopedAppFiles = async function(scopedAppId) {
        // Initialize instance
        await initialize();

        /*
            1. Fetch meta data from sys_meta_data
            2. For each file.. 
                get the JSON/XML payload
                ex- http://127.0.0.1:8080//api/now/v1/table/sys_script/8ca8447b0b010300eabacdd425673a2a
            3. Accumulate all the results and display 
        */
        if (!scopedAppId || !instance.isConfigured()) return;
        let scopedAppFiles = [];

        try {
            const insHttp = instance.getThisInstanceHttp();
            const typeQuery = RCR.supported_classes
                .map((ftype, i) => "^" + (i > 0 ? "OR" : "") + "sys_class_name=" + ftype)
                .join("");

            const res = await insHttp.request({
                method: "GET",
                url: instance.getFullURL() + RCR.scoped_app_api + scopedAppId,
                params: {
                    sysparm_query: typeQuery,
                    sysparm_fields: RCR.scoped_app_api_field_params
                }
            });
            if (res && res.status == 200) {
                if (!res.data || !Array.isArray(res.data.result) || res.data.result.length <= 0) {
                    console.log("Oops! No files found in the given update set.");
                    return [];
                }
                //console.dir(JSON.stringify(res.data));
                const scopedAppFilesMetaData = res.data.result;

                for (let index = 0; index < scopedAppFilesMetaData.length; index++) {
                    let metaData = scopedAppFilesMetaData[index];
                    const fileClass = metaData.sys_class_name;
                    const fileSysID = metaData.sys_id;
                    const filePayload = await fetchSNFile(fileClass, fileSysID);

                    if (filePayload) scopedAppFiles.push(filePayload);
                }
            } else {
                throw new Error("Oops!! Something went wrong. Failed to fetch fetching update set files");
            }
            return scopedAppFiles;
        } catch (error) {
            console.error("Oops!! Something went wrong. Failed to fetch fetching update set files");
            process.exit(1);
        }
    };

    const fetchAndSaveScopedAppFiles = async function(scopedAppId) {
        var filesData = fetchScopedAppFiles(scopedAppId);
        if (!filesData) return;

        //TODO
        // save files into respective folders
    };

    const fetchDeltaFiles = async function(deltaDays) {
        // Initialize instance
        await initialize();
        let instanceDeltaFiles = [];

        //let instanceDeltaFiles = await Promise.all(RCR.supported_classes.map(async (scriptClass) => {
        for (let cl = 0; cl < RCR.supported_classes.length; cl++) {
            let thisClassFiles = [];
            const scriptClass = RCR.supported_classes[cl];
            try {
                thisClassFiles = await fetchDeltaFilesByType(scriptClass, deltaDays);
            } catch (error) {
                console.error("Error fetching the delta days filed for type : " + scriptClass);
            }

            instanceDeltaFiles.push(...thisClassFiles);
        }
        //}));

        return instanceDeltaFiles;
    };

    const fetchDeltaFilesByType = async function(scriptClass, deltaDays) {
        //initialize();
        if (!scriptClass || !deltaDays || !instance.isConfigured()) return;
        let thisClassFiles = [];

        const insHttp = instance.getThisInstanceHttp();
        const sysparmQuery = RCR.delta_files_api_query.replace("__deltadays__", deltaDays);
        try {
            const res = await insHttp.get(RCR.table_api_url + scriptClass + "?" + sysparmQuery);
            if (res && res.status == 200) {
                if (!res.data || !Array.isArray(res.data.result) || res.data.result.length <= 0) {
                    if (global.debug) console.log("DEBUG : No files found for type : " + scriptClass);
                } else {
                    thisClassFiles = res.data.result;
                }
            }
        } catch (error) {
            if (error.response.status == 404) {
                if (global.debug) console.log("DEBUG : No files found for type : " + scriptClass);
                return thisClassFiles;
            }
        }

        return thisClassFiles;
    };

    const fetchAndSaveDeltaFiles = async function(deltaDays) {
        var filesData = fetchDeltaFiles(deltaDays);
        if (!filesData) return;

        //TODO
        // save files into respective folders
    };

    const fetchMultipleFileTags = async function(filesList) {
        if (!Array.isArray(filesList)) return;

        const insHttp = instance.getThisInstanceHttp();
        const res = await insHttp.request({
            method: "POST",
            url: instance.getFullURL() + RCR.file_tags_api,
            data: JSON.stringify(filesList)
        });

        //console.dir(res);

        if (res && res.status == 200) {
            if (!res.data || !res.data.result) {
                console.log("Oops! No data found in the script file.");
                return;
            }
            return res.data.result;
        } else {
            throw new Error("Oops!! Failed to fetch tags -> " + fileType + ":" + fileSysID);
        }
    };

    const fetchFileTags = async function(fileType, fileSysID) {
        if (!fileClass || !fileSysID) return;

        const insHttp = instance.getThisInstanceHttp();
        const res = await insHttp.request({
            method: "POST",
            url: getFullURL() + RCR.file_tags_api,
            data: JSON.stringify([{ fileSysId, fileType }])
        });

        if (res && res.status == 200) {
            if (!res.data || !res.data.result) {
                console.log("Oops! No data when fetching tags");
                return;
            }
            return res.data.result;
        } else {
            throw new Error("Oops!! Failed to fetch tags -> " + fileType + ":" + fileSysID);
        }
    };

    return {
        fetchUpdateSetFiles,
        fetchAndSaveUpdateSetFiles,
        fetchScopedAppFiles,
        fetchAndSaveScopedAppFiles,
        fetchDeltaFiles,
        fetchDeltaFilesByType,
        fetchAndSaveDeltaFiles,
        fetchSNFile,
        fetchMultipleFileTags,
        fetchFileTags
    };
})();
