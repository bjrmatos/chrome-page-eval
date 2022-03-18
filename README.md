# chrome-page-eval
[![NPM Version](http://img.shields.io/npm/v/chrome-page-eval.svg?style=flat-square)](https://npmjs.com/package/chrome-page-eval)
[![License](http://img.shields.io/npm/l/chrome-page-eval.svg?style=flat-square)](http://opensource.org/licenses/MIT)
[![Build Status](https://travis-ci.org/bjrmatos/chrome-page-eval.png?branch=master)](https://travis-ci.org/bjrmatos/chrome-page-eval)

> **Evaluate a script function on a page with Chrome**

This module let you evaluate a script function on a page using Chrome (controlled with [puppeteer](https://github.com/GoogleChrome/puppeteer)) and get the return value of the evaluation in node.

## Usage
```html
<!-- sample.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Test page</title>
</head>
<body>
  <div class="content">1</div>
  <div class="content">2</div>
  <div class="content">3</div>
  <div class="content">4</div>
</body>
</html>
```

```js
const puppeteer = require('puppeteer')
const chromePageEval = require('chrome-page-eval')
const chromeEval = chromePageEval({ puppeteer })

(async () => {
  try {
    const result = await chromeEval({
      html: '/path/to/sample.html',
      scriptFn: `
        function () {
          let title = document.title

          let content = Array.from(document.querySelectorAll('.content'), (node) => {
            return node.textContent
          })

          return {
            title,
            content
          }
        }
      `
    })

    console.log(result.title) // -> Test page
    console.log(result.content) // -> [1, 2, 3, 4]
  } catch (e) {
    console.error('Error while trying to evaluate script:', e)
  }
})()
```

## Constructor options

```js
const chromePageEval = require('chrome-page-eval')
const chromeEval = chromePageEval({ /*[constructor options here]*/ })
```

- `puppeteer` **[required]** - the exported module from [puppeteer](https://github.com/GoogleChrome/puppeteer) that your app is going to use
- properties with [any of the launch options supported by puppeteer](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#puppeteerlaunchoptions)

## Evaluate options

```js
const puppeteer = require('puppeteer')
const chromePageEval = require('chrome-page-eval')
const chromeEval = chromePageEval({ puppeteer })

(async () => {
  const result = await chromeEval({ /*[evaluate options here]*/ })
})()
```

- `html` **string** **[required]** - the path to the html file to load in a Chrome page
- `scriptFn` **string** **[required]** - the script to evaluate in the Chrome page. the script must be a function that returns a value. ex: `scriptFn: 'function () { return 1 + 2}'`
- `viewport` **object** - object with [any of the viewport options supported by puppeteer](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagesetviewportviewport)
- `args` **array** - a list of custom arguments to pass to the `scriptFn` function. ex: `args: [1, 2]` and with `scriptFn: function (a, b) { return a + b}'` will produce `3` as result
- `styles` **array<string>** - array of css strings to insert at the beginning of page's head element. ex: `styles: ['* { font-family: 'Calibri'; font-size: 16px; }']`
- `waitForJS` **boolean** - when `true` the `scriptFn` won't be executed until the variable specified in `waitForJSVarName` option is set to true in page's javscript. defaults to `false`
- `waitForJSVarName` **string** - name of the variable that will be used as trigger of `scriptFn`. defaults to `"CHROME_PAGE_EVAL_READY"`
- `waitUntil` **string** - a value that specifies when a page is considered to be loaded, [for the list of all possible values and its meanings see `waitUntil` option in puppeteer docs](https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md#pagegotourl-options). defaults to the the default value of puppeteer
- `timeout` **number** - time in ms to wait for the script evaluation to complete, when the timeout is reached the evaluation is cancelled. defaults to `30000`

## Requirements

- Install puppeteer >= 1.0.0 with `npm install puppeteer --save` in your project and pass it to `chrome-page-eval` constructor function.

## Caveats

- What you return in your script function (`scriptFn` option) must be a [serializable value](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description) in order to receive it properly, if a non serializable value is returned you will get `undefined` as the result.

## Debugging

- To get more information (internal debugging logs of the module) about what's happening during the evaluation on the page start your app in this way: `DEBUG=chrome-page-eval* node [your-entry-file-here].js` (on Windows use `set DEBUG=chrome-page-eval* && node [your-entry-file-here].js`). This will print out to the console some additional information about what's going on.

- To see the Chrome instance created (the visible chrome window) run your app with the `CHROME_PAGE_EVAL_DEBUGGING` env var: `CHROME_PAGE_EVAL_DEBUGGING=true node [your-entry-file-here].js` (on Windows use `set CHROME_PAGE_EVAL_DEBUGGING=true && node [your-entry-file-here].js`).

## License
See [license](https://github.com/bjrmatos/chrome-page-eval/blob/master/LICENSE)
