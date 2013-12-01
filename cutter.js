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
    CONTROL: {}
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
                else { // start a control token
                    // return the previous echo token, if it isn't empty
                    if (tokenLength > 1) {
                        if (!tokenReturned) {
                            pos--; tokenReturned = true;
                            return new Token(TokenType.ECHO, template.substr(tokenStart, tokenLength - 1)); // without {
                        }
                        tokenReturned = false;
                    }
                    
                    status = TokenizerStatus.CONTROL;
                    
                    // include current character
                    tokenStart = pos - 1;
                    tokenLength = 1;
                }
                break;
            case TokenizerStatus.CONTROL:
                if (c === -1) {
                    throw {}; // @todo throw something better!
                }
                
                // closing brace => return the token
                if (c === "}") {
                    if (!tokenReturned) {
                        pos--; tokenReturned = true;
                        return new Token(TokenType.CONTROL, template.substr(tokenStart, tokenLength));
                    }
                    tokenReturned = false;
                    
                    status = TokenizerStatus.ECHO;
                    tokenStart++;
                    tokenLength = 0;
                }
                else { // other characters => continue...
                    // @todo check for } in quotes
                    tokenLength++;
                }
                break;
            }
        }
        
        return null;
    }
}

/** Compiles the template and returns JavaScript source code. */
function compile(template) {
    var js = "\"use strict\";\n";
    var tokenizer = new Tokenizer(template);
    
    var token;
    while (token = tokenizer.nextToken()) {
        console.log(token.type.name + ": " + token.content);
    }
    
    // @todo process the tokens and build .js
    
    return js;
}


module.exports.get = get;

