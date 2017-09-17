/**
 * @fileoverview To get the update set owner (culprit) for the code smells.
 * @author Pradeep Gouribhatla
 */

"use strict";

const inquirer = require('inquirer');
      instance = require('./instance.js');

module.exports = (function() {

    const getScriptSource = function(){
        //TODO: get code smells culprit(s) ;)
    }

    const getMultipleFileSources = function(){
        //TODO: 
    }

    return {
        getScriptSource,
        getMultipleFileSources,
    }
});