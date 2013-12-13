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
var cutter = require("cutter");

cutter.get("your-template.jtpl", function(err, template) {
    var data = { 
        title: "Hello world",
        content: "<p>The quick brown fox jumps over the lazy dog.</p>"
    };
    var output = template.fetch(data);
});
```
