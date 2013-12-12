"use strict";

/** Macro type. */
var Type = {
    SINGLE: 1, 
    PAIRED: 2, 
    FILTER: 3
};

/** Creates a new macro. */
function Macro(type, callback1, callback2) {
    this.type = type;
    if (this.type == Type.SINGLE) {
        this.render = callback1;
    }
    else if (this.type == Type.PAIRED) {
        this.open = callback1;
        this.close = callback2;
    }
    else if (this.type == Type.FILTER) {
        this.filter = callback1;
    }
}

Macro.Type = Type;

module.exports = Macro;

