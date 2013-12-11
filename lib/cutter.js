"use strict";

var fs = require("fs");
var path = require("path");
var compiler = require("./compiler.js");
var Template = require("./template.js");


/** Returns the template object. */
function get(filename, callback) {
    getInternal(filename, function(err, internalTemplate) {
        if (err) { callback(err, null); return }
        var template = new Template(internalTemplate);
        callback(null, template);
    });
}


/** Returns the internal template module. */
function getInternal(filename, callback) {
    var template = getCachedTemplate();
    if (template) { // the template is cached in the memory
        var checkTime = true;
        
        if (checkTime) { // check for modification time?
            fs.stat(filename, function(err, fstat) {
                if (err) { callback(err, null); return; }
                if (!template.mtime || template.mtime !== fstat.mtime) { // template was modified
                    // @todo clear from the cache
                    loadInternal(filename, callback);
                }
                else callback(null, template); // template wasn't modified
            });
        }
        else callback(null, template);
    }
    else {
        loadInternal(filename, callback);
    }
}

/** Loads and compiles the template and recursively loads dependencies. */
function loadInternal(filename, callback) {
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
        
        // write the compiled source code to a file
        fs.writeFile(compiledFilename, compiled, function(err) {
            if (err) { callback(err, null); return; }
            
            loadTemplateModule(compiledFilename, function(err, template) {
                if (err) { callback(err, null); return; }
                 
                 // find the modification time (don't need to wait for the result)
                fs.stat(filename, function(err, fstat) {
                    if (err) { callback(err, null); return; }
                    template.mtime = fstat.mtime;
                });
                 
                function loadDependencies(i) {
                    if (i < template.deps.length) {
                        getInternal(path.join(path.dirname(filename), template.deps[i]), function(err, depTemplate) {
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

function getCachedTemplate(filename) {
    return null;
}

function loadTemplateModule(filename, callback) {
    try {
        // @todo change to async loading somehow
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

function runInternal(template, data, cutouts, outputCallback) {
    template.run(data, [], cutouts, outputCallback, null, {});
}

module.exports.get = get;
module.exports.getInternal = getInternal;
module.exports.runInternal = runInternal;
module.exports.Template = Template;

