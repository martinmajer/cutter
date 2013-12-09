"use strict";

var path = require("path");
var Tokenizer = require("./tokenizer.js");
var TokenType = Tokenizer.TokenType;

/**

Compiled variable names:

$   - template data
__e - exec_utils
__w - current write function
__s - virtual sections
__c - cutouts
__o - output callback 
__p - parent write function
__a - reference to __s[sectionName] (for inheritance)
__i - index for parent virtual section in __a[__i]

*/

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
    try {
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
    }
    catch (e) {
        if (e instanceof Tokenizer.TokenizerException) {
            throw new CompilerException(e.message, filename, e.line);
        }
        else throw e;
    }
    
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
        skip: 0,
        currentLine: 0
    });
    
    comp.compileTemplate();
    
    return comp.output;
}

function CompilerException(message, filename, line) {
    this.message = message;
    this.filename = filename;
    this.line = line;
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
Compiler.prototype.initWrite = function(name) {
    if (!name) name = "null";
    this.output += "var __w = __e.getWrite(" + name + ", __c, __o, __p);\n\n";
}

/** Adds local variables. */
Compiler.prototype.addVariables = function() {
    // @todo add only variables used in section
    for (var i = 0; i < this.identifiers.length; i++) {
        this.output += "var " + this.identifiers[i] + " = $[\"" + this.identifiers[i].substr(1) + "\"];\n";
    }
    this.output += "\n";
}

Compiler.prototype.compileTemplate = function() {
    this.compileHeader();
    
    this.output += "function run($, __s, __c, __o, __p) {\n";
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
    this.output += "module.exports.compiledDeps = __compiledDeps;\n";
}

Compiler.prototype.compileHeader = function() {
    this.output = "\"use strict\";\n\n";
    var execUtilsPath = path.relative(path.dirname(this.filename), path.join(__dirname, "exec_utils.js")).replace(/\\/g, "/");
    this.output += "var __e = require(\"./" + execUtilsPath + "\");\n";
    this.output += "var __compiledDeps = {};\n\n";
}

Compiler.prototype.addStaticText = function(text) {
    if (text !== "") this.output += "__w(\"" + addSlashes(text) + "\");\n";
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
        if (token != null) this.currentLine = token.line;
        
        if (token == null) { // EOF
            if (this.blocks !== 0) throw new CompilerException("Unexpected EOF", this.filename, this.currentLine);
            
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
            if (this.blocks === 0) throw new CompilerException("Unexpected block end", this.filename, this.currentLine);
            if (token.content !== "") throw new CompilerException("Unexpected '" + token.content + "' after '/'", this.filename, this.currentLine);
            this.handleWhitespaces();
            return;
        }
        else if (token.type == TokenType.WRITE) {
            this.addLeadingSpaces();
            this.output += "__w(" + token.content + ");\n";
        }
        else if (token.type == TokenType.INLINE_JS) {
            this.handleWhitespaces();
            this.output += token.content + ";\n";
        }
        else if (token.type == TokenType.PARENT) {
            this.handleWhitespaces();
            var filename = token.content;
            
            this.compileChildTemplate();
            
            this.output += "__compiledDeps[\"" + addSlashes(filename) + "\"].run($, __s, __c, __o, __w);\n";
            this.deps.push(filename);
        }
        else if (token.type == TokenType.VIRTUAL) {
            this.handleWhitespaces();
            if (token.content == "parent") {
                this.output += "__a[__i]($, __s, __c, __o, __w, __a, __i + 1);\n";
            }
            else {
                this.output += "__s[\"" + token.content + "\"][0]($, __s, __c, __o, __w, __s[\"" + token.content + "\"], 1);\n";
            }
        }
        else if (token.type == TokenType.SECTION) {
            this.output += "if (!__s[\"" + token.content + "\"]) __s[\"" + token.content + "\"] = [];\n";
            this.output += "__s[\"" + token.content + "\"].push(";
            this.compileSection();
            this.output += ");\n";
        }
        else if (token.type == TokenType.INCLUDE) {
            this.handleWhitespaces();
            var filename = token.content;
            this.output += "__compiledDeps[\"" + addSlashes(filename) + "\"].run($, __s, __c, __o, __w);\n";
            this.deps.push(filename);
        }
        else if (token.type == TokenType.IF) {
            this.blocks++;
            
            this.output += "if (" + token.content + ") {\n";
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
            
            this.output += "while (" + token.content + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            this.output += "}\n";
            this.blocks--;
        }
        else if (token.type == TokenType.FOR) {
            this.blocks++;
            
            this.output += "for (" + token.content + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            this.output += "}\n";
            this.blocks--;
        }
        else if (token.type == TokenType.CUTOUT) {
            this.compileCutout(token.content);
        }
        else if (token.type == TokenType.EXPORT) {
            this.handleWhitespaces();
            // split by first =
            var eqIndex = token.content.indexOf("=");
            var varName = token.content.substr(0, eqIndex).trim();
            if (varName.charAt(0) !== "$") throw new CompilerException("Cannot export local variable '" + varName + "'", this.filename, this.currentLine); 
            var assign =  token.content.substr(eqIndex + 1).trim();
            this.output += "$[\"" + addSlashes(varName.substr(1)) + "\"] = " + assign + ";\n";
        }
        else {
            throw new CompilerException("Unexpected token '" + token.type + "'", this.filename, this.currentLine);
        }
    }
}

Compiler.prototype.compileChildTemplate = function() {
    while (this.offset < this.count) {
        var token = this.tokens[this.offset++];
        if (token != null) this.currentLine = token.line;
        
        if (token == null) { // EOF
            if (this.blocks !== 0) throw new CompilerException("Unexpected EOF", this.filename, this.currentLine);
            return;
        }
        else if (token.type == TokenType.STATIC) {
            if (token.content.trim() !== "") throw new CompilerException("Unexpected non-empty static content", this.filename, this.currentLine);
        }
        else if (token.type == TokenType.COMMENT) {
            
        }
        else if (token.type == TokenType.INLINE_JS) {
            this.output += token.content + ";\n";
        }
        else if (token.type == TokenType.END) {
            if (this.blocks === 0) throw new CompilerException("Unexpected block end", this.filename, this.currentLine);
            if (token.content !== "") throw new CompilerException("Unexpected '" + token.content + "' after '/'", this.filename, this.currentLine);
            return;
        }
        else if (token.type == TokenType.SECTION) {
            this.firstOnLine = true;
            this.output += "if (!__s[\"" + token.content + "\"]) __s[\"" + token.content + "\"] = [];\n";
            this.output += "__s[\"" + token.content + "\"].push(";
            this.compileSection();
            this.output += ");\n";
        }
        else if (token.type == TokenType.IF) {
            this.blocks++;
            
            this.output += "if (" + token.content + ") {\n";
            this.compileChildTemplate();
            this.output += "}\n";
            this.blocks--;
        }
        else if (token.type == TokenType.ELSE) {
            this.output += "} else {\n";
        }
        else if (token.type == TokenType.EXPORT) {
            this.handleWhitespaces();
            // split by first =
            var eqIndex = token.content.indexOf("=");
            var varName = token.content.substr(0, eqIndex).trim();
            if (varName.charAt(0) !== "$") throw new CompilerException("Cannot export local variable '" + varName + "'", this.filename, this.currentLine); 
            var assign =  token.content.substr(eqIndex + 1).trim();
            this.output += "$[\"" + addSlashes(varName.substr(1)) + "\"] = " + assign + ";\n";
        }
        else {
            throw new CompilerException("Unexpected token '" + token.type + "'", this.filename, this.currentLine);
        }
    }
}

Compiler.prototype.compileSection = function() {
    this.blocks++;
    
    this.output += "function($, __s, __c, __o, __p, __a, __i) {\n";
    this.initWrite();
    this.addVariables();
    this.handleWhitespaces();
    this.compileTokens();
    this.output += "}";
    
    this.blocks--;
}

Compiler.prototype.compileCutout = function(name) {
    this.blocks++;
    
    this.output += "(function(__p) {\n";
    this.initWrite(name);
    this.addVariables();
    this.handleWhitespaces();
    this.compileTokens();
    this.output += "}(__w));\n";
    
    this.blocks--;
}

module.exports.compile = compile;
module.exports.CompilerException = CompilerException;

