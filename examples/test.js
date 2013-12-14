"use strict";

var cutter = require("..");

var templateFile = process.argv[2];
if (!templateFile) {
    console.log("Please specify the example template!");
    return;
}

var data = {
    hello: "world",
    html:  "<p>The quick brown fox jumps over the lazy dog</p>",
    gizmo: "g.i.z.m.o",
    array: [1, 11, 111, 1111, 11111],
    counter: 5
};
cutter.get(templateFile, function(err, template) {
    if (err) {
        console.log(err); return;
    }
    console.log(template.fetch(data));
});

