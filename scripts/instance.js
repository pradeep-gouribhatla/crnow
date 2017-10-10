/**
 * @fileoverview ServiceNow instance specific config and http calls
 * @author Pradeep Gouribhatla
 */

"use strict";

const fs = require("fs"),
    path = require("path"),
    axios = require("axios"),
    xml2js = require("xml2js"),
    parseString = require("xml2js").parseString,
    progressBar = require("progress"),
    util = require("./basic-util"),
    RCR = require("../config/rcr_constants");

module.exports = (function() {
    //current service now instance config
    let _iConfigObject = null;
    let _isValidInstance = false;
    let _isInstanceConfigured = false;
    let _instanceHttpClient = null;

    //   TODO::
    var bar;

    //error template for all the functions here
    let err = {};

    /*
        Initialize to current configured instance,
        if no instance configured ==> TODO
    */
    const initialize = async function() {
        // Read existing configuration from instance config file
        try {
            try {
                var data = fs.readFileSync(__dirname + "/.." + "/config/instance.xml", "utf-8");
                //console.log(data);
            } catch (error) {
                if (error.errno == -2) {
                    util.showInfoLevelMessage("Instance not configured. Please configure using below cmds");
                    util.showHelpText();
                }
                return;
            }

            parseString(data, (err, jsonObj) => {
                if (err) throw new Error("Reading config file failed. Try re-configuring rcr");

                const configObjArray = jsonObj.root ? jsonObj.root["ins-node"] : [];
                if (!configObjArray || !Array.isArray(configObjArray))
                    throw new Error("Reading config file failed. Try re-configuring rcr");

                const configObject = configObjArray.find(configObj => configObj.instanceName[0] == global.instanceName);

                if (!configObject) throw new Error("Instance not configured.");

                _iConfigObject = {
                    instanceName: configObject.instanceName[0],
                    userName: configObject.userName[0],
                    password: configObject.password[0]
                };

                _isInstanceConfigured = true;

                setThisInstanceHttp();

                console.log("DEBUG : Retrieved instance config");
            });
        } catch (error) {
            console.log(error);
        }
    };

    const getInstanceConfig = async function() {
        if (!isConfigured()) return;
        return _iConfigObject;
    };

    /*
        Get the custom axios http client specific to this instance
    */
    const getThisInstanceHttp = function() {
        if (!_instanceHttpClient) setThisInstanceHttp();

        return _instanceHttpClient;
    };

    const setThisInstanceHttp = function() {
        if (!isConfigured()) return;

        _instanceHttpClient = axios.create({
            baseURL: getFullURL()
        });
        _instanceHttpClient.defaults.timeout = RCR.http_client_timeout;
        _instanceHttpClient.defaults.headers.common["Authorization"] = getAuthHeader();
        _instanceHttpClient.defaults.headers.post["Content-Type"] = "application/json";
        _instanceHttpClient.defaults.headers.put["Content-Type"] = "application/json";

        return _instanceHttpClient;
    };

    const saveInstanceData = async function(instanceName, userName, password) {
        const configObject = {
            instanceName,
            userName,
            password
        };
        saveToConfig(configObject);
    };

    /*
        Cofigure snow instance and save to config file
        @args : instanceName, userName, password
        @return : boolean
    */
    const configure = async function(instanceName, userName, password) {
        if (!instanceName || !userName || !password) {
            throw new Error("Not valid instance data");
        }

        _iConfigObject = {
            instanceName,
            userName,
            password
        };

        const resp = await verifyInstanceData(_iConfigObject);

        if (resp == 200) {
            _isValidInstance = true;
            saveToConfig(_iConfigObject);
            return _iConfigObject;
        } else if (resp == 403) {
            throw new Error("User should have admin role in the service now instance");
        } else if (resp == "ENOTFOUND") {
            throw new Error("Invalid instance name/url");
        } else if (~~resp >= 400) {
            throw new Error("Invalid credentials");
        } else {
            throw new Error("Not valid instance data.");
        }
    };

    /*
        Verify
        1. Instance URL and credentials
        2. If user has admin access
        @arg : instanceConfig (instanceName, userName, password)
        @return : boolean
    */
    const verifyInstanceData = async function(instanceConfig) {
        console.log("RCR Setup : Verifying instance data");
        //REVISIT : For now checking update set table access
        if (!instanceConfig) return;
        try {
            //REVISIT
            const _httpReq = axios.create({ baseURL: getFullURL() });
            _httpReq.defaults.timeout = RCR.http_client_timeout;
            _httpReq.defaults.headers.common["Authorization"] = getAuthHeader();
            const res = await _httpReq.get(RCR.snow_update_set_check_url);
            //console.log(res); //TODO: removing log did not work
            if (res && res.status == 200) {
                _isValidInstance = true;
                console.log("RCR Setup : Instance and user data verified");
                return 200;
            } else {
                return;
            }
        } catch (error) {
            if (error.response && ~~error.response.status > 400) {
                return parseInt(error.response.status);
            } else if (error.code == "ENOTFOUND") {
                console.log(error.message);
                return "ENOTFOUND";
            } else {
                console.log("Failed connecting to service now instance. Check your internet connection");
                //console.log(error);
            }
        }
    };

    /*
    const saveToConfig = function(configObject) {
        if (!configObject) return;
        try {
            const xml_builder = new xml2js.Builder();
            const ins_config_xml = xml_builder.buildObject({ "ins-node": configObject });

            fs.writeFileSync(__dirname + "/.." + "/config/instance.xml", ins_config_xml);
            console.log("RCR Setup : Instance config saved to xml file");

            return (_isInstanceConfigured = true);
        } catch (err) {
            console.error(err);
        }
    };
    */

    /*
        Create a xml file with instance URL and user credentials
        TODO:: Should we save encrypted password or atleast basic auth header.
        @arg : instanceConfig (instanceName, userName, password)
        @return : boolean
    */
    const saveToConfig = function(configObject) {
        if (!configObject) return;

        try {
            const xml_builder = new xml2js.Builder();
            const configFile = __dirname + "/../config/instance.xml";

            const fileExists = fs.existsSync(configFile);
            if (!fileExists) {
                fs.writeFileSync(configFile, xml_builder.buildObject({ root: { "ins-node": [] } }));
            }

            try {
                var data = fs.readFileSync(configFile, "utf-8");
                parseString(data, (err, jsonObj) => {
                    if (err) throw new Error("Reading config file failed. Try re-configuring rcr");

                    const allData = jsonObj.root ? jsonObj.root : { "ins-node": [] };
                    const configObjArray = allData["ins-node"];
                    const insNodeObj = Object.assign(configObject, { $: { name: configObject.instanceName } });
                    configObjArray.push(insNodeObj);
                    const ins_config_xml = xml_builder.buildObject({ root: allData });

                    fs.writeFileSync(configFile, ins_config_xml);
                });
            } catch (error) {
                console.log(error);
                process.exit(1);
            }

            console.log("RCR Setup : Instance config saved to xml file");

            return (_isInstanceConfigured = true);
        } catch (err) {
            console.error(err);
        }
    };

    /*
        Return if instance data is valid(user as well) and configured in xml
        @arg : NA
        @return : boolean
    */
    const isConfigured = function() {
        return _isInstanceConfigured;
    };

    /*
        Return current configured instance basic auth header
        @arg : NA
        @return : Auth header
    */
    const getEncryptedPassword = function(configObject) {
        if (!configObject.password) return;
        return configObject.password;
    };

    /*
        Return current configured instance basic auth header
        @arg : NA
        @return : Auth header
    */
    const getAuthHeader = function() {
        if (!_iConfigObject.userName || !_iConfigObject.password) return;
        let auth_token = "Basic ";
        auth_token += Buffer.from(_iConfigObject.userName + ":" + _iConfigObject.password).toString("base64");
        return auth_token;
    };

    /*
        Return current configured instance url
        @return : instance URL
    */
    const getFullURL = function() {
        if (!_iConfigObject || !_iConfigObject.instanceName) return;

        if (_iConfigObject.instanceName == "localhost") {
            return "http://127.0.0.1:8080";
        } else if (_iConfigObject.instanceName.indexOf("127.0.0.1") >= 0) {
            return "http://" + _iConfigObject.instanceName;
        } else {
            return "https://" + _iConfigObject.instanceName + RCR.DOMAIN;
        }
    };

    /*
        @return : current configured instance name
    */
    const getInstanceName = function() {
        if (!_iConfigObject) return;
        return _iConfigObject.instanceName;
    };

    /*
        @return : current configured admin username
    */
    const getUserName = function() {
        if (!_iConfigObject) return;
        return _iConfigObject.userName;
    };

    /*
        verify if scoped app is available in current configured instance
        @arg : NA
        @return : Auth header
    */
    const checkForUpdatedScopedApp = function(scopedAppName) {
        return false;
    };

    /*
        Upload scoped app to current configured instance
        @arg : NA
        @return : Auth header
    */
    const uploadScopedApp = async function(gitURL) {
        try {
            if (!getThisInstanceHttp() || !gitURL) return;
            const res = await _instanceHttpClient.request({
                method: "POST",
                url: getFullURL() + RCR.scoped_app_api_url,
                data: JSON.stringify({
                    url: gitURL,
                    setTestConnection: false
                })
            });

            if (res && res.status == 202) {
                if (!res.data) throw new Error("Oops! No data returned while applying scoped app. Retry Configuring");

                //console.log(JSON.stringify(res.data));
                let responseObj = res.data.result;
                if (responseObj && responseObj.progressId) {
                    const progressId = responseObj.progressId;
                    console.log("RCR Setup : Applying scoped app, progressId : " + responseObj.progressId);
                    bar = new progressBar("RCR Setup : Uploading RCR scoped app [:bar] :rate/bps :percent :etas", {
                        complete: "=",
                        incomplete: " ",
                        width: 25,
                        total: 100
                    });
                    bar.update(0);
                    const uploadPer = await getAppUploadStatus(progressId, bar);
                    if (uploadPer == 100) {
                        bar.update(uploadPer * 0.01);
                        console.log("RCR Setup : Scoped App uploaded succesfully");
                    }
                    return !!uploadPer;
                } else {
                    throw new Error(
                        "Hmmmm... This should not happen!! Applying scoped app did not return progressId. Debug Now."
                    );
                }
            } else {
                console.dir(res);
                throw new Error("Oops!! No data returned while applying scoped app. Retry Configuring");
            }
        } catch (error) {
            console.error("RCR Setup : Uploading scoped app failed", error);
            process.exit(1);
        }
    };

    const getAppUploadStatus = async function(progressId, bar, prevProgress = 0) {
        if (!progressId || !getThisInstanceHttp()) return false;

        const res = await _instanceHttpClient.request({
            method: "GET",
            url: getFullURL() + RCR.scoped_app_status_uri + progressId
        });

        if (res && res.status == 200) {
            if (!res.data || !res.data.result)
                throw new Error("Oops! No data returned while checking scoped app upload. Retry Configuring");

            let responseObj = res.data.result;
            if (responseObj && responseObj.percentComplete) {
                const perCompleted = ~~responseObj.percentComplete;
                if (responseObj.percentComplete == 100) {
                    //if (bar) bar.clear(); TODO :: check this
                    return 100;
                } else {
                    //console.log(perCompleted);

                    // if (bar) bar.tick(perCompleted);
                    if (bar && perCompleted > prevProgress) bar.update(perCompleted * 0.01);
                    //else console.log("Uploading scoped app : " + perCompleted + "%");
                    await sleep(1200);
                    return await getAppUploadStatus(progressId, bar, perCompleted);
                }
            } else {
                throw new Error("Hmmmm... This should not happen!! Debug Now.");
            }
        }
        //TODO: move this to uitl
        // Also : Should we use this? it blocks the execution.. check Promise.all approach
        function sleep(ms = 500) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    };

    /*
        @arg : 
        @return :
    */
    const getResource = function() {};

    /*
        @arg : 
        @return : 
    */
    const putResource = function() {};

    /*
        Configure initial setup 
    */
    const configureRCRprerequisites = async function() {
        //  Uploading scoped app (RCR client)
        await uploadRCRClientApp(RCR.rcr_scoped_git_repo);

        //  Update SysUpdateVersion table read access
        await configureSysUpdateVersionAccess();
    };

    const instanceHasRCRScopedApp = async function() {
        if (!getThisInstanceHttp()) return;
        const res = await _instanceHttpClient.request({
            method: "GET",
            url: RCR.scoped_app_search_query
        });

        if (res && res.status == 200) {
            if (!res.data || !res.data.result)
                throw new Error("Oops! No data returned while verifying scoped app. Retry Configuring");

            const responseObj = res.data.result[0];
            //console.dir(responseObj);

            if (responseObj && responseObj.scope == RCR.scoped_app_name) {
                console.log("RCR Setup : Scoped App already avaialable");
                return true;
            }
        } else {
            throw new Error("Oops!! No data returned while verifying scoped app. Retry Configuring");
        }
        console.log("RCR Setup : Scoped App not avaialable on instance");
        return false;
    };
    /*
        Upload RCR ClientApp to instance
        @arg : NA
        @return : Auth header
    */
    const uploadRCRClientApp = async function() {
        // Check if the instance already has RCR client scoped app
        const instanceHasScopedApp = await instanceHasRCRScopedApp();

        if (!instanceHasScopedApp) await uploadScopedApp(RCR.rcr_scoped_git_repo);

        return this;
    };

    /*
        Make a call to instance and set the read_access to true on 'sys_db_obj'
        @arg : NA
        @return : boolean
    */
    const configureSysUpdateVersionAccess = async function() {
        const record = await getSysUpdateVersionObj();
        //console.dir(record);
        if (record.read_access == true || record.read_access == "true") {
            console.log("RCR setup : Already has sys update version access");
            return;
        }
        if (!record.table_sys_id) throw new Error("Updating sys_update_version read acces failed.");

        console.log("RCR setup : Providing read access to sys update version table");
        const res = await setSysUpdateVersionAccess(record.table_sys_id);
        return res;
    };

    /*
        @arg : NA
        @return : SysUpdateVersionObj
        curl -u 'admin':'admin' --header "Content-Type:application/json"  --header "Accept: application/json"  
        --request GET http://127.0.0.1:8080/api/now/v1/table/sys_db_object?sysparm_query=name%3Dsys_db_object
    */
    const getSysUpdateVersionObj = async function() {
        try {
            if (!getThisInstanceHttp()) return;

            let res = await _instanceHttpClient.request({
                method: "GET",
                url: RCR.sys_db_obj_search_query
            });

            if (res && res.status == 200) {
                if (!res.data) {
                    console.dir(res);
                    throw new Error("Oops! No data returned while call to sys_update_version. Retry Configuring");
                }
                //console.log(JSON.stringify(res.data));
                let responseObj = res.data.result;
                if (responseObj && responseObj.length > 0) {
                    const read_access = responseObj[0]["read_access"];
                    return {
                        read_access: read_access == "true" ? true : false,
                        table_sys_id: responseObj[0]["sys_id"]
                    };
                }
            } else {
                //console.log(JSON.stringify(res));
                throw new Error("Oops! No data returned while call to sys_update_version. Retry Configuring");
            }
        } catch (ex) {
            console.error("RCR Setup : Get sys_update_version read access value", ex);
            process.exit(1);
        }
    };

    /*
        Make a call to instance and set the read_access to true on 'sys_db_obj'
        @arg : NA
        @return : boolean 
        >> curl --user admin:admin  --header "Content-Type:application/json"  --header "Accept: application/json"  
            --request PUT  --data '{"read_access":"true"}'  http://10.166.71.113:8080/api/now/v1/table/sys_db_object/5d1873030b300300eabacdd425673a21

    */
    const setSysUpdateVersionAccess = async function(table_sys_id) {
        if (!table_sys_id) {
            console.error("Updating sys_update_version read acces failed.");
            return;
        }

        try {
            if (!getThisInstanceHttp()) return;

            let res = await _instanceHttpClient.request({
                url: getFullURL() + RCR.sys_db_obj_url + table_sys_id,
                method: "PUT",
                data: '{"read_access":"true"}'
            });

            if (res && res.status == 200) {
                if (!res.data) throw new Error("Oops! No data returned while applying scoped app. Retry Configuring.");

                const read_access = res.data.result && res.data.result[0][read_access];
                if (read_access == "true" || read_access == true) {
                    console.log("RCR setup : Sys update version access granted");
                } else {
                    console.log("Hmm.. This should not happen!! sys_update_version set access failed. Debug Now.");
                    throw new Error("Someone must know!!");
                }

                return read_access == "true" || read_access == true;
            } else {
                //console.log(JSON.stringify(res));
                throw new Error("Oops! No data returned while sys_update_version set access call. Retry Configuring");
            }
        } catch (ex) {
            console.error("RCR Setup : Updating sys_update_version read access FAILED", ex);
            process.exit(1);
        }
    };

    // (async function() {
    //     await initialize();
    // })();

    return {
        initialize,
        isConfigured,
        getAuthHeader,
        getFullURL,
        getUserName,
        getInstanceName,
        getThisInstanceHttp,
        configure,
        saveToConfig,
        uploadScopedApp,
        getResource,
        putResource,
        getSysUpdateVersionObj,
        uploadRCRClientApp, //TODO: move to other file
        configureSysUpdateVersionAccess, //TODO: move to other file
        configureRCRprerequisites //TODO: move to other file
    };
})();
