"use strict";

module.exports.getWrite = function getWrite(snippetName, snippets, output, parentWrite) {
    if (!snippets) return function(text) { output(null, text); }
    else {
        if (snippetName && snippets[snippetName]) {
            return function(text) {
                output(snippetName, text);
            }
        }
        else return parentWrite || function() {}
    }
}

