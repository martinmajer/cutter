"use strict";

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var compiler = require("./compiler.js");
var Template = require("./template.js");
var Macro = require("./macro.js");
var exec_utils = require("./exec_utils.js");

var _macros = {};
var _cache = {};

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
    var template = getCachedTemplate(path.resolve(filename));
    if (template) { // the template is cached in the memory
        var checkTime = false;
        
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
            var compiledFilename = filename + ".js";
            var template = runCompiledJs(compiled, compiledFilename);
        }
        catch (e) {
            callback(e, null);
            return;
        }
         
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
        
        setCachedTemplate(path.resolve(filename), template);
        
        // find the modification time
        fs.stat(filename, function(err, fstat) {
            if (err) { callback(err, null); return; }
            
            template.mtime = fstat.mtime;
            loadDependencies(0);
        });
        
        var dumpJs = false;
        
        // write the compiled source code to a file (debug)
        if (dumpJs) {
            fs.writeFile(compiledFilename, compiled, null);
        }
    });
}

/** Returns cached template. Result can be undefined. */
function getCachedTemplate(filename) {
    return _cache[filename];
}

/** Sets cached template. */
function setCachedTemplate(filename, template) {
    _cache[filename] = template;
}

function runCompiledJs(compiledJs, filename) {
    var sandbox = {
        __t: {},
        __e: exec_utils,
        __m: _macros
    };
    var code = "(function() {" + compiledJs + "})()";
    vm.runInNewContext(code, sandbox, filename);
    return sandbox.__t;
}

function runInternal(template, data, cutouts, outputCallback) {
    template.run(data, [], cutouts, outputCallback, null, {});
}

/** Registers a macro. */
function registerMacro(name, macro) {
    _macros[name] = macro;
}


module.exports.get = get;
module.exports.getInternal = getInternal;
module.exports.runInternal = runInternal;
module.exports.Template = Template;
module.exports.Macro = Macro;
module.exports.registerMacro = registerMacro;
module.exports._macros = _macros;
module.exports.exec_utils = exec_utils;
module.exports.CompilerException = compiler.CompilerException;

