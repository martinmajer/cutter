"use strict";

var path = require("path");

var cutter = require("./cutter.js");
var Macro = require("./macro.js");

var Tokenizer = require("./tokenizer.js");
var TokenType = Tokenizer.TokenType;
var TokenHtmlContext = Tokenizer.TokenHtmlContext;

/**

Function headers:

Template file (called when running, including and extending parent templates):

function run(
    $,      // template data
    __x,    // context for macros
    __s,    // virtual sections table
    __c,    // set of cutouts to be rendered {"cutout": true} or null
    __n,    // namespace prefix for cutouts
    __o,    // output callback function(cutoutName, content)
    __p,    // write() callback inherited from another template
    __$     // template parameters (overriding main $ data)
)

Virtual section:

function(
    $,      // template data
    __x,    // context for macros
    __s,    // virtual sections table
    __c,    // set of cutouts to be rendered {"cutout": true} or null
    __n,    // namespace prefix for cutouts
    __o,    // output callback function(cutoutName, content)
    __p,    // write() callback inherited from another template
    __$,    // section parameters (overriding main $ data)
    __a,    // reference to virtual sections table, __s[name]
    __i     // reference to this callback virtual sections table, __s[name][pos]
)

Cutout:

function(
    __p     // write() callback inherited from another template
)

Other used variables:

__e - lib/exec_utils.js
__t - template (export)
        __t.deps - dependencies
        __t.run - main template function 
        __t.compiledDeps -> compiled dependencies (references to another run() callbacks)
__m - macros
__w - current write() callback
__d - shortcut for __t.compiledDeps


*/


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
        macrosBlockLevels: [],
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
    this.filename = path.resolve(filename);
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
        .replace(/\\/g, '\\\\')
        .replace(/\u0008/g, '\\b')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\f/g, '\\f')
        .replace(/\r/g, '\\r')
        .replace(/'/g, '\\\'')
        .replace(/"/g, '\\"');
}

/** Compiles the tokens to JavaScript template code. */
Compiler.prototype.compileTemplate = function() {
    // file header
    this.output = "\"use strict\";\n\n";
    var execUtilsPath = path.relative(path.dirname(this.filename), path.join(__dirname, "exec_utils.js")).replace(/\\/g, "/");
    this.output += "var __d = {};\n\n";
    
    // template run function
    this.output += "function run($, __x, __s, __c, __n, __o, __p, __$) {\n";
    this.initWrite();
    this.addVariables();
    this.compileTokens();
    this.output += "}\n\n";
    
    // file footer - module export
    this.output += "__t.run = run;\n";
    this.output += "__t.deps = [";
    for (var i = 0; i < this.deps.length; i++) {
        this.output += "\"" + addSlashes(this.deps[i]) + "\"";
        if (i != this.deps.length - 1) this.output += ", ";
    }
    this.output += "];\n";
    this.output += "__t.compiledDeps = __d;\n";
}

/** Adds write() function initialization. */
Compiler.prototype.initWrite = function(name) {
    if (!name) name = "null";
    else name = "__n ? (__n + \".\" + " + name + ") : (" + name + ")";
    this.output += "var __w = __e.getWrite(" + name + ", __c, __o, __p);\n\n";
}

/** Adds local variables. */
Compiler.prototype.addVariables = function() {
    // @todo add only variables used in a section / cutout
    for (var i = 0; i < this.identifiers.length; i++) {
        var realName = this.identifiers[i].substr(1);
        this.output += "var " + this.identifiers[i] + " = (__$[\"" + realName + "\"] !== undefined) ?  __$[\"" + realName + "\"] : $[\"" + realName + "\"];\n";
    }
    this.output += "\n";
}

/** Adds static text output. */
Compiler.prototype.addStaticText = function(text) {
    if (text !== "") this.output += "__w(\"" + addSlashes(text) + "\");\n";
}

/** Recursively compiles tokens to JavaScript code. */
Compiler.prototype.compileTokens = function() {
    
    while (this.offset < this.count) {
        var token = this.tokens[this.offset++];
        if (token != null) this.currentLine = token.line;
        
        if (token == null) { // EOF
            if (this.blocks != 0) throw new CompilerException("Unexpected EOF", this.filename, this.currentLine);
            
            this.addLeadingSpaces();
            return;
        }
        else if (token.type == TokenType.STATIC) {
            this.addLeadingSpaces();
            
            // find last line with whitespaces only
            var content = token.content.substr(this.skip);
            
            var index = lastEmptyLineIndex(content);
            if (index !== -1) { this.firstOnLine = true; }
            else { this.firstOnLine = false; index = content.length; }
            
            this.addStaticText(content.substr(0, index));
            
            this.leadingSpaces = content.substr(index);
            this.skip = 0;
        }
        else if (token.type == TokenType.COMMENT) {
            this.handleWhitespaces();
        }
        else if (token.type == TokenType.END) {
            if (this.blocks == 0) throw new CompilerException("Unexpected block end", this.filename, this.currentLine);
            if (token.content !== "") throw new CompilerException("Unexpected '" + token.content + "' after '/'", this.filename, this.currentLine);
            
            var handleWhitespaces = true;
            if (this.macrosBlockLevels.length > 0) {
                if (this.macrosBlockLevels[this.macrosBlockLevels.length - 1] == this.blocks) {
                    handleWhitespaces = false;
                }
            }
            
            if (handleWhitespaces) this.handleWhitespaces();
            return;
        }
        else if (token.type == TokenType.WRITE) {
            this.addLeadingSpaces();
            if (token.context == TokenHtmlContext.ELEMENT) {
                this.output += "__w(__e.htmlEl(" + token.content + "));\n";
            }
            else {
                this.output += "__w(__e.html(" + token.content + "));\n";
            }
        }
        else if (token.type == TokenType.WRITE_RAW) {
            this.addLeadingSpaces();
            this.output += "__w(" + token.content + ");\n";
        }
        else if (token.type == TokenType.WRITE_ESC) {
            this.addLeadingSpaces();
            this.output += "__w(__e.jsEsc(" + token.content + "));\n";
        }
        else if (token.type == TokenType.INLINE_JS) {
            this.handleWhitespaces();
            this.output += token.content + ";\n";
        }
        else if (token.type == TokenType.PARENT) {
            this.handleWhitespaces();
            this.compileParent(token);
        }
        else if (token.type == TokenType.VIRTUAL) {
            this.handleWhitespaces();
            this.compileVirtualCall(token);
        }
        else if (token.type == TokenType.SECTION) {
            this.handleWhitespaces();
            this.compileSection(token);
        }
        else if (token.type == TokenType.INCLUDE) {
            this.handleWhitespaces();
            this.compileInclude(token);
        }
        else if (token.type == TokenType.IF) {
            this.blocks++;
            
            this.output += "if (" + token.content + ") {\n";
            this.handleWhitespaces();
            this.compileTokens();
            this.output += "}\n";
            this.blocks--;
        }
        else if (token.type == TokenType.ELSEIF) {
            this.output += "} else if (" + token.content + ") {\n";
            this.handleWhitespaces();
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
        else if (token.type == TokenType.BREAK) {
            this.output += "break;\n";
            this.handleWhitespaces();
        }
        else if (token.type == TokenType.CONTINUE) {
            this.output += "continue;\n";
            this.handleWhitespaces();
        }
        else if (token.type == TokenType.CUTOUT) {
            this.compileCutout(token);
        }
        else if (token.type == TokenType.EXPORT) {
            this.handleWhitespaces();
            this.compileExport(token);
        }
        else if (token.type == TokenType.MACRO) {
            this.compileMacro(token);
        }
        else {
            throw new CompilerException("Unexpected token '" + token.type + "'", this.filename, this.currentLine);
        }
    }
}

/** Recursively compiles tokens in a child template (beginning with {parent}). */
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
            if (this.blocks == 0) throw new CompilerException("Unexpected block end", this.filename, this.currentLine);
            if (token.content !== "") throw new CompilerException("Unexpected '" + token.content + "' after '/'", this.filename, this.currentLine);
            return;
        }
        else if (token.type == TokenType.SECTION) {
            this.firstOnLine = true;
            this.handleWhitespaces();
            this.compileSection(token);
        }
        else if (token.type == TokenType.IF) {
            this.blocks++;
            
            this.output += "if (" + token.content + ") {\n";
            this.compileChildTemplate();
            this.output += "}\n";
            this.blocks--;
        }
        else if (token.type == TokenType.ELSEIF) {
            this.output += "} else if (" + token.content + ") {\n";
            this.handleWhitespaces();
        }
        else if (token.type == TokenType.ELSE) {
            this.output += "} else {\n";
        }
        else if (token.type == TokenType.EXPORT) {
            this.handleWhitespaces();
            this.compileExport(token);
        }
        else {
            throw new CompilerException("Unexpected token '" + token.type + "'", this.filename, this.currentLine);
        }
    }
}

/** Processes the {parent} tag and compiles the (child) template. */
Compiler.prototype.compileParent = function(token) {
    var pipeIndex = token.content.indexOf("|");
    var filename, params;
    if (pipeIndex == -1) {
        filename = token.content;
        params = "{}";
    }
    else {
        filename = token.content.substr(0, pipeIndex).trim();
        params = "{" + token.content.substr(pipeIndex + 1).trim() + "}";
    }
    
    this.compileChildTemplate();
    
    this.output += "__d[\"" + addSlashes(filename) + "\"].run($, __x, __s, __c, __n, __o, __w, " + params + ");\n";
    this.deps.push(filename);
}

/** Compiles a virtual section call. */
Compiler.prototype.compileVirtualCall = function(token) {
    var pipeIndex = token.content.indexOf("|");
    var name, params;
    if (pipeIndex == -1) {
        name = token.content;
        params = "{}";
    }
    else {
        name = token.content.substr(0, pipeIndex).trim();
        params = "{" + token.content.substr(pipeIndex + 1).trim() + "}";
    }
    
    if (name == "parent") {
        this.output += "__a[__i + 1]($, __x, __s, __c, __n, __o, __w, " + params + ",__a, __i + 1);\n";
    }
    else if (name == "this") {
        this.output += "__a[__i]($, __x, __s, __c, __n, __o, __w, " + params + ",__a, __i);\n";
    }
    else {
        this.output += "__s[\"" + addSlashes(name) + "\"][0]($, __x, __s, __c, __n, __o, __w, " + params + ", __s[\"" + addSlashes(name) + "\"], 0);\n";
    }
}

/** Compiles include. */
Compiler.prototype.compileInclude = function(token) {
    var pipeIndex = token.content.indexOf("|");
    var filename, params;
    if (pipeIndex == -1) {
        filename = token.content;
        params = "{}";
    }
    else {
        filename = token.content.substr(0, pipeIndex).trim();
        params = "{" + token.content.substr(pipeIndex + 1).trim() + "}";
    }
    if (filename == "this") {
        this.output += "run($, __x, __s, __c, __n, __o, __w, " + params + ");\n";
    }
    else {
        this.output += "__d[\"" + addSlashes(filename) + "\"].run($, __x, __s, __c, __n, __o, __w, " + params + ");\n";
        this.deps.push(filename);
    }
}

/** Compiles a virtual section definition. */
Compiler.prototype.compileSection = function(token) {
    this.blocks++;
    
    var name = token.content;
    
    this.output += "if (!__s[\"" + addSlashes(name) + "\"]) __s[\"" + addSlashes(name) + "\"] = [];\n";
    this.output += "__s[\"" + addSlashes(name) + "\"].push(";
    this.output += "function($, __x, __s, __c, __n, __o, __p, __$, __a, __i) {\n";
    this.initWrite();
    this.addVariables();
    this.compileTokens();
    this.output += "});\n";
    
    this.blocks--;
}

/** Compiles a cutout. */
Compiler.prototype.compileCutout = function(token) {
    this.blocks++;
    
    this.output += "(function(__p) {\n";
    this.initWrite(token.content);
    this.addVariables();
    this.handleWhitespaces();
    this.compileTokens();
    this.output += "}(__w));\n";
    
    this.blocks--;
}

/** Compiles variable export. */
Compiler.prototype.compileExport = function(token) {
    // split by first =
    var eqIndex = token.content.indexOf("=");
    var varName = token.content.substr(0, eqIndex).trim();
    if (varName.charAt(0) != "$") throw new CompilerException("Cannot export local variable '" + varName + "'", this.filename, this.currentLine); 
    var assign =  token.content.substr(eqIndex + 1).trim();
    this.output += "$[\"" + addSlashes(varName.substr(1)) + "\"] = " + assign + ";\n";
}

/** Compiles macro. */
Compiler.prototype.compileMacro = function(token) {
    // @todo macros won't work correctly if there is "|" inside the main parameter 
    var pipeIndex = token.content.indexOf("|");
    var name, mainParam, params;
    if (pipeIndex == -1) {
        name = token.content;
        params = "{}";
    }
    else {
        name = token.content.substr(0, pipeIndex).trim();
        params = "{" + token.content.substr(pipeIndex + 1).trim() + "}";
    }
    
    var spaceIndex = name.indexOf(" ");
    var tabIndex = name.indexOf("\t");
    if (tabIndex != -1 && tabIndex < spaceIndex) spaceIndex = tabIndex;
    
    if (spaceIndex == -1) {
        mainParam = "null";
    }
    else {
        mainParam = name.substr(spaceIndex + 1).trim();
        name = name.substr(0, spaceIndex).trim();
    }
    
    var macro = cutter._macros[name];
    if (!macro) throw new CompilerException("Undefined macro '" + name + "'", this.filename, this.currentLine);
    
    if (macro.type == Macro.Type.SINGLE) {
        this.addLeadingSpaces();
        this.output += "__m[\"" + addSlashes(name) + "\"].render(__x, __n, __w, " + mainParam + ", " + params + ");\n";
    }
    else if (macro.type == Macro.Type.PAIRED) {
        this.addLeadingSpaces();
        this.blocks++;
        this.macrosBlockLevels.push(this.blocks);
        this.output += "__m[\"" + addSlashes(name) + "\"].open(__x, __n, __w, " + mainParam + ", " + params + ");\n";
        this.compileTokens();
        
        this.addLeadingSpaces();
        this.output += "__m[\"" + addSlashes(name) + "\"].close(__x, __n, __w);\n";
        this.blocks--;
        this.macrosBlockLevels.pop();
    }
    else if (macro.type == Macro.Type.FILTER) {
        this.addLeadingSpaces();
        var nextToken;
        nextToken = this.tokens[this.offset++];
        if (!nextToken || nextToken.type != TokenType.STATIC && nextToken.type != TokenType.WRITE && nextToken.type != TokenType.WRITE_RAW && nextToken.type != TokenType.WRITE_ESC) {
            throw new CompilerException("Unexpected filter macro content.", this.filename, this.currentLine);
        }
        if (nextToken.type == TokenType.STATIC) { // static text
            this.output += "__w(__m[\"" + addSlashes(name) + "\"].filter(__x, __n, " + mainParam + ", " + params + ", \"" + addSlashes(nextToken.content) + "\"));\n";
        }
        else if (nextToken.type == TokenType.WRITE_RAW) {
            this.output += "__w(__m[\"" + addSlashes(name) + "\"].filter(__x, __n, " + mainParam + ", " + params + ", " + nextToken.content + "));\n";
        }
        else if (nextToken.type == TokenType.WRITE_ESC) {
            this.output += "__w(__e.jsEsc(__m[\"" + addSlashes(name) + "\"].filter(__x, __n, " + mainParam + ", " + params + ", " + nextToken.content + ")));\n";
        }
        else if (nextToken.type == TokenType.WRITE) {
            if (nextToken.context == TokenHtmlContext.ELEMENT) {
                this.output += "__w(__e.htmlEl(__m[\"" + addSlashes(name) + "\"].filter(__x, __n, " + mainParam + ", " + params + ", " + nextToken.content + ")));\n";
            }
            else {
                this.output += "__w(__e.html(__m[\"" + addSlashes(name) + "\"].filter(__x, __n, " + mainParam + ", " + params + ", " + nextToken.content + ")));\n";
            }
        }
        nextToken = this.tokens[this.offset++];
        if (!nextToken || nextToken.type != TokenType.END) throw new CompilerException("Block end expected.", this.filename, this.currentLine);
    }
}



/* ---- Some magic with whitespaces and indentation ---- */


/** Finds the index where the last empty line (leading whitespaces) begins. */
function lastEmptyLineIndex(str) {
    for (var i = str.length - 1; i >= 0; i--) {
        var c = str.charAt(i);
        if (c !== " " && c !== "\t") {
            if (c === "\r" || c === "\n") return i + 1;
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
    if (this.skip != 0) {
        var spaces = this.tokens[this.offset].content.substr(0, this.skip);
        this.addStaticText(spaces);
    }
}

/** Some magic with whitespaces and newlines. */
Compiler.prototype.handleWhitespaces = function() {
    if (this.skipWhitespaces() == 0) {
        this.addLeadingSpaces();
    }
    else {
        if (this.firstOnLine == false) this.addTrailingSpaces();
        
        this.leadingSpaces = "";
        this.firstOnLine = false;
    }
}



module.exports.compile = compile;
module.exports.CompilerException = CompilerException;

