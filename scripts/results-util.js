/**
 * @fileoverview render code smells object into readable output
 * @author Pradeep Gouribhatla
 */

"use strict";

const   fs = require('fs'),
handlebars = require('handlebars'),
 RCR_CONST = require('../config/rcr_constants');  
module.exports = (function() {

    const createLocalHTTPServer = function(){

    };

    const showResultsInBrowser  = function(){

     };

    const openBrowser = function(){

     };

    const getRenderedHTML = function(results){
        if(!results) return;
        try {
            const templateName = __dirname + '/..' + RCR_CONST.default_results_template;
            const  hbsTemplate = fs.readFileSync(templateName).toString('utf-8');

            let template = handlebars.compile(hbsTemplate);
            return template(results);
        
        } catch (error) {
            console.error('Error compiling code smells');
            process.exit(1)
        }
    };

    const saveResultsToHTMLFile = function(results){

        const htmlString = getRenderedHTML(results);
        if (!htmlString) throw new Error('Error compiling code smells');

        try {
            const rsHtmlFile = getResultsHTMLPath(); 
            fs.writeFileSync( rsHtmlFile, htmlString);
            return rsHtmlFile;

        } catch (error) {
            console.error('Error wrting code smells to HTML file');
            process.exit(1)
        }
    };

    const getResultsHTMLPath = function(){
        //TODO:: use path
        return __dirname + '/..'+ RCR_CONST.default_results_file;
    }


    return {
        getResultsHTMLPath,
        getRenderedHTML,
        createLocalHTTPServer,
        showResultsInBrowser,
        openBrowser,
        saveResultsToHTMLFile
    };
})();
