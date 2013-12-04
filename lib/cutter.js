"use strict";

var fs = require("fs");
var path = require("path");
var compiler = require("./compiler.js");

/** Loads the template. */
function get(filename, callback) {
    fs.readFile(filename, { encoding: "utf8" }, function(err, data) {
        if (err) callback(err, null);
        
        var compiled = compiler.compile(data, filename);
        // console.log(compiled);
        
        var compiledFilename = filename + ".js";
        
        fs.writeFile(compiledFilename, compiled, function(err) {
            if (err) callback(err, null);
            
            // @todo change to non-blocking require
            var template;
            loadModuleAndDependencies(compiledFilename, function(err, template) {
                 if (err) callback(err, null);
                 callback(null, template);
            });
        });
    });
}

function loadModuleAndDependencies(compiledFilename, callback) {
    var template = require(path.relative(__dirname, compiledFilename));
    
    callback(null, template);
}

function run(template, data, snippets, outputCallback) {
    template.run(data, [], snippets, outputCallback, null);
}

module.exports.get = get;
module.exports.run = run;

