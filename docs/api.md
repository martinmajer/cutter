API reference
====================


## `cutter`

### `cutter.get(filename, callback) [Template]`

Loads and compiles the specified template file asynchronously. This function also loads and compiles all template dependencies (included or parent templates).

#### Params

- `filename [String]` - template filename or path, relative to the process working directory¨
- `callback [function(err, template)]` - function called when the template is loaded and compiled
  - `err` - any exception raised, usually `cutter.CompilerException` or `SyntaxError`
  - `template [Template]` - template object


## `cutter.CompilerException`

Exception which can be raised by the template compiler (preprocessor).

#### Properties

- `message`  - error message
- `filename` - template file, absolute path
- `line`     - line number

#### Important note

Cutter relies heavily on embedded JavaScript code. `CompilerException` will not be thrown if you make a syntax error in embedded JavaScript - you will regular `SyntaxError` instead.
