"use strict";

var TokenizerStatus = {
    STATIC: 1,
    MAYBE_CONTROL: 2,
    CONTROL: 3,
    CONTROL_QUOTES_DOUBLE: 4,
    CONTROL_QUOTES_SINGLE: 5,
    COMMENT: 6,
    COMMENT_MAYBE_END: 7
};

var TokenType = {
    STATIC:     "static",
    CONTROL:    "control",
    
    INLINE_JS:  "inline js",
    WRITE:      "write",
    
    PARENT:     "parent",
    VIRTUAL:    "virtual",
    SECTION:    "section",
    
    END:        "block end",
    
    IF:         "if",
    ELSE:       "else",
    FOR:        "for",
    FOREACH:    "foreach",
    WHILE:      "while" 
};

var TokenHtmlContext = {
    N_A: null,
    NORMAL: "normal",
    ELEMENT: "element",
    COMMENT_OR_CDATA: "comment or cdata"
};

/** Token object. */
function Token(type, content, context) {
    this.type = type;
    this.content = content;
    this.context = context || TokenHtmlContext.N_A;
}

/** Structure for parser data. */
function Tokenizer(template) {
    // @todo skip BOM
    var status = TokenizerStatus.STATIC;
    var pos = 0;
    var length = template.length;
    var tokenReturned = false;
    var tokenLength = 0;
    var tokenStart;
    
    // status variables for control token
    var braces = 0;
    var quotesEscape = false;
    var identifierStatus = 0;
    
    var currentHtmlContext = TokenHtmlContext.NORMAL;
    var htmlTagJustOpened = false;
    
    // changes context in static HTML data
    function changeHtmlContext(c) {
        if (c === "<") {
            currentHtmlContext = TokenHtmlContext.ELEMENT;
            htmlTagJustOpened = true;
        }
        else {
            if (c === "!" && htmlTagJustOpened) {
                currentHtmlContext = TokenHtmlContext.COMMENT_OR_CDATA;
            }
            else if (c === ">") {
                currentHtmlContext = TokenHtmlContext.NORMAL;
            }
            if (htmlTagJustOpened) htmlTagJustOpened = false;
        }
    }
    
    // finds and returns next token
    this.nextToken = function() {
        tokenStart = pos;
        
        while (pos < length + 1) {
            var c = pos < length ? template.charAt(pos++) : (pos++, -1);
            
            switch (status) {
            case TokenizerStatus.STATIC:
                if (c === -1) {
                    if (tokenLength) return new Token(TokenType.STATIC, template.substr(tokenStart, tokenLength));
                }
                
                // opening brace => could mean some dynamic content
                if (c === "{") status = TokenizerStatus.MAYBE_CONTROL;
                else changeHtmlContext(c);
                tokenLength++;
                break;
                
            case TokenizerStatus.MAYBE_CONTROL:
                if (c === -1) {
                    // always at least "{" character
                    return new Token(TokenType.STATIC, template.substr(tokenStart, tokenLength));
                }
                
                // whitespace or } => continue with static content
                if (c === " " || c === "\f" || c === "\n" || c === "\r" || c === "\t" || c === "}") {
                    status = TokenizerStatus.STATIC;
                    tokenLength++;
                }
                else { // start a control token or a comment
                    // return the previous STATIC token, if it isn't empty
                    if (tokenLength > 1) {
                        if (!tokenReturned) {
                            pos--; tokenReturned = true;
                            return new Token(TokenType.STATIC, template.substr(tokenStart, tokenLength - 1)); // without {
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
                        return new Token(TokenType.CONTROL, template.substr(tokenStart, tokenLength), currentHtmlContext);
                    }
                    tokenReturned = false;
                    
                    status = TokenizerStatus.STATIC;
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
                    status = TokenizerStatus.STATIC;
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

/** Finds all identifiers (variables) starting with $ */
Token.prototype.identifiers = function() {
    if (this.type != TokenType.CONTROL) return null;
    
    // @todo better search for identifiers
    return this.content.match(/\$[a-zA-Z0-9_]+/g);
}

/** Processes the token and transforms it somehow, if needed. */
Token.prototype.transform = function() {
    if (this.type == TokenType.STATIC) return;
    
    // control token
    var content = this.content.trim();
    
    // @todo do something with this, it's really ugly...
    if (content.charAt(0) == ">") {
        this.type = TokenType.INLINE_JS;
        this.content = content.substr(1).trim();
    }
    else if (content.charAt(0) == "/") {
        this.type = TokenType.END;
        this.content = content.substr(1).trim();
    }
    else if (content.match(/^parent(\W|$)/g)) {
        this.type = TokenType.PARENT;
        this.content = content.substr(6).trim();
    }
    else if (content.match(/^section(\W|$)/g)) {
        this.type = TokenType.SECTION;
        this.content = content.substr(7).trim();
    }
    else if (content.match(/^virtual(\W|$)/g)) {
        this.type = TokenType.VIRTUAL;
        this.content = content.substr(7).trim();
    }
    else if (content.match(/^if(\W|$)/g)) {
        this.type = TokenType.IF;
        this.content = content.substr(2).trim();
    }
    else if (content.match(/^else(\W|$)/g)) {
        this.type = TokenType.ELSE;
        this.content = content.substr(4).trim();
    }
    else if (content.match(/^for(\W|$)/g)) {
        this.type = TokenType.FOR;
        this.content = content.substr(3).trim();
    }
    else if (content.match(/^foreach(\W|$)/g)) {
        this.type = TokenType.FOREACH;
        this.content = content.substr(7).trim();
    }
    else if (content.match(/^while(\W|$)/g)) {
        this.type = TokenType.WHILE;
        this.content = content.substr(5).trim();
    }
    else {
        this.type = TokenType.WRITE;
    }
}

Tokenizer.TokenType = TokenType;
Tokenizer.Token = Token;

module.exports = Tokenizer;
