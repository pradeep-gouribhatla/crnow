/**
 * @fileoverview Deals with instance configuration to 'crnow' module.
 * @author Pradeep Gouribhatla
 */

"use strict";

const fs = require("fs"),
    nodePath = require("path"),
    inquirer = require("inquirer"),
    git = require("simple-git/promise"),
    instance = require("./instance"),
    util = require("./basic-util"),
    RCR = require("../config/rcr_constants");

module.exports = (function() {
    const questions = [
        {
            name: "instanceName",
            type: "input",
            message: "Enter your servicenow instance name (ex - nowdev002 )",
            validate: function(value) {
                if (value.length) return true;
                else return "Please enter your instance name";
            }
        },
        {
            name: "userName",
            type: "input",
            message: "Username :",
            validate: function(value) {
                if (value.length) return true;
                else return "Please enter your username";
            }
        },
        {
            name: "password",
            type: "password",
            message: "Password (this will be stored loacally):",
            validate: function(value) {
                if (value.length) return true;
                else return "Please enter your username";
            }
        }
    ];

    /**
     * @returns instance configuration
     */
    const getInstanceConfiguration = async function() {
        //prompt user for instance info
        // inquirer.prompt(questions).then(callback);
        console.log(
            "Enter your instance credentials. The user whose credentials are " +
                "provided *should* have admin role (Password will be stored loacally) "
        );
        const instanceData = await inquirer.prompt(questions);
        return instanceData;
    };

    const configureInstance = async function(configObject) {
        if (!configObject) {
            throw new Error("Empty instance config object");
        }

        //configure instance data
        //btoa(configObject.userName + ":" + configObject.password);
        const basicAuthStr = Buffer.from(configObject.userName + ":" + configObject.password).toString("base64");
        await instance.configure(configObject.instanceName, basicAuthStr);

        // Configure RCR prerequisites
        await instance.configureRCRprerequisites();
    };

    const initialInstanceConfig = async function() {
        try {
            //TODO: do we need to delete the existing instance config file?
            //resetInstanceConfiguration();
            const instanceConfigData = await getInstanceConfiguration();
            await configureInstance(instanceConfigData);

            util.showSuccessMessage("Instance configured successfully");
        } catch (error) {
            //console.log(error);
            util.showErrMessage(error.toString());
            console.log("Instance configuration FAILED. Retry.");
            process.exit(1);
        }
    };

    const saveInstanceData = function(instanceName, userName, password) {
        const resp = (async function() {
            const basicAuthStr = Buffer.from(userName + ":" + password).toString("base64");
            const configObject = {
                instanceName,
                basicAuthStr
            };
            return await instance.saveToConfig(configObject);
        })();

        if (resp) util.showInfoLevelMessage("Instance Data saved succesfully");
        else util.showErrMessage("Saving Instance Data failed");
    };

    const syncAllRules = async function() {
        try {
            const snow_rules_dir = __dirname + "/.." + RCR.snow_rules_dir;

            if (!fs.existsSync(snow_rules_dir)) {
                //TODO::
                //create  snow-rules-git folder
                fs.mkdirSync(snow_rules_dir);
            }

            deleteFilesRecursive(snow_rules_dir, false);

            console.log("******************************************");
            console.log("Downloading rules");
            const res = await git().clone(RCR.snow_rules_repo, snow_rules_dir);
            console.log("SNow rules downloaded rules successfully");
            console.log("******************************************");

            // const rulesGitRepo = git(__dirname + RCR.snow_rules_dir);
            // rulesGitRepo.silent(true)
            // .listRemote(['--get-url'])
            // .then((err, data) => {
            //     if (!err) {
            //         console.log('Remote url for repository at ' + __dirname + ' : ' + data);
            //         // if (data == RCR.snow_rules_repo){
            //         //     rulesGitRepo
            //         //     .then(() => console.log('RULES: Starting pull...'))
            //         //     .pull('origin', 'master', {'--rebase': 'true'}, (err, update) => {
            //         //         if(update && update.summary.changes) {
            //         //             //TODO
            //         //             //require('child_process').exec('npm restart');
            //         //         }
            //         //     })
            //         //     .then(() => console.log('pull done.'));
            //         // }

            //     }
            //     deleteFolderRecursive(__dirname + RCR.snow_rules_dir);

            //     // console.log('******************************************');
            //     // console.log('Downloading rules');
            //     // const res = await git().clone(RCR.snow_rules_repo,
            //     //                             RCR.snow_rules_dir);
            //     // console.log('SNow rules downloaded rules successfully');
            //     // console.log('******************************************');

            // });
        } catch (err) {
            console.error("SNow rules download failed!!");
            console.log(err);
            process.exit(1);
        }
    };

    const updateSetup = function() {
        //TODO:
    };

    const setInstanceAsDefault = function(instanceName) {
        //TODO::
    };

    const resetInstanceConfiguration = function() {
        //REVISIT:
        const insConfigFile = __dirname + "/../" + RCR.instance_config_file;
        if (fs.existsSync(insConfigFile)) fs.unlinkSync(insConfigFile);
    };

    const deleteFilesRecursive = function(path, removeDir) {
        if (!path || path == "/") return;

        if (fs.existsSync(path)) {
            fs.readdirSync(path).forEach(file => {
                let curPath = nodePath.join(path, file);
                if (fs.lstatSync(curPath).isDirectory()) deleteFilesRecursive(curPath, true);
                else fs.unlinkSync(curPath);
            });
            if (removeDir) fs.rmdirSync(path);
        }
    };

    return {
        saveInstanceData,
        initialInstanceConfig,
        setInstanceAsDefault,
        syncAllRules,
        updateSetup,
        resetInstanceConfiguration
    };
})();
