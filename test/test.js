const should = require('should')
const path = require('path')
const fs = require('fs')
const puppeteer = require('puppeteer')
const chromePageEval = require('../')

const sampleHtml = fs.readFileSync(
  path.join(__dirname, 'sample.html')
).toString()

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
        html: sampleHtml,
        scriptFn: `1 + 2`
      })
    ).be.rejected()
  })

  it('should eval simple script', async () => {
    const result = await chromeEval({
      html: 'hello',
      scriptFn: 'function () { return 1 + 2 }'
    })

    should(result).be.eql(3)
  })

  it('should eval script that uses DOM', async () => {
    const result = await chromeEval({
      html: sampleHtml,
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
      html: '',
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
        html: '',
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
})
