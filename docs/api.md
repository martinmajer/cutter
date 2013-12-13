API reference
====================


## `cutter`

### `cutter.get(filename, callback)`

Loads and compiles the specified template file asynchronously. This function also loads and compiles all template dependencies (included or parent templates).

#### Params

- `filename [String]` - template filename or path, relative to the process working directory
- `callback [function(err, template)]` - function called when the template is loaded and compiled
  - `err` - any exception raised, usually `cutter.CompilerException` or `SyntaxError`
  - `template [cutter.Template]` - template object



## `cutter.Template`

Compiled template file.


### `.fetch(data[, writeCallback])`

Renders the template and either returns the result, or sends it to specified callback.

#### Params

- `data [Object]` - template variables stored in an object (`data.foo` can be printed by `{$foo}`, for example)
- `writeCallback [function(output)]` - if specified, template output will be sent to this callback on the fly; this can be used for example to render the template directly to HTTP stream, without storing the output anywhere

#### Return value `[string]`

If the callback is not specified, the function will return rendered template as a string.


### `.fetchCutouts(data, cutouts[, writeCallback])`

Renders template cutouts (parts of template enclosed in `{cutout}`) and either returns the result, or sends it to specified callback.

#### Params

- `data [Object]` - template variables stored in an object (`data.foo` can be printed by `{$foo}`, for example)
- `cutouts [Array]` - list of cutouts to be rendered (for example `["foo"]` to render `{cutout "foo"}`)
- `writeCallback [function(cutoutName, output)]` - if specified, cutouts will be sent to this callback on the fly 


#### Return value `[Object]`

If the callback is not specified, the function will return rendered cutouts stored in an object (and accessible by their names).



## `cutter.CompilerException`

Exception which can be raised by the template compiler (preprocessor).

#### Properties

- `.message`  - error message
- `.filename` - template file, absolute path
- `.line`     - line number

#### Important note

Cutter relies heavily on embedded JavaScript code. `CompilerException` will not be thrown if you make a syntax error in embedded JavaScript - you will regular `SyntaxError` instead.
