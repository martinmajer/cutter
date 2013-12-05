"use strict";

var path = require("path");
var Tokenizer = require("./tokenizer.js");
var TokenType = Tokenizer.TokenType;

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
    var comp = {
        output: fileHeader,
        tokens: tokens,
        count: tokens.length,
        offset: 0,
        identifiers: Object.keys(globalIdentifiers),
        blocks: 0,
        leadingSpaces: "",
        firstOnLine: false,
        skip: 0
    };
    
    compileTemplate(comp, getTemplateFunctionName(filename));
    
    return comp.output;
}

function getTemplateFunctionName(filename) {
    // @todo better conversion from filename to template function
    return "__cutter_" + path.join(__dirname, path.relative(__dirname, filename)).replace(/\\|\/|:/g, "_").replace(/\./g, "_dot_");
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

function compileInitWrite(comp) {
    comp.output += "var write = exec_utils.getWrite(null, snippets, output, parentWrite);\n\n";
}

function compileAddVariables(comp) {
    // @todo add only variables used in section
    for (var i = 0; i < comp.identifiers.length; i++) {
        comp.output += "var " + comp.identifiers[i] + " = data[\"" + comp.identifiers[i].substr(1) + "\"];\n";
    }
    comp.output += "\n";
}

function compileTemplate(comp, funcName) {
    comp.output += "function " + funcName + "(data, sections, snippets, output, parentWrite) {\n";
    compileInitWrite(comp);
    compileAddVariables(comp);
    compileTokens(comp);
    comp.output += "}\n\n";
    comp.output += "module.exports.run = " + funcName + ";\n";
    comp.output += "module.exports.dependencies = [];\n";
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
function skipWhitespaces(comp) {
    if (comp.tokens[comp.offset] && comp.tokens[comp.offset].type == TokenType.STATIC) {
        var skip = 0;
        var content = comp.tokens[comp.offset].content;
        for (var i = 0; i < content.length; i++) {
            var c = content.charAt(i);
            if (c === " " || c === "\t") {
                skip++;
            }
            else if (c === "\n") {
                comp.skip = skip + 1; break;
            }
            else if (c === "\r") {
                if (i < content.length - 1 && content.charAt(i + 1) === "\n") {
                    comp.skip = skip + 2; break;
                }
                else {
                    comp.skip = skip + 1; break;
                }
            }
            else {
                comp.skip = 0; break;
            }
        }
    }
    else comp.skip = 0;
    return comp.skip;
}

/** 
 * Adds leading whitespaces to the output. This function allows last-line leading whitespaces
 * to be moved inside blocks, loops etc., so the output code has a nice indentation.
 */
function addLeadingSpaces(comp) {
    if (comp.leadingSpaces !== "") {
        comp.output += "write(\"" + addSlashes(comp.leadingSpaces) + "\");\n";
        comp.leadingSpaces = "";
        comp.firstOnLine = false;
    }
}

/*
 * Adds trailing whitespaces to the output. This function allows to move newlines inside
 * blocks.
 */
function addTrailingSpaces(comp) {
    if (comp.skip !== 0) {
        var spaces = comp.tokens[comp.offset].content.substr(0, comp.skip);
        comp.output += "write(\"" + addSlashes(spaces) + "\");\n";
    }
}

/** Some magic with whitespaces and newlines. */
function handleWhitespaces(comp) {
    if (skipWhitespaces(comp) === 0) {
        addLeadingSpaces(comp);
    }
    else {
        if (comp.firstOnLine === false) addTrailingSpaces(comp);
        
        comp.leadingSpaces = "";
        comp.firstOnLine = false;
    }
}

/** Recursively compiles tokens to JavaScript code. */
function compileTokens(comp) {
    while (comp.offset < comp.count) {
        var token = comp.tokens[comp.offset++];
        
        if (token == null) { // EOF
            addLeadingSpaces(comp);
            return;
        }
        if (token.type == TokenType.STATIC) {
            addLeadingSpaces(comp);
            
            // find last line with whitespaces only
            var content = token.content.substr(comp.skip);
            
            var index = lastEmptyLineIndex(content);
            if (index !== -1) {
                comp.firstOnLine = true;
            }
            else { 
                comp.firstOnLine = false; index = content.length; 
            }
            
            comp.output += "write(\"" + addSlashes(content.substr(0, index)) + "\");\n";
            
            comp.leadingSpaces = content.substr(index);
            comp.skip = 0;
        }
        if (token.type == TokenType.COMMENT) {
            handleWhitespaces(comp);
        }
        if (token.type == TokenType.END) {
            handleWhitespaces(comp);
            
            if (--comp.blocks < 0) throw "Unexpected block end.";
            return;
        }
        else if (token.type == TokenType.WRITE) {
            addLeadingSpaces(comp);
            comp.output += "write(" + token.content + ");\n";
        }
        else if (token.type == TokenType.INLINE_JS) {
            handleWhitespaces(comp);
            comp.output += token.content + ";\n";
        }
        else if (token.type == TokenType.VIRTUAL) {
            handleWhitespaces(comp);
            
            comp.output += "sections[\"" + token.content.trim() + "\"](data, sections, snippets, output, write);\n";
        }
        else if (token.type == TokenType.SECTION) {
            comp.output += "sections[\"" + token.content.trim() + "\"] = ";
            compileSection(comp);
        }
        else if (token.type == TokenType.IF) {
            comp.blocks++;
            
            comp.output += "if (" + token.content.trim() + ") {\n";
            handleWhitespaces(comp);
            compileTokens(comp);
            comp.output += "}\n";
        }
        else if (token.type == TokenType.ELSE) {
            comp.output += "} else {\n";
            handleWhitespaces(comp);
        }
        else if (token.type == TokenType.WHILE) {
            comp.blocks++;
            
            comp.output += "while (" + token.content.trim() + ") {\n";
            handleWhitespaces(comp);
            compileTokens(comp);
            comp.output += "}\n";
        }
        else if (token.type == TokenType.FOR) {
            comp.blocks++;
            
            comp.output += "for (" + token.content.trim() + ") {\n";
            handleWhitespaces(comp);
            compileTokens(comp);
            comp.output += "}\n";
        }
    }
}

function compileSection(comp) {
    comp.blocks++;
    
    comp.output += "function(data, sections, snippets, output, parentWrite) {\n";
    
    compileAddVariables(comp);
    
    handleWhitespaces(comp);
    compileTokens(comp);
    
    comp.output += "}\n\n";
}

module.exports.compile = compile;


