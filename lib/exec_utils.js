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

/** Replaces some HTML characters, excluding double quotes. */
module.exports.html = function(text) {
    if (!(text instanceof String)) text = new String(text);
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Replaces some HTML characters, including double quotes. */
module.exports.htmlEl = function(text) {
    if (!(text instanceof String)) text = new String(text);
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/** Escapes the text for usage in generated client-side JavaScript code. */
module.exports.jsEsc = function(text) {
    if (!(text instanceof String)) text = new String(text);
    return text
        .replace(/\\/g, '\\\\')
        .replace(/\u0008/g, '\\b')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\f/g, '\\f')
        .replace(/\r/g, '\\r')
        .replace(/'/g, '\\\'')
        .replace(/"/g, '\\"');
}

