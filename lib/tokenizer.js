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
    STATIC:             "static",
    CONTROL:            "control",
    COMMENT:            "comment",
    
    INLINE_JS:          "inline js",
    WRITE:              "write",
    WRITE_RAW:          "write_raw",
    WRITE_JS_ESCAPE:    "write_js_escape",
    
    PARENT:             "parent",
    VIRTUAL:            "virtual",
    SECTION:            "section",
    
    INCLUDE:            "include",
    
    END:                "block end",
    
    IF:                 "if",
    ELSEIF:             "elseif",
    ELSE:               "else",
    FOR:                "for",
    FOREACH:            "foreach",
    WHILE:              "while",
    BREAK:              "break",
    CONTINUE:           "continue",
    
    CUTOUT:             "cutout",
    EXPORT:             "export"
};

var TokenHtmlContext = {
    N_A: null,
    NORMAL: "normal",
    ELEMENT: "element",
    COMMENT_OR_CDATA: "comment or cdata"
};

/** Token object. */
function Token(type, content, context, line) {
    this.type = type;
    this.content = content;
    this.context = context || TokenHtmlContext.N_A;
    this.line = line;
}

function TokenizerException(message, line) {
    this.message = message;
    this.line = line;
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
    
    var currentLine = 1;
    
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
            
            if (c === "\n") currentLine++;
            else if (c === "\r" && !(pos < length && template.charAt(pos) === "\n")) currentLine++;
            
            switch (status) {
            case TokenizerStatus.STATIC:
                if (c === -1) {
                    if (tokenLength) return new Token(TokenType.STATIC, template.substr(tokenStart, tokenLength), null, currentLine);
                }
                
                // opening brace => could mean some dynamic content
                if (c === "{") status = TokenizerStatus.MAYBE_CONTROL;
                else changeHtmlContext(c);
                tokenLength++;
                break;
                
            case TokenizerStatus.MAYBE_CONTROL:
                if (c === -1) {
                    // always at least "{" character
                    return new Token(TokenType.STATIC, template.substr(tokenStart, tokenLength), null, currentLine);
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
                            return new Token(TokenType.STATIC, template.substr(tokenStart, tokenLength - 1), null, currentLine); // without {
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
                    throw new TokenizerException("Unexpected EOF", currentLine);
                }
                
                // closing brace => return the token
                if (c === "}" && braces === 1) {
                    if (!tokenReturned) {
                        pos--; tokenReturned = true;
                        return new Token(TokenType.CONTROL, template.substr(tokenStart, tokenLength), currentHtmlContext, currentLine);
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
                    throw new TokenizerException("Unexpected EOF", currentLine);
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
                    throw new TokenizerException("Unexpected EOF", currentLine);
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
                    if (!tokenReturned) {
                        pos--; tokenReturned = true;
                        return new Token(TokenType.COMMENT, null, null, currentLine);
                    }
                    tokenReturned = false;
                    
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
    if (this.type == TokenType.STATIC || this.type == TokenType.COMMENT) return;
    
    // finds the first word in a string
    function findFirstWord(content) {
        var pos = 0;
        var wordLength = 0;
        
        // no need to trim, control tokens can't have leading whitespaces 
        while (pos < content.length) {
            var c = content.charAt(pos++);
            if (c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c >= "0" && c <= "9" || c === "_") {
                wordLength++;
            }
            else break;
        }
        return wordLength > 0 ? content.substr(0, wordLength) : null;
    }
    
    // control token
    var content = this.content;
    var firstWord = findFirstWord(content);
    
    if (firstWord === null && content.charAt(0) === ">") {
        this.type = TokenType.INLINE_JS;
        this.content = content.substr(1).trim();
    }
    else if (firstWord === null && content.charAt(0) === "/") {
        this.type = TokenType.END;
        this.content = content.substr(1).trim();
    }
    else if (firstWord === null && content.charAt(0) === "@") {
        this.type = TokenType.WRITE_RAW;
        this.content = content.substr(1).trim();
    }
    else if (firstWord === null && content.charAt(0) === "\\") {
        this.type = TokenType.WRITE_JS_ESCAPE;
        this.content = content.substr(1).trim();
    }
    else if (firstWord === "parent") {
        this.type = TokenType.PARENT;
        this.content = content.substr(6).trim();
    }
    else if (firstWord === "section") {
        this.type = TokenType.SECTION;
        this.content = content.substr(7).trim();
    }
    else if (firstWord === "virtual") {
        this.type = TokenType.VIRTUAL;
        this.content = content.substr(7).trim();
    }
    else if (firstWord === "include") {
        this.type = TokenType.INCLUDE;
        this.content = content.substr(7).trim();
    }
    else if (firstWord === "if") {
        this.type = TokenType.IF;
        this.content = content.substr(2).trim();
    }
    else if (firstWord === "elseif") {
        this.type = TokenType.ELSEIF;
        this.content = content.substr(6).trim();
    }
    else if (firstWord === "else") {
        this.type = TokenType.ELSE;
        this.content = content.substr(4).trim();
    }
    else if (firstWord === "for") {
        this.type = TokenType.FOR;
        this.content = content.substr(3).trim();
    }
    else if (firstWord === "foreach") {
        this.type = TokenType.FOREACH;
        this.content = content.substr(7).trim();
    }
    else if (firstWord === "while") {
        this.type = TokenType.WHILE;
        this.content = content.substr(5).trim();
    }
    else if (firstWord === "break") {
        this.type = TokenType.BREAK;
        this.content = content.substr(5).trim();
    }
    else if (firstWord === "continue") {
        this.type = TokenType.CONTINUE;
        this.content = content.substr(8).trim();
    }
    else if (firstWord === "cutout") {
        this.type = TokenType.CUTOUT;
        this.content = content.substr(6).trim();
    }
    else if (firstWord === "export") {
        this.type = TokenType.EXPORT;
        this.content = content.substr(6).trim();
    }
    else {
        this.type = TokenType.WRITE;
    }
}

Tokenizer.TokenType = TokenType;
Tokenizer.Token = Token;
Tokenizer.TokenizerException = TokenizerException;
Tokenizer.TokenHtmlContext = TokenHtmlContext;

module.exports = Tokenizer;

