// /*
//  * Copyright 2018 IBM Corporation
//  *
//  * Licensed under the Apache License, Version 2.0 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  * http://www.apache.org/licenses/LICENSE-2.0
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  */
//
// import * as Debug from 'debug'
// const debug = Debug('plugins/apache-composer/tests/headless')
// import * as assert from 'assert'
// import * as path from 'path'
// import { exec } from 'child_process'
// import * as common from '@kui-shell/core/tests/lib/common'
// import * as openwhisk from '@kui-shell/plugin-openwhisk/tests/lib/openwhisk/openwhisk'
// import * as ui from '@kui-shell/core/tests/lib/ui'
// import { cli } from '@kui-shell/core/tests/lib/headless'
//
// interface IResponse {
//   code: number
//   output: {}
//   stderr?: string
// }
//
// const expect = {
//
//   appList: ({ name, packageName }) => ({ code: actualCode, output: actualOutput }) => {
//     assert.strictEqual(actualCode, 0)
//     const lines = actualOutput.split('\n')
//     assert.strictEqual(lines[0].replace(/\s+/g, ' ').trim(), 'name type')
//
//     let foundMatch = false
//     for (let num = 1; num < lines.length; num++) {
//       const appRow = lines[num].replace(/\s+/g, ' ').trim()
//       if (packageName !== '') {
//         if (appRow === `${packageName}/${name} composition`) {
//           foundMatch = true
//         }
//       } else {
//         if (appRow === `${name} composition`) {
//           foundMatch = true
//         }
//       }
//     }
//     assert.ok(foundMatch)
//     return actualOutput
//   },
//
//   json: ({ expectedOutput, expectedKeys }) => ({ code: actualCode, output: actualOutput }) => {
//     assert.strictEqual(actualCode, 0)
//     actualOutput = JSON.parse(actualOutput)
//
//     if (expectedKeys) {
//       debug('expected', expectedKeys)
//       debug('actual', actualOutput)
//       for (let key in actualOutput) {
//         debug(`checking if ${key} is in expectedKeys`)
//         assert(expectedKeys.includes(key))
//       }
//       debug('expected keys have all keys in acutal output')
//       for (let key in expectedKeys) {
//         debug(`checking if ${expectedKeys[key]} is in actualOutput`)
//         assert(actualOutput[expectedKeys[key]] !== 'undefined')
//       }
//       debug('actual ouputs have all expected keys')
//     }
//     if (expectedOutput) assert.deepStrictEqual(actualOutput, expectedOutput)
//     return actualOutput
//   }
// }
//
// const validation = {
//   appList: ({ name, packageName = '', namespace = '' }) => {
//     if (namespace !== '') {
//       it(`validate app list /${namespace}`, () => cli.do(`app list /${namespace}`)
//         .then(expect.appList({ name, packageName }))
//         .catch(common.oops(this)))
//     }
//
//     if (packageName !== '') {
//       it(`validate app list ${packageName}/`, () => cli.do(`app list ${packageName}/`)
//         .then(expect.appList({ name, packageName }))
//         .catch(common.oops(this)))
//     }
//
//     it(`validate app list`, () => cli.do(`app list`)
//       .then(expect.appList({ name, packageName }))
//       .catch(common.oops(this)))
//   },
//
//   // every app invoke commands are converted to blocking invocation and only displays the response result
//   invoke: ({ name, params = '', output, packageName = '', namespace = '' }) => {
//     if (packageName !== '') name = `${packageName}/${name}`
//     if (namespace !== '') name = `/${namespace}/${name}`
//
//     const invokers = [`app invoke ${name} ${params}`,
//       `app invoke ${name} -b ${params}`,
//       `app invoke ${name} -r ${params}`,
//       `app invoke ${name} -br ${params}`,
//       `app invoke ${name} --result ${params}`,
//       `app invoke ${name} --blocking --result ${params}`]
//
//     invokers.forEach(invoker => {
//       it(`validate ${invoker}`, () => cli.do(invoker)
//         .then(expect.json({ expectedOutput: output, expectedKeys: undefined }))
//         .catch(common.oops(this)))
//     })
//   },
//
//   async: ({ name, output, packageName = '', namespace = '' }) => {
//     if (packageName !== '') name = `${packageName}/${name}`
//     if (namespace !== '') name = `/${namespace}/${name}`
//
//     it(`validate async ${name}`, () => cli.do(`app async ${name}`)
//       .then(cli.expectOK(`ok: invoked ${name} with id`, { exact: false }))
//       .catch(common.oops(this)))
//
//     it(`validate async ${name} ; session get ; session list`, () => cli.do(`app async ${name}`)
//       .then(cli.expectOK(`ok: invoked ${name} with id`, { exact: false }))
//       .then(line => { // session get
//         const match = line.match(/with id (.*)[\s]*$/)
//         assert.ok(match)
//         assert.strictEqual(match.length, 2)
//         const sessionId = match[1]
//
//         return new Promise((resolve, reject) => {
//           const fetch = (retry) => cli.do(`session get ${sessionId}`)
//             .then(response => {
//               if (response.code === 404 - 256) { // retry on 404, because the session might not yet be available
//                 if (retry < 5) {
//                   console.error(`${retry} retry session get ${name} when 404`)
//                   setTimeout(function () { fetch(retry + 1) }, 2000)
//                 } else {
//                   throw new Error(response.stderr)
//                 }
//               } else {
//                 expect.json({ expectedOutput: undefined, expectedKeys: ['activationId', 'annotations', 'duration','end', 'logs', 'name', 'namespace','response', 'start', 'subject'] })(response)
//                 resolve(sessionId)
//               }
//             }).catch(reject)
//
//           fetch(0)
//         })
//       })
//       .then(sessionId => {// session list
//         return new Promise((resolve, reject) => {
//           const fetchList = (retry) => cli.do(`session list`)
//             .then(response => {
//               const lines = response.output.split(/\n/)
//               const names = name.split('/')
//               const nameWithoutPackage = names[names.length - 1]
//
//               cli.expectOK('activationId name', { exact: true, skipLines: 0, squish: true })({ code: response.code, output: lines[0] }) // check the title line
//               if (lines.indexOf(`${sessionId} ${nameWithoutPackage}`) === -1) { // Retry when not found, becuase the session might not yet be available for listing
//                 if (retry < 10) {
//                   console.error(`${retry} retry session list when not found ${sessionId} ${nameWithoutPackage}`)
//                   debug('session list result', lines)
//                   setTimeout(function () { fetchList(retry + 1) }, 2000)
//                 } else {
//                   throw Error(`session list could not find session id: ${sessionId}`)
//                 }
//               } else {
//                 resolve()
//               }
//             }).catch(reject)
//
//           fetchList(0)
//         })
//       })
//       .catch(common.oops(this)))
//   },
//
//   appGet: ({ name, packageName = '', namespace = '' }) => {
//     if (packageName !== '') name = `${packageName}/${name}`
//     if (namespace !== '') name = `/${namespace}/${name}`
//
//     let expectedKeys = ['annotations','limits','name','namespace','parameters', 'kind']
//     if (packageName !== '') expectedKeys.push('packageName')
//
//     it(`validate app get ${name}`, () => cli.do(`app get ${name}`)
//       .then(expect.json({ expectedOutput: undefined, expectedKeys: expectedKeys }))
//       .catch(common.oops(this)))
//   },
//
//   do: ({ name, packageName = '', namespace = '', output, params = '', outputWithParams = {} }) => {
//     validation.appList({ name, packageName, namespace })
//     validation.invoke({ name, output, packageName, namespace })
//     if (params) validation.invoke({ name, params, output: outputWithParams, packageName, namespace })
//     validation.async({ name, output, packageName, namespace })
//     validation.appGet({ name, packageName, namespace })
//   }
//
// }
//
// describe('Composer Headless Test :', function (this: common.ISuite) {
//   before(openwhisk.before(this, { noApp: true }))
//
//   describe('should create simple composition from @demos', function () {
//     it('app create test1 @demos/hello.js', () => cli.do('app create test1 @demos/hello.js')
//       .then(cli.expectOK('ok: updated composition test1\n', { exact: true }))
//       .catch(common.oops(this)))
//     validation.do({ name: 'test1', output: { msg: 'hello world!' }, params: '-p name Users', outputWithParams: { msg: 'hello Users!' } })
//   })
//
//   describe('app list options', function () {
//     it('should get empty result by app list --limit 0', () => cli.do('app list --limit 0')
//       .then(cli.expectOK('', { exact: true }))
//       .catch(common.oops(this)))
//
//     it('should get 1 by app list --count', () => cli.do('app list --count')
//       .then(cli.expectOK('1\n', { exact: true }))
//       .catch(common.oops(this)))
//
//     it('should get test1 by app list --limit 1', () => cli.do('app list --limit 1')
//       .then(expect.appList({ name: 'test1', packageName: '' }))
//       .catch(common.oops(this)))
//
//     it('should get empty result by app list --skip 1', () => cli.do('app list --skip 1')
//       .then(cli.expectOK('', { exact: true }))
//       .catch(common.oops(this)))
//   })
//
//   describe('should create composition with package', function () {
//     it('should fail with 404 when creating composition with non-existing package', () => cli.do('app create testing/subtest1 @demos/hello.js')
//       .then(cli.expectError(cli.exitCode(404)))
//       .catch(common.oops(this)))
//
//     it('should create package first', () => cli.do('wsk package create testing')
//       .then(cli.expectOK('ok: updated package testing\n', { exact: true }))
//       .catch(common.oops(this)))
//
//     it('validate app create testing/subtest1 @demos/hello.js', () => cli.do('app create testing/subtest1 @demos/hello.js')
//       .then(cli.expectOK('ok: updated composition testing/subtest1\n', { exact: true }))
//       .catch(common.oops(this)))
//
//     validation.do({ name: 'subtest1', packageName: 'testing', output: { msg: 'hello world!' }, params: '-p name Users', outputWithParams: { msg: 'hello Users!' } })
//   })
//
//   if (ui.expectedNamespace()) {
//     describe('should create composition with namespace', function () {
//       it('validate app create with namespace', () => cli.do(`app create /${ui.expectedNamespace()}/testing/subtest2 @demos/hello.js`)
//         .then(cli.expectOK(`ok: updated composition testing/subtest2\n`, { exact: true }))
//         .catch(common.oops(this)))
//       validation.do({ name: 'subtest2', packageName: 'testing', namespace: ui.expectedNamespace(), output: { msg: 'hello world!' }, params: '-p name Users', outputWithParams: { msg: 'hello Users!' } })
//     })
//   }
//
//   describe('should fail when creating composition from non-exisiting file', function () {
//     it('fails app create error error.js', () => cli.do('app create error error.js')
//       .then(cli.expectError(1))
//       .catch(common.oops(this)))
//   })
//
//   describe('should create compostion and dependent actions with implicity entity', function () {
//     it('validate app create test2 @demos/if.js', () => cli.do('app create test2 @demos/if.js')
//       .then(cli.expectOK('ok: updated composition test2\n', { exact: true }))
//       .catch(common.oops(this)))
//
//     it('validate app invoke test2 fails', () => cli.do('app invoke test2')
//       .then(res => res.output.indexOf('Failed to resolve action') !== -1)
//       .catch(common.oops(this)))
//   })
//
//   describe('should update simple composition', function () {
//     it('validate app update test1 @demos/let.js', () => cli.do('app update test1 @demos/let.js')
//       .then(cli.expectOK('ok: updated composition test1\n', { exact: true }))
//       .catch(common.oops(this)))
//     validation.do({ name: 'test1', output: { ok: true } })
//   })
//
//   describe('should update simple composition with packageName', function () {
//     it('validate app update testing/subtest1 @demos/let.js', () => cli.do('app update testing/subtest1 @demos/let.js')
//       .then(cli.expectOK('ok: updated composition testing/subtest1\n', { exact: true }))
//       .catch(common.oops(this)))
//     validation.do({ name: 'subtest1', packageName: 'testing', output: { ok: true } })
//   })
//
//   if (ui.expectedNamespace()) {
//     describe('should update simple composition with namespace', function () {
//       it(`validate app update /${ui.expectedNamespace()}/testing/subtest2 @demos/let.js`, () => cli.do(`app update /${ui.expectedNamespace()}/testing/subtest2 @demos/let.js`)
//         .then(cli.expectOK(`ok: updated composition testing/subtest2\n`, { exact: true }))
//         .catch(common.oops(this)))
//       validation.do({ name: 'subtest2', packageName: 'testing', namespace: ui.expectedNamespace(), output: { ok: true } })
//     })
//   }
//
//   describe('should fail when updating with non-existing path', function () {
//     it('should fail when updating with non-existing path', () => cli.do('app update test2 @demos/dummy.js')
//       .then(cli.expectError(1))
//       .catch(common.oops(this)))
//   })
//
//   describe('should delete tests', function () {
//     it('validate app delete test1', () => cli.do('app delete test1')
//       .then(cli.expectOK())
//       .catch(common.oops(this)))
//
//     it('validate app delete test2', () => cli.do('app delete test2')
//       .then(cli.expectOK())
//       .catch(common.oops(this)))
//
//     it('validate app delete testing/subtest1', () => cli.do('app delete testing/subtest1')
//       .then(cli.expectOK())
//       .catch(common.oops(this)))
//
//     if (ui.expectedNamespace()) {
//       it(`validate app delete /${ui.expectedNamespace()}/testing/subtest2`, () => cli.do(`app delete /${ui.expectedNamespace()}/testing/subtest2`)
//         .then(cli.expectOK())
//         .catch(common.oops(this)))
//     }
//   })
//
//   describe('error handling with non-exisiting composition', function () {
//     it('should 404 when invoking deleted composition', () => cli.do('app invoke test2')
//       .then(cli.expectError(cli.exitCode(404)))
//       .catch(common.oops(this)))
//
//     it('should 404 when invoking non-existent composition', () => cli.do('app invoke dummy')
//       .then(cli.expectError(cli.exitCode(404)))
//       .catch(common.oops(this)))
//
//     it('should 404 when deleting non-existent composition', () => cli.do('app delete dummy')
//       .then(cli.expectError(cli.exitCode(404)))
//       .catch(common.oops(this)))
//   })
// })
