"use strict";

var path = require("path");
var Tokenizer = require("./tokenizer.js");
var TokenType = Tokenizer.TokenType;

/** Converts a filename to a function name. */
function getTemplateFunctionName(filename) {
    // @todo better conversion from filename to template function, maybe use md5?
    return "__cutter_" + path.join(__dirname, path.relative(__dirname, filename)).replace(/\\|\/|:/g, "_").replace(/\./g, "_dot_");
}

/** Compiles the template and returns JavaScript source code. */
function compile(template, filename) {
    var tokenizer = new Tokenizer(template);
    var globalIdentifiers = {}; // set of all global identifiers
    var tokens = [];
    
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
        tokens.push(token);
    }
    tokens.push(null); // push EOF token
    
    var fileHeader = "\"use strict\";\n\n";
    var execUtilsPath = path.relative(path.dirname(filename), path.join(__dirname, "exec_utils.js")).replace(/\\/g, "/");
    fileHeader += "var exec_utils = require(\"./" + execUtilsPath + "\");\n\n";
    
    // compiler structure
    var comp = new Compiler({
        output: fileHeader,
        tokens: tokens,
        count: tokens.length,
        offset: 0,
        identifiers: Object.keys(globalIdentifiers),
        blocks: 0,
        leadingSpaces: "",
        firstOnLine: false,
        skip: 0
    });
    
    comp.compileTemplate(getTemplateFunctionName(filename));
    
    return comp.output;
}

/** Creates a compiler object with specified status. */
function Compiler(status) {
    for (var key in status) {
        this[key] = status[key];
    }
}

function addSlashes(string) {
    return string
        .replace(/\\/g, '\\\\').
        replace(/\u0008/g, '\\b').
        replace(/\t/g, '\\t').
        replace(/\n/g, '\\n').
        replace(/\f/g, '\\f').
        replace(/\r/g, '\\r').
        replace(/'/g, '\\\'').
        replace(/"/g, '\\"');
}

/** Adds write() function initialization. */
Compiler.prototype.initWrite = function() {
    this.output += "var write = exec_utils.getWrite(null, snippets, output, parentWrite);\n\n";
}

/** Adds local variables. */
Compiler.prototype.addVariables = function() {
    // @todo add only variables used in section
    for (var i = 0; i < this.identifiers.length; i++) {
        this.output += "var " + this.identifiers[i] + " = data[\"" + this.identifiers[i].substr(1) + "\"];\n";
    }
    this.output += "\n";
}

Compiler.prototype.compileTemplate = function(funcName) {
    this.output += "function " + funcName + "(data, sections, snippets, output, parentWrite) {\n";
    this.initWrite();
    this.addVariables();
    this.compileTokens();
    this.output += "}\n\n";
    this.output += "module.exports.run = " + funcName + ";\n";
    this.output += "module.exports.dependencies = [];\n";
    // @todo add required templates
    
    // @todo check unexpected tokens
}

/** Finds the index where the last empty line (leading whitespaces) begins. */
function lastEmptyLineIndex(str) {
    for (var i = str.length - 1; i >= 0; i--) {
        var c = str.charAt(i);
        if (c !== " " && c !== "\t") {
            if (c === "\r") return i + 1;
            if (c === "\n") {
                if (i > 0 && str.charAt(i - 1) === "\r") return i;
                else return i + 1;
            }
            //else return str.length;
            else return -1;
        }
    }
    return 0;
}

/** 
 * If the next token is a static string and starts with a newline, the newline will be skipped. 
 * Returns how many characters should be skipped. 
 */
Compiler.prototype.skipWhitespaces = function() {
    if (this.tokens[this.offset] && this.tokens[this.offset].type == TokenType.STATIC) {
        var skip = 0;
        var content = this.tokens[this.offset].content;
        for (var i = 0; i < content.length; i++) {
            var c = content.charAt(i);
            if (c === " " || c === "\t") {
                skip++;
            }
            else if (c === "\n") {
                this.skip = skip + 1; break;
            }
            else if (c === "\r") {
                if (i < content.length - 1 && content.charAt(i + 1) === "\n") {
                    this.skip = skip + 2; break;
                }
                else {
                    this.skip = skip + 1; break;
                }
            }
            else {
                this.skip = 0; break;
            }
        }
    }
    else this.skip = 0;
    return this.skip;
}

/** 
 * Adds leading whitespaces to the output. This function allows last-line leading whitespaces
 * to be moved inside blocks, loops etc., so the output code has a nice indentation.
 */
Compiler.prototype.addLeadingSpaces = function() {
    if (this.leadingSpaces !== "") {
        this.output += "write(\"" + addSlashes(this.leadingSpaces) + "\");\n";
        this.leadingSpaces = "";
        this.firstOnLine = false;
    }
}

/*
 * Adds trailing whitespaces to the output. This function allows to move newlines inside
 * blocks.
 */
Compiler.prototype.addTrailingSpaces = function() {
    if (this.skip !== 0) {
        var spaces = this.tokens[this.offset].content.substr(0, this.skip);
        this.output += "write(\"" + addSlashes(spaces) + "\");\n";
    }
}

/** Some magic with whitespaces and newlines. */
Compiler.prototype.handleWhitespaces = function() {
    if (this.skipWhitespaces() === 0) {
        this.addLeadingSpaces();
    }
    else {
        if (this.firstOnLine === false) this.addTrailingSpaces();
        
        this.leadingSpaces = "";
        this.firstOnLine = false;
    }
}

/** Recursively compiles tokens to JavaScript code. */
Compiler.prototype.compileTokens = function() {
    while (this.offset < this.count) {
        var token = this.tokens[this.offset++];
        
        if (token == null) { // EOF
            this.addLeadingSpaces();
            return;
        }
        if (token.type == TokenType.STATIC) {
            this.addLeadingSpaces();
            
            // find last line with whitespaces only
            var content = token.content.substr(this.skip);
            
            var index = lastEmptyLineIndex(content);
            if (index !== -1) {
                this.firstOnLine = true;
            }
            else { 
                this.firstOnLine = false; index = content.length; 
            }
            
            this.output += "write(\"" + addSlashes(content.substr(0, index)) + "\");\n";
            
            this.leadingSpaces = content.substr(index);
            this.skip = 0;
        }
        if (token.type == TokenType.COMMENT) {
            this.handleWhitespaces();
        }
        if (token.type == TokenType.END) {
            this.handleWhitespaces();
            return;
        }
        else if (token.type == TokenType.WRITE) {
            this.addLeadingSpaces();
            this.output += "write(" + token.content + ");\n";
        }
        else if (token.type == TokenType.INLINE_JS) {
            this.handleWhitespaces();
            this.output += token.content + ";\n";
        }
        else if (token.type == TokenType.VIRTUAL) {
            this.handleWhitespaces();
            this.output += "sections[\"" + token.content.trim() + "\"](data, sections, snippets, output, write);\n";
        }
        else if (token.type == TokenType.SECTION) {
            this.output += "sections[\"" + token.content.trim() + "\"] = ";
            this.compileSection();
        }
        else if (token.type == TokenType.IF) {
            this.blocks++;
            
            this.output += "if (" + token.content.trim() + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            if (--this.blocks < 0) throw "Unexpected block end.";
            this.output += "}\n";
        }
        else if (token.type == TokenType.ELSE) {
            this.output += "} else {\n";
            this.handleWhitespaces();
        }
        else if (token.type == TokenType.WHILE) {
            this.blocks++;
            
            this.output += "while (" + token.content.trim() + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            if (--this.blocks < 0) throw "Unexpected block end.";
            this.output += "}\n";
        }
        else if (token.type == TokenType.FOR) {
            this.blocks++;
            
            this.output += "for (" + token.content.trim() + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            if (--this.blocks < 0) throw "Unexpected block end.";
            this.output += "}\n";
        }
    }
}

Compiler.prototype.compileSection = function() {
    this.blocks++;
    
    this.output += "function(data, sections, snippets, output, parentWrite) {\n";
    
    this.addVariables();
    this.handleWhitespaces();
    this.compileTokens();
    
    if (--this.blocks < 0) throw "Unexpected block end.";
    this.output += "}\n\n";
}

module.exports.compile = compile;


