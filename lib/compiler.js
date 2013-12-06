"use strict";

var path = require("path");
var Tokenizer = require("./tokenizer.js");
var TokenType = Tokenizer.TokenType;

/** Converts a filename to a function name. */
function getTemplateFunctionName(filename) { // @todo not really used anymore, remove?
    return "__cutter_" + path.resolve(filename).replace(/\\|\/|:/g, "_").replace(/\./g, "_dot_");
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
    
    // compiler structure
    var comp = new Compiler({
        filename: filename,
        output: "",
        deps: [],
        tokens: tokens,
        count: tokens.length,
        offset: 0,
        identifiers: Object.keys(globalIdentifiers),
        blocks: 0,
        leadingSpaces: "",
        firstOnLine: true,
        skip: 0
    });
    
    comp.compileTemplate();
    
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

Compiler.prototype.compileTemplate = function() {
    this.compileHeader();
    
    this.output += "function run(data, sections, snippets, output, parentWrite) {\n";
    this.initWrite();
    this.addVariables();
    this.compileTokens();
    this.output += "}\n\n";
    
    this.output += "module.exports.run = run;\n";
    this.output += "module.exports.deps = [";
    for (var i = 0; i < this.deps.length; i++) {
        this.output += "\"" + addSlashes(this.deps[i]) + "\"";
        if (i != this.deps.length - 1) this.output += ", ";
    }
    this.output += "];\n";
    this.output += "module.exports.compiledDeps = compiledDeps;\n";
    // @todo add required templates
    
    // @todo check unexpected tokens
}

Compiler.prototype.compileHeader = function() {
    this.output = "\"use strict\";\n\n";
    var execUtilsPath = path.relative(path.dirname(this.filename), path.join(__dirname, "exec_utils.js")).replace(/\\/g, "/");
    this.output += "var exec_utils = require(\"./" + execUtilsPath + "\");\n";
    this.output += "var compiledDeps = {};\n\n";
}

Compiler.prototype.addStaticText = function(text) {
    if (text !== "") this.output += "write(\"" + addSlashes(text) + "\");\n";
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
        this.addStaticText(this.leadingSpaces);
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
        this.addStaticText(spaces);
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
            if (this.blocks !== 0) throw "Unexpected EOF.";
            
            this.addLeadingSpaces();
            return;
        }
        else if (token.type == TokenType.STATIC) {
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
            
            this.addStaticText(content.substr(0, index));
            
            this.leadingSpaces = content.substr(index);
            this.skip = 0;
        }
        else if (token.type == TokenType.COMMENT) {
            this.handleWhitespaces();
        }
        else if (token.type == TokenType.END) {
            if (this.blocks === 0) throw "Unexpected block end.";
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
        else if (token.type == TokenType.PARENT) {
            this.handleWhitespaces();
            var filename = token.content.trim();
            
            this.compileChildTemplate();
            
            this.output += "compiledDeps[\"" + addSlashes(filename) + "\"].run(data, sections, snippets, output, write);\n";
            this.deps.push(filename);
        }
        else if (token.type == TokenType.VIRTUAL) {
            this.handleWhitespaces();
            this.output += "sections[\"" + token.content.trim() + "\"](data, sections, snippets, output, write);\n";
        }
        else if (token.type == TokenType.SECTION) {
            this.output += "if (!sections[\"" + token.content.trim() + "\"]) sections[\"" + token.content.trim() + "\"] = ";
            this.compileSection();
        }
        else if (token.type == TokenType.INCLUDE) {
            this.handleWhitespaces();
            var filename = token.content.trim();
            this.output += "compiledDeps[\"" + addSlashes(filename) + "\"].run(data, sections, snippets, output, write);\n";
            this.deps.push(filename);
        }
        else if (token.type == TokenType.IF) {
            this.blocks++;
            
            this.output += "if (" + token.content.trim() + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            this.output += "}\n";
            this.blocks--;
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
            this.output += "}\n";
            this.blocks--;
        }
        else if (token.type == TokenType.FOR) {
            this.blocks++;
            
            this.output += "for (" + token.content.trim() + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            this.output += "}\n";
            this.blocks--;
        }
        else {
            throw "Unexpected token.";
        }
    }
}

Compiler.prototype.compileChildTemplate = function() {
    while (this.offset < this.count) {
        var token = this.tokens[this.offset++];
        
        if (token == null) { // EOF
            if (this.blocks !== 0) throw "Unexpected EOF.";
            return;
        }
        else if (token.type == TokenType.STATIC) {
            if (token.content.trim() !== "") throw "Unexpected non-empty static content.";
        }
        else if (token.type == TokenType.COMMENT) {
            
        }
        else if (token.type == TokenType.INLINE_JS) {
            this.output += token.content + ";\n";
        }
        else if (token.type == TokenType.END) {
            if (this.blocks === 0) throw "Unexpected block end.";
            return;
        }
        else if (token.type == TokenType.SECTION) {
            this.output += "if (!sections[\"" + token.content.trim() + "\"]) sections[\"" + token.content.trim() + "\"] = ";
            this.firstOnLine = true;
            this.compileSection();
        }
        else if (token.type == TokenType.IF) {
            this.blocks++;
            
            this.output += "if (" + token.content.trim() + ") {\n";
            this.compileChildTemplate();
            this.output += "}\n";
            this.blocks--;
        }
        else if (token.type == TokenType.ELSE) {
            this.output += "} else {\n";
        }
        else {
            throw "Unexpected token.";
        }
    }
}

Compiler.prototype.compileSection = function() {
    this.blocks++;
    
    this.output += "function(data, sections, snippets, output, parentWrite) {\n";
    
    this.addVariables();
    this.handleWhitespaces();
    this.compileTokens();
    this.output += "}\n\n";
    
    this.blocks--;
}

module.exports.compile = compile;


