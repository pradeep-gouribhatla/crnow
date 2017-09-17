/**
 * @fileoverview Loads service now rules
 * @author Pradeep Gouribhatla
 */

"use strict";

const  fs = require("fs"),
     path = require("path"),
RCR_CONST = require('../config/rcr_constants');

module.exports = (function(rulesDir, cwd) {

        let _rules = Object.create(null);
        let _rulesDirCache = {};

        //Initialize snow rules
        _init();

        function _init(){
            const nowRules = _loadRules(__dirname + '/..' + RCR_CONST.snow_rules_dir, './');
            Object.keys(nowRules).forEach(ruleId => {
                _define(ruleId, nowRules[ruleId]);
            });
        };

        function _get(ruleId) {
            if (typeof _rules[ruleId] === "string") {
                return require(_rules[ruleId]);
            }
            return _rules[ruleId];
        }

        //Registers a rule module for rule id in storage.
        function _define(ruleId, ruleModule) {
            _rules[ruleId] = ruleModule;
        }

        function _loadRules(rulesDir, cwd){
            if (!rulesDir) return;
                
            rulesDir = path.resolve(cwd, rulesDir);
            if (_rulesDirCache[rulesDir]) {
                return _rulesDirCache[rulesDir];
            }

            const rules = Object.create(null);
            fs.readdirSync(rulesDir).forEach(file => {
                if (path.extname(file) !== ".js") {
                    return;
                }
                rules[file.slice(0, -3)] = path.join(rulesDir, file);
            });
            _rulesDirCache[rulesDir] = rules;

            return rules;
        };
     	
        const getAllRules = function(){
            const allRules = new Map();
            Object.keys(_rules).forEach(name => {
                const rule = _get(name);
                allRules.set(name, rule);
            });
            return allRules;
     	};
     	
        const getAllSnowRules = function(){
            //TODO
            let allRules = Object.keys(_rules);
            let snowRules = allRules.filter(rule => rule.indexOf('SNOW') >=0);
            return snowRules;
        };
        
        const getOOBRules = function(){
            //TODO
            //get rules from eslint lib
     	};
     	
        const getCustomRules = function(){
            //TODO
            //get rules from custom rules directory
     	};

        const getRulesByType = function(fileType){

     	};
        
        const getCustomRulesForRecord = function(fileRecordObj){
            let customRules = getCustomRules();
            return getRulesForThisScriptRecord(customRules, fileRecordObj);
        };
        
        const getSnowRulesForRecord = function(fileRecordObj){
            let snowRules = getAllSnowRules();
            return getRulesForThisScriptRecord(snowRules, fileRecordObj);
        };
                 
        const getAllRulesForRecord = function(fileRecordObj){
            let allRules = Object.keys(_rules);
            return getRulesForThisScriptRecord(allRules, fileRecordObj);
        };
        
        const getRulesForThisScriptRecord = function (ruleNames, scriptRecord){
    
            if (!scriptRecord || !Array.isArray(ruleNames)) return [];
            const rulesMap = getAllRules();

            let rulesAfterEvaluatingCond = ruleNames.filter(rule => {
                
                let ruleConfigF = rulesMap.get(rule), nowRConditionFunction;
                if (typeof ruleConfigF == "function") {
                    let nowRConfig = ruleConfigF();
                    if(nowRConfig && nowRConfig['condition'])
                        nowRConditionFunction = nowRConfig['condition'];
                    else 
                        return true;
                }   
                else if(typeof ruleConfigF == "object")
                    nowRConditionFunction = ruleConfigF.meta.conditionFunc || null;
                else 
                    return;
                
                if (nowRConditionFunction){
                    return nowRConditionFunction.call(this, scriptRecord);
                }
                return;
            });
            //console.log(rulesAfterEvaluatingCond);
            return rulesAfterEvaluatingCond; 
        };

    return {
        getAllRules,
        getAllSnowRules,
        getOOBRules,
        getCustomRules,
        getRulesByType,
        getAllRulesForRecord, /* Get all the matching rule names for a record */
        getSnowRulesForRecord,
        getCustomRulesForRecord
    }
})();




