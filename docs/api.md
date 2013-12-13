API reference
====================

`cutter` object
-------------

### `cutter.get(filename, callback) [Template]`

Loads and compiles the specified template file asynchronously. This function also loads and compiles all template dependencies (included or parent templates).

####Params

- `filename [String]` - template filename or path, relative to the process working directory¨
- `callback [function(err, template)]` - function called when the template is loaded and compiled
  - `err` - any exception raised, usually `cutter.CompilerException`
  - `template [Template]` - template object
