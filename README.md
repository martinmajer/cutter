Cutter
======

Simple and powerful template engine for Node.js. **Under construction!**


### Features


- Simple and fast
- Auto escaping all template variables
- Inline JavaScript code
- Syntactic sugar for conditions and loops
- Template inheritance and recursive includes
- Template cutouts!
- Custom-defined template tags
- Compiles to JavaScript code
- Familiar Smarty-inspired syntax



### Syntax overview

```smarty
{* template variable output *}
{$foo.bar}

{* unescaped template variable with HTML *}
{@$foo.bar}

{* inline JavaScript, local variable output *}
{> var meaningOfLife = 42; }
{meaningOfLife}

{* if condition *}
{if meaningOfLife === 42}
    {$foo.bar}
{else}
    {$bar.foo}
{/}

{* while loop *}
{> var i = 0}
{while i < meaningOfLife}
    {$gizmo.hoozit[i]}
{/}

{* for loop *}
{for var i = 0; i < meaningOfLife; i++}
    I = {i}
{/}
```
    
### Template inheritance

Cutter supports simple but powerful template inheritance with virtual blocks, parts of templates which can be overriden in child templates.

Parent template:

```smarty
<html>
    <head>
        <meta charset="utf-8">
        <title>{virtual title}</title>
    </head>
    <body>
        {virtual content}
    </body>
</html>
```
    
Child template:

```smarty
{parent parent.jtpl}
{section title}My title{/}
{section content}
    <h1>Page content</h1>
    <p>
        Lorem ipsum dolor sit amet...
    </p>
{/}
```
    
### Template cutouts

Template cutouts are a nice feature which allows you to render only selected parts of templates. This can be extremely useful in AJAX applications.

```smarty
<h1>Table</h1>
{cutout "table"}
    <table>
        <tbody>
            {for var i = 0; i < $data.length; i++}
                {cutout "row" + i}
                    <tr>
                        <th>{i}</th>
                        <td>{$data[i]}</td>
                    </tr>
                {/}
            {/}
        </tbody>
    </table>
{/}
```

You can render only the HTML table, or even individual rows!

Template cutouts work even with inheritance and included templates.
