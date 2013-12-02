"use strict";

var fs = require("fs");

/** Loads the template. */
function get(filename, callback) {
    fs.readFile(filename, { encoding: "utf8" }, function(err, data) {
        if (err) callback(err, null);
        
        try { 
            var compiled = compile(data);
        }
        catch (err) {
            callback(err, null);
        }
        
        var filenameCompiled = filename + ".js";
        
        fs.writeFile(filenameCompiled, compiled, function(err) {
            if (err) callback(err, null);
            
            // @todo change to non-blocking require
            var template = require(filenameCompiled);
            callback(null, template);
        });
    });
}

var TokenizerStatus = {
    ECHO: {},
    MAYBE_CONTROL: {},
    CONTROL: {},
    CONTROL_QUOTES_DOUBLE: {},
    CONTROL_QUOTES_SINGLE: {},
    CONTROL_IDENTFR_FIRST: {},
    CONTROL_IDENTFR_NEXT: {},
    CONTROL_IDENTFR_DOT: {},
    COMMENT: {},
    COMMENT_MAYBE_END: {}
};

var TokenType = {
    ECHO: { name: "echo" },
    CONTROL: { name: "control" }
};

/** Token object. */
function Token(type, content) {
    this.type = type;
    this.content = content;
}

/** Structure for parser data. */
function Tokenizer(template) {
    // @todo skip BOM
    var status = TokenizerStatus.ECHO;
    var pos = 0;
    var length = template.length;
    var tokenReturned = false;
    var tokenLength = 0;
    var tokenStart;
    
    // status variables for control token
    var braces = 0;
    var quotesEscape = false;
    var identifierStatus = 0;
    
    this.nextToken = function() {
        tokenStart = pos;
        
        while (pos < length + 1) {
            var c = pos < length ? template.charAt(pos++) : (pos++, -1);
            
            switch (status) {
            case TokenizerStatus.ECHO:
                if (c === -1) {
                    if (tokenLength) return new Token(TokenType.ECHO, template.substr(tokenStart, tokenLength));
                }
                
                // opening brace => could mean some dynamic content
                if (c === "{") status = TokenizerStatus.MAYBE_CONTROL;
                tokenLength++;
                break;
                
            case TokenizerStatus.MAYBE_CONTROL:
                if (c === -1) {
                    // always at least "{" character
                    return new Token(TokenType.ECHO, template.substr(tokenStart, tokenLength));
                }
                
                // whitespace or } => continue with static content
                if (c === " " || c === "\f" || c === "\n" || c === "\r" || c === "\t" || c === "}") {
                    status = TokenizerStatus.ECHO;
                    tokenLength++;
                }
                else { // start a control token or a comment
                    // return the previous echo token, if it isn't empty
                    if (tokenLength > 1) {
                        if (!tokenReturned) {
                            pos--; tokenReturned = true;
                            return new Token(TokenType.ECHO, template.substr(tokenStart, tokenLength - 1)); // without {
                        }
                        tokenReturned = false;
                    }
                    
                    if (c !== "*") {
                        status = TokenizerStatus.CONTROL;
                        
                        // include current character
                        tokenStart = pos - 1;
                        tokenLength = 1;
                        
                        braces = (c === "{") ? 2 : 1;
                        
                        if (c === "\"") status = TokenizerStatus.CONTROL_QUOTES_DOUBLE;
                        else if (c === "\'") status = TokenizerStatus.CONTROL_QUOTES_SINGLE;
                    }
                    else {
                        status = TokenizerStatus.COMMENT;
                    }
                }
                break;
                
            case TokenizerStatus.CONTROL:
                if (c === -1) {
                    throw {}; // @todo throw something better!
                }
                
                // closing brace => return the token
                if (c === "}" && braces === 1) {
                    if (!tokenReturned) {
                        pos--; tokenReturned = true;
                        return new Token(TokenType.CONTROL, template.substr(tokenStart, tokenLength));
                    }
                    tokenReturned = false;
                    
                    status = TokenizerStatus.ECHO;
                    tokenStart++;
                    tokenLength = 0;
                    braces = 0;
                }
                else { // other characters => continue...
                    // @todo check for } in quotes
                    tokenLength++;
                    if (c === "{") braces++;
                    else if (c === "}") braces--;
                    else if (c === "\"") status = TokenizerStatus.CONTROL_QUOTES_DOUBLE;
                    else if (c === "\'") status = TokenizerStatus.CONTROL_QUOTES_SINGLE;
                }
                break;
                
            case TokenizerStatus.CONTROL_QUOTES_DOUBLE:
                if (c === -1) {
                    throw {}; // @todo throw something better!
                }
                
                tokenLength++;
                
                if (c === "\\") {
                    quotesEscape = !quotesEscape;
                }
                else {
                    if (c === "\"" && !quotesEscape) status = TokenizerStatus.CONTROL;
                    quotesEscape = false;
                }
                break;
                
            case TokenizerStatus.CONTROL_QUOTES_SINGLE:
                if (c === -1) {
                    throw {}; // @todo throw something better!
                }
                
                tokenLength++;
                
                if (c === "\\") {
                    quotesEscape = !quotesEscape;
                }
                else {
                    if (c === "'" && !quotesEscape) status = TokenizerStatus.CONTROL;
                    quotesEscape = false;
                }
                break;
                
            case TokenizerStatus.COMMENT:
                if (c === -1) return null;
                if (c === "*") status = TokenizerStatus.COMMENT_MAYBE_END;
                break;
                
            case TokenizerStatus.COMMENT_MAYBE_END:
                if (c === -1) return null;
                if (c === "}") {
                    status = TokenizerStatus.ECHO;
                    tokenStart = pos;
                    tokenLength = 0;
                }
                else if (c !== "*") status = Tokenizer.COMMENT;
                break;
            }
        }
        
        return null;
    }
}

/** Processes the token and transforms it somehow, if needed. */
Token.prototype.transform = function() {
    if (this.type == TokenType.ECHO) return this;
    
    // control token
    return this;
}

/** Compiles the template and returns JavaScript source code. */
function compile(template) {
    var js = "\"use strict\";\n";
    var tokenizer = new Tokenizer(template);
    
    var token;
    while (token = tokenizer.nextToken()) {
        // a control token can mean a lot of things (write, if, loop etc.)
        token = token.transform();
        console.log(token.type.name + ": " + token.content);
    }
    
    // @todo process the tokens and build .js
    
    return js;
}


module.exports.get = get;

