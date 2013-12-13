Tags documentation
======================

All template tags are enclosed in curly braces `{` and `}` - for example `{template_tag}`. There are two types of template tags - single and paired, paired tags have to be closed with `{/}`. There must be no whitespaces after the opening brace `{`. `{* This is a comment *}`

## Variable output

### `{<variable>}`

Outputs a variable. Characters `<`, `>` and `&` are converted to HTML entities `&lt;`, `&gt;` and `&amp;`. Double quotes `"` are converted to `&quot;`, if this tag appears inside a HTML attribute value.

### `{\<variable>}`

Outputs a variable for JavaScript code. Characters `\`, `\t`, `\n`, `\f`, `\r`, `'` and `"` are escaped, so they don't produce syntax errors inside JavaScript string literals.

### `{@<variable>}`

Outputs a variable "as-is", without any special characters replacements.

### Example

    <html>
        <head>
            <title>{$title}</title>
            <script>
            var jsTitle = "{\$title}";
            </script>
        </head>
        <body>
            <h1>{$title}</h1>
            {@$content}
        </body>
    </html>
    
## Inline JavaScript

### `{> <JavaScript code>}`

This macro can contain any JavaScript code. It can span multiple lines.
    
## Logic tags

### `{if <condition>}`

Creates an if statement. Translates to `if (<condition>)`.

### `{elseif <condition>}`

Else if branch of a previous if statement. Translates to `else if (<condition>)`.

### `{else}`

Else branch of a previous if statement. Translates to `else`.

### `{while <condition>}`

Creates a while loop. Translates to `while (<condition>)`.

### `{for <for_statements>}`

Creates a foor loop. Translates to `for (<for_statements>)`.

### `{break}`

Exists a loop. Loop labels are not supported (yet).

### `{continue}`

Jumps to the start of a loop. Loop labels are not supported (yet).

### Example


    {if $foo === "bar"}
        Foo is bar.
    {else}
        Foo is {$foo}.
    {/}
    
    {> var i = 0}
    {while i < 10}
        {i++} {* writes and increments i *}
    {/}
