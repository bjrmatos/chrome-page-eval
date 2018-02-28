'use strict'

const pkg = require('./package.json')
const debugMe = require('debug')(pkg.name)
const evalImplementation = require('./lib/eval')

module.exports = (options = {}) => {
  const { puppeteer, ...rest } = options

  if (!puppeteer) {
    throw new Error('required `puppeteer` option not specified, make sure to install puppeteer and pass it to the constructor')
  }

  debugMe('Creating a new evaluate function with options:', rest)

  return evalImplementation(puppeteer, rest)
}
