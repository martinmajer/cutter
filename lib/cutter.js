"use strict";

var fs = require("fs");
var path = require("path");
var Tokenizer = require("./tokenizer.js");

/** Loads the template. */
function get(filename, callback) {
    fs.readFile(filename, { encoding: "utf8" }, function(err, data) {
        if (err) callback(err, null);
        
        var compiled = compile(data);
        
        fs.writeFile(filename + ".js", compiled, function(err) {
            if (err) callback(err, null);
            
            // @todo change to non-blocking require
            var template = require(path.relative(__dirname, filename + ".js")); // needs path relative to here!
            callback(null, template);
        });
    });
}

/** Compiles the template and returns JavaScript source code. */
function compile(template) {
    var js = "\"use strict\";\n";
    var tokenizer = new Tokenizer(template);
    var globalIdentifiers = {}; // set of all global identifiers
    
    var token;
    while (token = tokenizer.nextToken()) {
        var identifiers = token.identifiers();
        if (identifiers) {
            for (var i = 0; i < identifiers.length; i++) {
                globalIdentifiers[identifiers[i]] = true;
            }
        }
        
        // a control token can mean a lot of things (write, if, loop etc.)
        token.transform();
        console.log(token);
    }
    
    return js;
}


module.exports.get = get;

