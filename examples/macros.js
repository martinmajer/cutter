"use strict";

var cutter = require("..");
var Macro = cutter.Macro;
var exec_utils = cutter.exec_utils;

cutter.registerMacro("form", new Macro(
    Macro.Type.PAIRED,
    function(context, namespace, write, name, params) {
        context.stack.push(name); // push form name to the stack
        write("<form name=\"" + exec_utils.htmlEl(name) + "\" action=\"" + exec_utils.htmlEl(params.action) + "\">");
    },
    function(context, namespace, write) {
        context.stack.pop();
        write("</form>");
    }
));

cutter.registerMacro("input", new Macro(
    Macro.Type.SINGLE,
    function(context, namespace, write, name, params) {
        write("<input type=\"text\" name=\"" + exec_utils.htmlEl(name) + "\" value=\"" + exec_utils.htmlEl(params.value) + "\">");
    }
));

cutter.registerMacro("submit", new Macro(
    Macro.Type.SINGLE,
    function(context, namespace, write, name, params) {
        var label = "Submit " + context.stack[context.stack.length-1];
        write("<button type=\"submit\">" + exec_utils.html(label) + "</button>");
    }
));

cutter.registerMacro("filter-me", new Macro(
    Macro.Type.FILTER,
    function(context, namespace, name, params, input) {
        return "Filtered '" + input + "'";
    }
));

var data = {
    html:  "<p>The quick brown fox jumps over the lazy dog</p>"
};

cutter.get("macros.jtpl", function(err, template) {
    if (err) {
        console.log(err.message + " at " + err.filename + ":" + err.line);
        return;
    }
    console.log(template.fetch(data));
});

