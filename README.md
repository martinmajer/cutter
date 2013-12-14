Cutter
======

Simple and powerful template engine for Node.js. **Under construction!**

- [Syntax and API reference](docs/index.md)


### Features


- Familiar Smarty-inspired syntax
- Auto escaping all template variables
- Inline JavaScript code
- Syntactic sugar for conditions and loops
- Template inheritance and recursive includes
- Template cutouts!
- Custom-defined template tags
- Fast - compiles to JavaScript code


### Getting started


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
var cutter = require("cutter");

cutter.get("your-template.jtpl", function(err, template) {
    var data = { 
        title: "Hello world",
        content: "<p>The quick brown fox jumps over the lazy dog.</p>"
    };
    var output = template.fetch(data);
});
```

### Documentation

For syntax specification and API reference, please see the [documentation](docs/index.md).
