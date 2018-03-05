'use strict'

const path = require('path')
const url = require('url')
const pkg = require('../package.json')
const debugMe = require('debug')(`${pkg.name}:eval`)

const pTimeout = (prom, ms, msg) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error(`Timeout Error: ${msg}`)
      reject(err)
    }, ms)

    prom.then((result) => {
      clearTimeout(timer)
      resolve(result)
    }, (err) => {
      clearTimeout(timer)
      reject(err)
    })
  })
}

module.exports = (puppeteer, options) => {
  const DEBUGGING = process.env.CHROME_PAGE_EVAL_DEBUGGING != null
  let launchOptions = Object.assign({}, options.launchOptions)

  if (DEBUGGING) {
    debugMe(
      `${'debugging mode enabled, '}${
        'chrome process will be started in normal mode (no headless), '}${
        'and the process and open pages won\'t be closed'}`
    )

    launchOptions = Object.assign(launchOptions, {
      headless: false
    })
  }

  return (
    async function evaluate ({
      html,
      scriptFn,
      viewport,
      args = [],
      waitUntil,
      // use the same default value of puppeteer
      timeout = 30000
    }) {
      if (html == null) {
        throw new Error('required `html` option not specified')
      }

      if (scriptFn == null) {
        throw new Error('required `scriptFn` option not specified')
      }

      if (typeof timeout !== 'number') {
        throw new Error('`timeout` option must be a number')
      }

      debugMe('launching new chrome process with options:', launchOptions)

      const browser = await puppeteer.launch(launchOptions)

      debugMe(`going to run evaluation in Chrome version: ${browser.version()}`)

      try {
        debugMe('starting new page')

        const page = await browser.newPage()

        if (viewport != null) {
          debugMe('using custom viewport:', viewport)
        } else {
          debugMe('using default puppeteer viewport')
        }

        debugMe('configured timeout:', timeout)

        // setDefaultNavigationTimeout needs a non empty value, otherwhise
        // it won't use the default timeout provied by puppeteer
        if (timeout != null) {
          page.setDefaultNavigationTimeout(timeout)
        }

        if (!path.isAbsolute(html)) {
          throw new Error('`html` option must be an absolute path to a file')
        }

        const htmlUrl = url.format({
          protocol: 'file',
          pathname: html
        })

        debugMe(`loading page from ${htmlUrl} (wait until: ${
          waitUntil == null ? '<default>' : waitUntil
        })`)

        await page.goto(
          htmlUrl,
          waitUntil != null ? { waitUntil } : {}
        )

        page.on('console', (m) => {
          debugMe(`message from console: ${m}`)
        })

        debugMe('evaluating scriptFn with args:', args)

        const result = await pTimeout(
          page.evaluate((rawFnSource, ...customArgs) => {
            let fnSource = rawFnSource.trim()

            fnSource = fnSource.slice(-1) === ';' ? fnSource.slice(0, -1) : fnSource

            let fn

            try {
              // eslint-disable-next-line
              fn = window.eval(`(function result() {
                return (${fnSource})
              })()`)
            } catch (e) {
              throw new Error(`script code passed as \`scriptFn\` option has syntax error: ${e.message}`)
            }

            if (typeof fn !== 'function') {
              throw new Error('script code passed as `scriptFn` option is not a function')
            }

            return fn.apply(null, customArgs)
          }, scriptFn, ...args),
          timeout,
          `script evaluation not completed after ${timeout}ms`
        )

        debugMe('evaluation completed with result:', result)

        if (!DEBUGGING) {
          debugMe('closing chrome process')
          await browser.close()
          debugMe('chrome process closed')
        } else {
          debugMe('debugging mode is enabled: not closing chrome process')
        }

        return result
      } catch (e) {
        debugMe(`error while running: ${e.message}`)

        if (!DEBUGGING) {
          debugMe('closing chrome process')
          // ensuring the closing of the chrome process in case of any error
          await browser.close()
          debugMe('chrome process closed')
        } else {
          debugMe('debugging mode is enabled: not closing chrome process')
        }

        throw e
      }
    }
  )
}
