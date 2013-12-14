Tags documentation
======================

All template tags are enclosed in curly braces `{` and `}` - for example `{template_tag}`. There are two types of template tags - single and paired, paired tags have to be closed with `{/}`. There must be no whitespaces after the opening brace `{`. `{* This is a comment *}`


- [Variable output](#variable-output)
- [Inline JavaScript](#inline-javascript)
- [Logic tags](#logic-tags)
- [Template hierarchy](#template-hierarchy)
- [Cutouts](#cutouts)
- [Macros](#macros)

## Variable output

### `{<expression>}`

Outputs a variable or result of a JavaScript expression. Characters `<`, `>` and `&` are converted to HTML entities `&lt;`, `&gt;` and `&amp;`. Double quotes `"` are converted to `&quot;`, if this tag appears inside a HTML attribute value.

### `{\<expression>}`

Outputs a variable or result of JavaScript expression for use in generated JavaScript code. Characters `\`, `\t`, `\n`, `\f`, `\r`, `'` and `"` are escaped, so they don't produce syntax errors inside JavaScript string literals.

### `{@<expression>}`

Outputs a variable or result of JavaScript expression - "as-is", without any special characters replacements.

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

### `{if <condition>} {/}`

Creates an if statement. Translates to `if (<condition>) { ... }`.

### `{elseif <condition>}`

Else if branch of a previous if statement. Translates to `else if (<condition>) { ... }`.

### `{else}`

Else branch of a previous if statement. Translates to `else { ... }`.

### `{while <condition>} {/}`

Creates a while loop. Translates to `while (<condition>) { ... }`.

### `{for <for_statements>} {/}`

Creates a foor loop. Translates to `for (<for_statements>) { ... }`.

### `{break}`

Exists a loop - translates to `break;`. Loop labels are not supported (yet).

### `{continue}`

Jumps to the start of a loop - translates to `continue;`. Loop labels are not supported (yet).

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
    
    
## Template hierarchy

### `{parent <filename>[ | <params>]}`

Specifies the parent template. Filename is not enclosed in quotes and parameters are optional.

Example: `{parent ./layout/main.jtpl}`.

### `{virtual <name>|this|parent[ | <params>]}`

Calls a virtual template section. Section name is not enclosed in quotes, recursive call with `this` keyword and parent call with `parent` are supported. Parameters are optional.

Examples: `{virtual content | width: 800, height: 600}`, `{virtual this | i: $i - 1}`

### `{section <name>} {/}`

Defines a new virtual section, usually used in child templates together with `{parent}`.

Example: `{section content}<img src="./foo.jpg" width="{$width}" height="{$height}">{/}`

Section creates a new variable scope. Local variables defined inside a section are not visible outside it.

### `{include <filename>|this[ | <params>]}`

Includes another template. Filename is not enclosed in quotes and parameters are optional. Recursive call with the same filename or `this` is supported.

Example: `{include ./included.jptl}`

## Cutouts

### `{cutout <expression>} {/}`

Starts a new template cutout. Cutout name is JavaScript expression evaluated at runtime, usually a string.

Example: `{cutout "part-of-the-template"}This is a cutout.{/}`

Cutout creates a new variable scope. Local variables defined inside a cutout are not visible outside it.

## Macros

Three types of macros are available - single, paired and filters. All of them share similar syntax with `#` character.

### `{#<single_macro>[ <expression>][ | <params>]}`

Runs a single-tag macro. Usually produces some output.

### `{#<paired_macro>[ <expression>][ | <params>]} ... {/}`

Runs a paired macro. Usually produces some output both at the opening and closing tag, keeping the content unchanged.

### `{#<filter_macro>[ <expression>][ | <params>]}<output>{/}`

Runs a filter macro - filters enclosed output, which can be either static text or variable output. Running filter macros on more complicated structures (blocks, if statements etc.) is not supported.

The way the the filtered output is escaped depends on the output settings (e.g. `{#f}{@$var}{/}` won't be escaped because there is the `@` modifier inside the filter).

### Examples

    <h1>{#translate "cz"}Simple form{/}</h1>
    {#form "test-form" | class: "form-inline"}
        {#label "name"} {#input "name" | style: "width: 120px;"}
        {#button "submit" | class: "btn-primary"}
    {/}
