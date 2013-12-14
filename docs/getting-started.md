Getting started
===================

First template
--------------------


Create a template file:

```html
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>{$title}</title>
    </head>
    <body>
        <h1>{$title}</h1>
        {@$content}
    </body>
</html>
```

And render it with Node.js:

```javascript
var cutter = require("cutter-tpl");

cutter.get("your-template.jtpl", function(err, template) {
    var data = { 
        title: "Hello world",
        content: "<p>The quick brown fox jumps over the lazy dog.</p>"
    };
    var output = template.fetch(data);
});
```

The result will be:

```html
<!DOCTYPE html>
<html>
    <head>
        <meta charset="utf-8">
        <title>Hello world</title>
    </head>
    <body>
        <h1>Hello world</h1>
        <p>The quick brown fox jumps over the lazy dog.</p>
    </body>
</html>
```


How this works?
-------------------

- The template file is parsed and compiled to JavaScript code, then executed with the [vm](http://nodejs.org/api/vm.html) module. Evaluation of the JavaScript code produces a module-like structure which is (repeatedly) used to render the template.
- Template data variables are accessible via `$` prefix - `$title` in the template code means `data.title`.
- `{$title}` writes the contents of `data.title`, which is `Hello world`.
- All output is auto-escaped to prevent XSS attacks. However, it can be turned off - `@` modifier in `{@$content}` means that `<p>` and `</p>` won't be converted to `&lt;p&gt;` and `&lt;/p&gt;`.


What else can I do with it?
-----------------

### Comments

```
{* This is a comment *}
```

### Conditions and loops

```
{if $foo === "bar"}
    Foo is bar.
{else}
    Foo is {$foo}.
{/}
```

or

```
{for var i = 0; i < $foo.length; i++}
    $foo[{i}] = {$foo[i]}
{/}
```

### Inline JavaScript

```
{> var localVariable = (function() { /* so something */ })()}
{localVariable}
```


### ...and many other things

- Inheritance and virtual sections
- Template cutouts
- Macros
