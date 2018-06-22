'use strict'

const should = require('should')
const path = require('path')
const puppeteer = require('puppeteer')
const chromePageEval = require('../')

const sampleHtmlPath = path.join(__dirname, 'sample.html')

describe('chrome-page-eval', () => {
  let chromeEval

  beforeEach(() => {
    chromeEval = chromePageEval({ puppeteer })
  })

  it('should fail when no puppeteer is specified', () => {
    should(() => {
      chromePageEval()
    }).throw()
  })

  it('should fail when required options are not specified', async () => {
    return should(
      chromeEval()
    ).be.rejected()
  })

  it('should fail with invalid script', async () => {
    return should(
      chromeEval({
        html: sampleHtmlPath,
        scriptFn: `1 + 2`
      })
    ).be.rejected()
  })

  it('should eval simple script', async () => {
    const result = await chromeEval({
      html: sampleHtmlPath,
      scriptFn: 'function () { return 1 + 2 }'
    })

    should(result).be.eql(3)
  })

  it('should eval script that uses DOM', async () => {
    const result = await chromeEval({
      html: sampleHtmlPath,
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

    should(result).be.Object()
    should(result.title).be.eql('Test page')
    should(result.content).have.length(4)
  })

  it('should pass custom args to script', async () => {
    const result = await chromeEval({
      html: sampleHtmlPath,
      args: [1, 2],
      scriptFn: `
        function (x, y) {
          return x + y
        }
      `
    })

    should(result).be.eql(3)
  })

  it('should timeout with blocking script', async () => {
    return should(
      chromeEval({
        html: sampleHtmlPath,
        timeout: 1500,
        scriptFn: `
          function () {
            while (true) {

            }

            return 'test'
          }
        `
      })
    ).be.rejectedWith(/Timeout/)
  })

  describe('chrome crashing', () => {
    let originalUrlFormat

    beforeEach(() => {
      originalUrlFormat = require('url').format
    })

    afterEach(() => {
      require('url').format = originalUrlFormat
    })

    it('should handle page.on(error) and reject', (done) => {
      require('url').format = () => 'chrome://crash'
      process.on('unhandledRejection', () => done(new Error('Rejection should be handled!')))

      chromeEval({
        html: sampleHtmlPath,
        timeout: 1500,
        scriptFn: `
          function () {
            return 1 + 2
          }
        `
      }).catch(() => done())
    })
  })
})
