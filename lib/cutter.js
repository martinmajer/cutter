"use strict";

var fs = require("fs");
var path = require("path");
var compiler = require("./compiler.js");

/** Loads the template. */
function get(filename, callback) {
    fs.readFile(filename, { encoding: "utf8" }, function(err, data) {
        if (err) { callback(err, null); return; }
        
        try {
            var compiled = compiler.compile(data, filename);
        }
        catch (e) {
            callback(e, null);
            return;
        }
        
        var compiledFilename = filename + ".js";
        
        fs.writeFile(compiledFilename, compiled, function(err) {
            if (err) { callback(err, null); return; }
            
            // @todo change to non-blocking require
            loadModuleAsync(compiledFilename, function(err, template) {
                 if (err) { callback(err, null); return; }
                 
                 function loadDependencies(i) {
                     if (i < template.deps.length) {
                         get(path.join(path.dirname(filename), template.deps[i]), function(err, depTemplate) {
                             if (err) { callback(err, null); return; }
                             template.compiledDeps[template.deps[i]] = depTemplate;
                             loadDependencies(i + 1);
                         });
                     }
                     else {
                         callback(null, template);
                     }
                 }
                 
                 loadDependencies(0);
            });
        });
    });
}

function loadModuleAsync(filename, callback) {
    // @todo change to async loading somehow
    try {
        var module = require(path.relative(__dirname, filename));
        callback(null, module);
    }
    catch (e) {
        if (e instanceof SyntaxError) {
            // @todo uhm, how to get the syntax error message and the line number?
            callback(new compiler.CompilerException(e.toString(), path.resolve(filename), 0), null);
        }
        else throw e;
    }
}

function run(template, data, snippets, outputCallback) {
    template.run(data, [], snippets, outputCallback, null);
}

module.exports.get = get;
module.exports.run = run;

