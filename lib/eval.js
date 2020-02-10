'use strict'

const path = require('path')
const url = require('url')
const pkg = require('../package.json')
const debugMe = require('debug')(`${pkg.name}:eval`)

const runWithTimeout = (fn, ms, msg) => {
  return new Promise(async (resolve, reject) => {
    let resolved = false

    const info = {
      // information to pass to fn to ensure it can cancel
      // things if it needs to
      error: null
    }

    const timer = setTimeout(() => {
      const err = new Error(`Timeout Error: ${msg}`)
      info.error = err
      resolved = true
      reject(err)
    }, ms)

    try {
      const result = await fn(info, reject)

      if (resolved) {
        return
      }

      resolve(result)
    } catch (e) {
      if (resolved) {
        return
      }

      reject(e)
    } finally {
      clearTimeout(timer)
    }
  })
}

module.exports = (puppeteer, options) => {
  const DEBUGGING = process.env.CHROME_PAGE_EVAL_DEBUGGING != null
  let launchOptions = Object.assign({
    defaultViewport: null
  }, options.launchOptions, {
    args: [...(options.launchOptions != null && Array.isArray(options.launchOptions.args) ? options.launchOptions.args : [])]
  })

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
      styles = [],
      waitForJS = false,
      waitForJSVarName = 'CHROME_PAGE_EVAL_READY',
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

      let browser
      let browserClosed = false

      try {
        const result = await runWithTimeout(async (timeoutInfo, reject) => {
          debugMe('launching new chrome process with options:', launchOptions)

          try {
            browser = await puppeteer.launch(launchOptions)

            if (timeoutInfo.error) {
              return
            }

            debugMe(`going to run evaluation in Chrome version: ${browser.version()}`)

            debugMe('starting new page')

            const page = await browser.newPage()

            if (timeoutInfo.error) {
              return
            }

            if (viewport != null) {
              debugMe('using custom viewport:', viewport)
              await page.setViewport(viewport)
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

            page.on('error', reject)

            page.on('console', (m) => {
              debugMe(`message from console: ${m}`)
            })

            await page.goto(
              htmlUrl,
              waitUntil != null ? { waitUntil } : {}
            )

            if (timeoutInfo.error) {
              return
            }

            if (styles.length > 0) {
              debugMe('Chrome will add custom styles at the beginning of page..')

              await page.evaluate((styles) => {
                const fragment = document.createDocumentFragment()

                styles.forEach((css) => {
                  const styleNode = document.createElement('style')
                  styleNode.appendChild(document.createTextNode(css))
                  fragment.appendChild(styleNode)
                })

                document.head.insertBefore(fragment, document.head.firstChild)
              }, styles)
            }

            if (timeoutInfo.error) {
              return
            }

            if (waitForJS === true) {
              debugMe('Chrome will wait for JS trigger..')
              await page.waitForFunction(`window.${waitForJSVarName} === true`, { timeout })
            }

            debugMe('evaluating scriptFn with args:', args)

            const result = await page.evaluate((rawFnSource, ...customArgs) => {
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
            }, scriptFn, ...args)

            if (timeoutInfo.error) {
              return
            }

            debugMe('evaluation completed with result:', result)

            return result
          } finally {
            // this block can be fired when there is a timeout and
            // runWithTimeout was resolved but we cancel the code branch with "return"
            if (!DEBUGGING) {
              if (browser && !browserClosed) {
                browserClosed = true
                debugMe('closing chrome process')
                await browser.close()
                debugMe('chrome process closed')
              }
            } else {
              debugMe('debugging mode is enabled: not closing chrome process')
            }
          }
        }, timeout, `script evaluation not completed after ${timeout}ms`)

        return result
      } finally {
        if (!DEBUGGING) {
          if (browser && !browserClosed) {
            browserClosed = true
            debugMe('closing chrome process')
            await browser.close()
            debugMe('chrome process closed')
          }
        } else {
          debugMe('debugging mode is enabled: not closing chrome process')
        }
      }
    }
  )
}
