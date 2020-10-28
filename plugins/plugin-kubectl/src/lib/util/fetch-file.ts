/*
 * Copyright 2018-20 IBM Corporation
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

import Debug from 'debug'
import needle from 'needle'
import { REPL, inBrowser, isHeadless, hasProxy, CodedError, i18n, flatten } from '@kui-shell/core'

const strings = i18n('plugin-kubectl')
const debug = Debug('plugin-kubectl/util/fetch-file')

async function _needle({ qexec }: REPL, method: 'get', url: string): Promise<{ statusCode: number; body: string }> {
  if (isHeadless()) {
    debug('fetch via needle', needle)
    return needle(method, url, { follow_max: 10 }).then(_ => ({ statusCode: _.statusCode, body: _.body }))
  } else if (inBrowser()) {
    // Unfortunately, we cannot rely on being able to fetch files
    // directly from a browser. For one, if the remote site does not
    // offer an Access-Control-Allow-Origin, then well behaving
    // browsers will refuse to load their content;
    // e.g. https://k8s.io/examples/controllers/nginx-deployment.yaml
    // Solution: have the kui proxy do this
    if (!hasProxy()) {
      throw new Error(strings('Unable to fetch remote file'))
    } else {
      debug('fetch via proxy')
      const body = await qexec<string>(`_fetchfile ${url}`)
      debug('fetched via proxy', body)
      return {
        statusCode: 200,
        body
      }
    }
    /* return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open(method, url, true)
      xhr.withCredentials = true
      xhr.addEventListener('error', () => {
        console.error('error in xhr', xhr)
        reject(xhr.response || 'Internal Error')
      })
      xhr.addEventListener('load', () => {
        resolve({
          statusCode: xhr.status,
          body: typeof xhr.response === 'string' ? xhr.response : xhr.response.response
        })
      })
      xhr.send()
    }) */
  } else {
    debug('fetch via electron.net')
    const { net } = (await import('electron')).remote

    return new Promise((resolve, reject) => {
      const request = net.request({
        method,
        url,
        redirect: 'follow'
      })

      request.on('response', response => {
        const statusCode = response.statusCode
        debug('got response', statusCode)

        // we will accumulate the body chunks below
        let body = ''

        // Warning: you must register 'end' before 'data'.
        // https://github.com/electron/electron/issues/12545
        response.on('end', () => {
          debug('got end')
          if (response.statusCode < 300) {
            resolve({ statusCode, body })
          } else {
            const error: CodedError = new Error(body)
            error.statusCode = statusCode
            reject(error)
          }
        })

        response.on('data', chunk => {
          // debug('got chunk', chunk.toString())
          body += chunk.toString()
        })
      })

      request.end()
    })
  }
}

interface FetchedFile {
  data: string | Buffer
  filepath: string
}

/**
 * Either fetch a remote file or read a local one
 *
 */
export async function fetchFile(repl: REPL, url: string): Promise<string | Buffer> {
  console.error('fetchFile', url)

  if (url.match(/http(s)?:\/\//)) {
    debug('fetch remote', url)
    const fetchOnce = () => _needle(repl, 'get', url).then(_ => _.body)

    const retry = (delay: number) => async (err: Error) => {
      if (/timeout/.test(err.message) || /hang up/.test(err.message) || /hangup/.test(err.message)) {
        debug('retrying', err)
        await new Promise(resolve => setTimeout(resolve, delay))
        return fetchOnce()
      } else {
        throw err
      }
    }

    // fetch with three retries
    return fetchOnce()
      .catch(retry(500))
      .catch(retry(1000))
      .catch(retry(5000))
  } else {
    const filepath = url
    const stats = (
      await repl.rexec<{ data: string; isDirectory?: boolean }>(
        `vfs fstat ${repl.encodeComponent(filepath)} --with-data`
      )
    ).content

    return stats.data
  }
}

/**
 * Either fetch a remote file or read a local one
 *
 */
export async function fetchDirectory(repl: REPL, url: string): Promise<FetchedFile[]> {
  console.error('fetchDirectory', url)

  if (url.match(/http(s)?:\/\//)) {
    console.error('fetch remote direcotry', url)
  } else {
    const filepath = url
    const stats = (
      await repl.rexec<{ data: string; path: string; dirent: { isDirectory?: boolean } }[]>(
        `vfs ls ${repl.encodeComponent(filepath)}*.yaml --with-data`
      )
    ).content

    const filesInNestedDir = flatten(
      await Promise.all(stats.filter(_ => _.dirent.isDirectory).map(_ => fetchDirectory(repl, _.path)))
    )

    const files = await Promise.all(
      stats
        .filter(_ => !_.dirent.isDirectory)
        .map(async _ => ({
          data: await fetchFile(repl, _.path),
          filepath: _.path
        }))
    )

    return filesInNestedDir.concat(files)
  }
}

export async function fetch(repl: REPL, url: string): Promise<FetchedFile[]> {
  console.error('fetch', url)
  const urls = url.split(/,/)
  if (urls.length !== 1) {
    return flatten(await Promise.all(urls.map(_ => fetch(repl, _))))
  } else {
    // FIXME: remote -> isDir, or not
    if (url.match(/http(s)?:\/\//)) {
      debug('fetch remote', url)
      const fetchOnce = () => _needle(repl, 'get', url).then(_ => _.body)

      const retry = (delay: number) => async (err: Error) => {
        if (/timeout/.test(err.message) || /hang up/.test(err.message) || /hangup/.test(err.message)) {
          debug('retrying', err)
          await new Promise(resolve => setTimeout(resolve, delay))
          return fetchOnce()
        } else {
          throw err
        }
      }

      // fetch with three retries
      const data = await fetchOnce()
        .catch(retry(500))
        .catch(retry(1000))
        .catch(retry(5000))

      return [{ data, filepath: url }]
    } else {
      const filepath = url
      const stats = (
        await repl.rexec<{ data: string; isDirectory?: boolean }>(
          `vfs fstat ${repl.encodeComponent(filepath)} --with-data`
        )
      ).content

      if (stats.isDirectory) {
        return fetchDirectory(repl, filepath)
      } else {
        return [{ data: await fetchFile(repl, filepath), filepath }]
      }
    }
  }
}

/** same as fetchFile, but returning a string rather than a Buffer */
export async function fetchFileString(repl: REPL, url: string): Promise<string[]> {
  const files = await fetch(repl, url)
  return files.map(({ data }) => data.toString())
}

export async function fetchFileKustomize(repl: REPL, url: string): Promise<{ data: string; dir?: string }> {
  const stats = (
    await repl.rexec<{ data: string; dir?: string }>(`_fetchfile ${repl.encodeComponent(url)} --kustomize`)
  ).content
  return stats
}

export default fetchFileString
