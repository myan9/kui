/*
 * Copyright 2018 IBM Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const debug = require('debug')('test.headless')

const assert = require('assert')
const { fileSync: makeTempFile } = require('tmp')
const { readFile } = require('fs')
const { exec } = require('child_process')

const { join } = require('path')

const ROOT = process.env.TEST_ROOT
const kui = process.env.KUI || join(ROOT, '../bin/kui')
const bindir = join(ROOT, '../bin') // should contain kubectl-kui
const { expectStruct, expectSubset } = require('./ui')

/**
 * For tee to file mode, the core obliges us, and writes any electron
 * output to a file we provide; we can also request that it write an
 * end marker when it is done.
 *
 * @see app/src/webapp/cli.ts
 *
 */
const KUI_TEE_TO_FILE_END_MARKER = 'XXX_KUI_END_MARKER'

/**
 * readFile that returns a promise
 *
 */
const readFileAsync = (fd/* : number */) => new Promise((resolve, reject) => {
  readFile(fd, (err, data) => {
    if (err) {
      reject(err)
    } else {
      console.log('trying to read data:', data)
      resolve(data)
    }
  })
})

/**
 * Poll a given file descriptor `fd` for the end marker
 *
 */
const pollForEndMarker = async (fd/*: number */)/* : Promise<string> */ => {
  return new Promise((resolve, reject) => {
    const wait = async (ms) => {
      return new Promise(resolve => {
        setTimeout(resolve, ms)
      })
    }

    const iter = async (tryTimes) => {
      try {
        console.log(`${tryTimes} try polling for end marker`)
        const maybe = await readFileAsync(fd)
        if (maybe.indexOf(KUI_TEE_TO_FILE_END_MARKER) >= 0) {
          resolve(maybe.toString().replace(KUI_TEE_TO_FILE_END_MARKER, ''))
        } else { // wait and retry, since launching UI needs time
          if (tryTimes < 30) {
            wait(2000)
              .then(() => iter(tryTimes + 1))
          } else throw new Error('Failed to poll end marker')
        }
      } catch (err) {
        reject(err)
      }
    }

    iter(1)
  })
}

/**
 * Append to a PATH env; note this is not a filesystem path, but
 * rather the executable PATH environment variable.
 *
 */
const appendPATH = (path, extra) => {
  if (!extra) {
    return path
  } else {
    const sep = process.platform === 'win32' ? ';' : ':'
    return `${path}${sep}${extra}`
  }
}

/**
 * The default CLI impl
 *
 */
class CLI {
  constructor (exe = kui, pathEnv, teeToFile = false) {
    this.exe = exe
    this.pathEnv = pathEnv
    this.teeToFile = teeToFile
  }

  /**
   * Execute a command
   *
   */
  do (cmd, env = {}, { errOk = undefined } = {}) {
    return new Promise((resolve, reject) => {
      const command = `${this.exe} ${cmd} --no-color`
      debug('executing command', command)

      const ourEnv = Object.assign(
        {},
        process.env,
        env,
        { PATH: appendPATH(env.PATH || process.env.PATH, this.pathEnv) })

      // for headless-to-electron tests, we leverage the
      // KUI_TEE_TO_FILE support offered by the core.
      let tmpobj = { removeCallback: () => true }
      if (this.teeToFile) {
        tmpobj = makeTempFile()
        ourEnv.KUI_TEE_TO_FILE = tmpobj.name
        console.log(ourEnv.KUI_TEE_TO_FILE)
        ourEnv.KUI_TEE_TO_FILE_END_MARKER = KUI_TEE_TO_FILE_END_MARKER
        ourEnv.KUI_TEE_TO_FILE_EXIT_ON_END_MARKER = true
        // ourEnv.DEBUG = '*' // be careful with this one, as it is incompatible with child_process.exec
      }

      exec(command, { env: ourEnv }, async (err, stdout, stderr) => {
        if (this.teeToFile) debug('tee done', command)
        const stdoutPromise = this.teeToFile ? pollForEndMarker(tmpobj.fd) : Promise.resolve(stdout)

        if (err) {
          // command failed miserably; collect all of the output of
          // the command, so we can log this information
          const output = stdout.trim().concat(stderr)

          // delete any temporary files that supported the teeToFile capability
          tmpobj.removeCallback()

          if (err['code'] !== errOk) {
            console.error('Error in command execution', err['code'], output)
          }
          resolve({ code: err['code'], output })
        } else {
          // command execution got somewhere, now we can inspect the
          // output
          debug('stdout', stdout)
          debug('stderr', stderr)

          console.log('stdout', stdout)
          console.log('stderr', stderr)

          try {
            const output = await stdoutPromise
            resolve({ code: 0, output, stderr })
          } catch (err) { // FIXME: maybe no need for this catch
            reject(err)
          }
        }
      })
    })
  }

  /**
   * Exit code code for the given http status code.
   * See ui.js for the analogous electron implementation.
   */
  exitCode (statusCode) {
    return statusCode - 256
  }

  expectJustOK () {
    return args => {
      return this.expectOK('', { exect: true })(args)
    }
  }

  expectOKWithAny () {
    return args => {
      return this.expectOK()
    }
  }

  expectOK (expectedOutput, { exact = false, skipLines = 0, squish = false } = {}) {
    return ({ code: actualCode, output: actualOutput }) => {
      assert.strictEqual(actualCode, 0)
      if (expectedOutput) {
        if (typeof expectedOutput === 'object') {
          // json check
          if (exact) {
            return expectStruct(expectedOutput)(actualOutput)
          } else {
            return expectSubset(expectedOutput)(actualOutput)
          }
        } else {
          // string check
          let checkAgainst = actualOutput

          // skip a number of initial lines?
          if (skipLines > 0) {
            checkAgainst = checkAgainst.split(/\n/).slice(1).join('\n')
          }

          // squish whitespace?
          if (squish) {
            checkAgainst = checkAgainst.split(/\n/).map(_ => _.replace(/\s+/g, ' ').trim()).join('\n').trim()
          }

          if (exact) {
            if (checkAgainst !== expectedOutput) {
              console.error(`mismatch; actual='${actualOutput}'; expected='${checkAgainst}'`)
            }
            assert.strictEqual(checkAgainst, expectedOutput)
          } else {
            debug('expectedOutput', expectedOutput)
            debug('actualOutput', actualOutput)
            debug('checkAgainst', checkAgainst)

            const ok = checkAgainst.indexOf(expectedOutput) >= 0
            if (!ok) {
              console.error(`mismatch; actual='${actualOutput}' checkAgainst='${checkAgainst}'; expected='${expectedOutput}'`)
            }
            assert.ok(ok)
          }
        }
      }

      return actualOutput
    }
  }

  expectError (expectedCode, expectedOutput) {
    return ({ code: actualCode, output: actualOutput }) => {
      assert.strictEqual(actualCode, expectedCode)
      if (expectedOutput) {
        const ok = typeof expectedOutput === 'string'
          ? actualOutput.indexOf(expectedOutput) >= 0
          : !!actualOutput.match(expectedOutput) // expectedOutput is a RegExp
        if (!ok) {
          console.error(`mismatch; actual='${actualOutput}'; expected='${expectedOutput}'`)
        }
        assert.ok(ok)
      }
      return actualOutput
    }
  }
}

/** bin/kui impl */
exports.cli = new CLI()

/** bin/kui --ui impl */
exports.kuiElectron = new CLI(kui, undefined, true) // the last true requests teeToFile mode

/** kubectl kui impl */
exports.kubectl = new CLI('kubectl kui', bindir)

/** kubectl kui --ui impl */
exports.kubectlElectron = new CLI('kubectl kui', bindir, true) // the last true requests teeToFile mode
