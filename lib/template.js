"use strict";

var cutter = require("./cutter");

/** Creates a wrapper object for internal template module. */
function Template(internal) {
    this.internal = internal;
}

/** Runs the template with specified data, cutouts and output callback. */
Template.prototype.run = function(data, cutouts, outputCallback) {
    data.__m = { stack: [] }; // context for macros
    this.internal.run(data, [], cutouts, outputCallback, null, {});
}

/** 
 * Fetches the template. If writeCallback(output) is specified, it will be
 * used for the output, otherwise, the rendered template will be returned
 * as a string.
 */
Template.prototype.fetch = function(data, writeCallback) {
    if (writeCallback) {
        this.run(data, null, function(cutout, output) { writeCallback(output); });
    }
    else {
        var stringOutput = "";
        this.run(data, null, function(cutout, output) { stringOutput += output; });
        return stringOutput;
    }
}

/** 
 * Fetches specified template cutouts. If writeCallback(cutout, output) is specified, it will be
 * used for the output, otherwise, the rendered cutouts will be returned as an object.
 */
Template.prototype.fetchCutouts = function(data, cutoutsList, writeCallback) {
    // convert the list to a set
    var cutouts = {};
    for (var i = 0; i < cutoutsList.length; i++) cutouts[cutoutsList[i]] = true;
    
    if (writeCallback) {
        this.run(data, cutouts, writeCallback);
    }
    else {
        var cutoutsResult = {};
        this.run(data, cutouts, function(cutout, output) {
            if (cutoutsResult[cutout] == undefined) cutoutsResult[cutout] = "";
            cutoutsResult[cutout] += output;
        });
        return cutoutsResult;
    }
}

module.exports = Template;

