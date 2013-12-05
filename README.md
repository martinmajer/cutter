Cutter
======

Simple but powerful template engine for Node.js. Under construction!


### Features and syntax
---------

**Injected variables output**


    <h1>{$variable}</h1>
    <div class="content">
        {@$variableWithHtml}
    </div>
    

**Inline JavaScript and local variables**

    {> var f = function(x) { return 42*x; }}
    {f(1)}
    {> var html = "<h2>" +f(2) + "</h2>"}
    {@html}

**Conditional output**

    {if condition}
        true
    {/}

    {if condition}
        true branch
    {else}
        false branch
    {/}
    
**Loops**

    {while condition}
        output
    {/}
    
    {for var i = 0; i < 10; i++}
        I = {i}
    {/}
    
**Inheritance and virtual sections**

...

**Template cutouts**

...
