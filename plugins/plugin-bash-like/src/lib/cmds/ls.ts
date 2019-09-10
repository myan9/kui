/*
 * Copyright 2018-19 IBM Corporation
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

import * as Debug from 'debug'

import { lstat, readdir, readFile, stat, constants as fsConstants } from 'fs'
import { dirname, isAbsolute, join } from 'path'
import * as glob from 'glob'

import expandHomeDir from '@kui-shell/core/util/home'
import { flatten } from '@kui-shell/core/core/utility'
import * as repl from '@kui-shell/core/core/repl'
import { CommandRegistrar, EvaluatorArgs, ParsedOptions } from '@kui-shell/core/models/command'
import { Row, Table, MultiTable, TableStyle, isTable } from '@kui-shell/core/webapp/models/table'
import { findFile, findFileWithViewer, isSpecialDirectory } from '@kui-shell/core/core/find-file'
import { CodedError } from '@kui-shell/core/models/errors'

import { doExec } from './bash-like'
import { localFilepath } from '../util/usage-helpers'

import i18n from '@kui-shell/core/util/i18n'
const strings = i18n('plugin-bash-like')

const debug = Debug('plugins/bash-like/cmds/ls')

const octalPermission = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx']

/**
 * Return the contents of the given directory
 *
 */
const myreaddir = (dir: string): Promise<Record<string, boolean>> =>
  new Promise((resolve, reject) => {
    const toMap = (files: string[]) => {
      return files.reduce((M, file) => {
        M[file] = true
        M[join(dir, file)] = true
        return M
      }, {})
    }

    lstat(dir, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          const parent = dirname(dir)
          if (parent) {
            return myreaddir(dirname(dir))
              .then(resolve)
              .catch(reject)
          }
        }

        // fallthrough to reject
        reject(err)
      } else if (!stats.isDirectory()) {
        // link or file or other
        resolve(toMap([dir]))
      } else {
        readdir(dir, (err, files) => {
          if (err) {
            reject(err)
          } else {
            resolve(toMap(['.', '..'].concat(files)))
          }
        })
      }
    })
  })

/**
 * If the given filepath is a directory, then ls it, otherwise cat it
 *
 */
const lsOrOpen = async ({ argvNoOptions }: EvaluatorArgs) => {
  const filepath = argvNoOptions[argvNoOptions.indexOf('lsOrOpen') + 1]

  const stats: { isDirectory: boolean; viewer: string } = await repl.qexec(`fstat ${repl.encodeComponent(filepath)}`)

  const filepathForRepl = repl.encodeComponent(filepath)

  if (stats.isDirectory) {
    return repl.pexec(`ls ${filepathForRepl}`)
  } else {
    return repl.pexec(`${stats.viewer} ${filepathForRepl}`)
  }
}

/**
 * Kui command for fs.stat
 *
 */
const fstat = ({ argvNoOptions, parsedOptions }: EvaluatorArgs) => {
  return new Promise((resolve, reject) => {
    const filepath = argvNoOptions[1]

    const { resolved: fullpath, viewer = 'open' } = findFileWithViewer(expandHomeDir(filepath))
    debug('fullpath', fullpath, filepath, expandHomeDir(filepath))

    // note: stat not lstat, because we want to follow the link
    stat(fullpath, (err, stats) => {
      if (err) {
        if (err.code === 'ENOENT') {
          const error: CodedError = new Error(err.message)
          error.stack = err.stack
          error.code = 404
          reject(error)
        } else {
          reject(err)
        }
      } else if (stats.isDirectory() || !parsedOptions['with-data']) {
        resolve({
          viewer,
          filepath,
          isDirectory: stats.isDirectory()
        })
      } else {
        readFile(fullpath, (err, data) => {
          if (err) {
            reject(err)
          } else {
            resolve({
              viewer,
              filepath,
              data: data.toString(),
              isDirectory: false
            })
          }
        })
      }
    })
  })
}

/** promise version of glob */
const globp = (pattern: string): Promise<string[]> =>
  new Promise((resolve, reject) => {
    glob(pattern, (err, files) => {
      if (err) {
        reject(err)
      } else {
        debug('globbing', files)
        resolve(files)
      }
    })
  })

/**
 * Checks whether a path starts with or contains a hidden file or a folder.
 * @param {string} source - The path of the file that needs to be validated.
 * returns {boolean} - `true` if the source is blacklisted and otherwise `false`.
 * source: https://stackoverflow.com/questions/8905680/nodejs-check-for-hidden-files
 */
const isUnixHiddenPath = path => {
  return /(^|\/)\.[^\/\.]/g.test(path) // eslint-disable-line no-useless-escape
}

// see source: https://stackoverflow.com/questions/15900485/correct-way-to-convert-size-in-bytes-to-kb-mb-gb-in-javascript
const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 B'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

interface FileMeta {
  name: string
  expandName: string
  isDirectory: boolean
  isFile: boolean
  isLink: boolean
  isExecutable: boolean
  isSpecial: boolean
  size: string
  rawSize: number
  blocks: string
  lastModified: string
  mtimeMs: number
  permission: string
  owner: string
  group: string
}

/**
 * Deroate a header for the table
 */
const formHeader = (options: ParsedOptions): Row => {
  const outerCSS = 'header-cell'
  const outerCSSSecondary = `${outerCSS} hide-with-sidecar`

  const ownerAttrs = !options.l
    ? []
    : [
        { key: 'owner', value: 'OWNER', outerCSS: outerCSSSecondary },
        { key: 'group', value: 'GROUP', outerCSS: outerCSSSecondary }
      ]

  const permissionAttrs = !options.l
    ? []
    : [
        {
          key: 'permissions',
          value: 'PERMISSIONS',
          outerCSS: outerCSSSecondary
        }
      ]

  const normalAttrs = [
    { key: 'size', value: 'SIZE', outerCSS: outerCSSSecondary },
    {
      key: 'lastmod',
      value: 'LAST MODIFIED',
      outerCSS: `${outerCSS} badge-width`
    }
  ]

  const headerAttributes = permissionAttrs.concat(ownerAttrs).concat(normalAttrs)

  return {
    name: 'NAME',
    type: 'file',
    onclick: false,
    outerCSS,
    attributes: headerAttributes
  }
}

interface DirectoryOrFile {
  isDirectory: boolean
  isFile: boolean
}

const isDirectoryOrFile = (path: string): Promise<DirectoryOrFile> => {
  return new Promise((resolve, reject) => {
    return lstat(path, async (err, stats) => {
      if (err) reject(err)
      resolve({
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile()
      })
    })
  })
}

/** get stats from file */
const getStats = async (dir: string, name: string): Promise<FileMeta> => {
  const fullName = findFile(expandHomeDir(join(dir, name)))

  return new Promise((resolve, reject) => {
    return lstat(fullName, async (err, stats) => {
      if (err) reject(err)

      const mode = (stats.mode & parseInt('777', 8)).toString(8)
      const permission = mode
        .split('')
        .map(group => octalPermission[group])
        .join('')

      resolve({
        name: name || dir,
        expandName: `${repl.encodeComponent(isAbsolute(name) ? name : join(dir, name))}`,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        isLink: stats.isSymbolicLink(),
        size: formatBytes(stats.size),
        rawSize: stats.size,
        blocks: stats.blocks.toString(),
        lastModified: stats.mtime.toLocaleString(), // NOTE: different with what I saw on mac
        mtimeMs: stats.mtimeMs, // original time
        owner: stats.uid.toString(),
        group: stats.gid.toString(),
        permission,
        isExecutable: permission.includes('x'),
        isSpecial: permission.charAt(0) !== '-'
      })
    })
  })
}

/** iterate the directory and return the file stats */
const listDirectory = async (dir: string, options: ParsedOptions): Promise<DirOrFile> => {
  /** iterate the directory */
  const getAllFiles = async (dir: string): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      return readdir(dir, async (err, files) => {
        if (err) reject(err)
        if (options.A) {
          resolve(files)
        } else if (options.a) {
          resolve(['.', '..'].concat(files))
        } else {
          resolve(files.filter(path => !isUnixHiddenPath(path)))
        }
      })
    })
  }

  /** sort files by the last modified time */
  const sort = (files: FileMeta[], options: ParsedOptions) => {
    if (options.S) {
      files.sort((highIndex, lowIndex) =>
        !options.r ? -(highIndex.rawSize - lowIndex.rawSize) : highIndex.rawSize - lowIndex.rawSize
      )
    } else if (options.t) {
      files.sort((highIndex, lowIndex) =>
        !options.r ? -(highIndex.mtimeMs - lowIndex.mtimeMs) : highIndex.mtimeMs - lowIndex.mtimeMs
      )
    }
    return files
  }

  return getAllFiles(dir) // get file names of the directory
    .then(fileName => Promise.all(fileName.map(name => getStats(dir, name)))) // get metadata of each file
    .then(fileMeta => (options.t || options.S ? sort(fileMeta, options) : fileMeta)) // user asked to sort by time or size?
    .then(fileMeta => {
      return { isDirectory: true, content: fileMeta, directoryName: dir }
    })
}

/** list a directory or a file status */
const listDirectoryOrFile = async (path: string, options: ParsedOptions) => {
  const { isDirectory } = await repl.qexec(`fstat ${repl.encodeComponent(path)}`)

  if (isDirectory) {
    return listDirectory(path, options)
  } else {
    return { isFile: true, content: [await getStats(path, '')] }
  }
}

interface DirOrFile {
  isDirectory?: boolean
  isFile?: boolean
  directoryName?: string
  content: FileMeta[]
}

const formatTable = async (dirOrFile: DirOrFile, options: ParsedOptions, showTitle = false) => {
  console.error('format', dirOrFile)
  const body = dirOrFile.content.map(_metadata => {
    // NOTE: this should not be full name ; it should be nameForDisplay
    const nameForDisplay = `${_metadata.name}${
      _metadata.isDirectory ? '/' : _metadata.isLink ? '@' : _metadata.isExecutable ? '*' : ''
    }`

    const ownerAttrs = !options.l
      ? []
      : [
          { value: _metadata.owner, css: 'slightly-deemphasize' },
          { value: _metadata.group, css: 'slightly-deemphasize' }
        ]

    const permissionForDispaly = _metadata.isDirectory ? `d${_metadata.permission}` : `-${_metadata.permission}`

    const permissionAttrs = !options.l
      ? []
      : [
          {
            value: permissionForDispaly,
            css: 'slightly-deemphasize'
          }
        ]

    const normalAttrs = [
      { value: !options.s ? _metadata.size : _metadata.blocks, outerCSS: 'hide-with-sidecar', css: '' },
      { value: _metadata.lastModified, outerCSS: 'badge-width', css: 'slightly-deemphasize' }
    ]

    const attributes = permissionAttrs.concat(ownerAttrs).concat(normalAttrs)

    const css = _metadata.isDirectory
      ? 'dir-listing-is-directory'
      : _metadata.isLink
      ? 'dir-listing-is-link' // note that links are also x; we choose l first
      : _metadata.isExecutable
      ? 'dir-listing-is-executable'
      : _metadata.isSpecial
      ? 'dir-listing-is-other-special'
      : ''

    // NOTE: metadata should contain an fullName or Path
    return new Row({
      type: 'ls',
      name: nameForDisplay,
      onclickExec: 'qexec',
      onclick: `lsOrOpen ${_metadata.expandName}`, // note: ls -l file results in an absolute path
      css,
      attributes
    })
  })

  return new Table({
    title: showTitle && dirOrFile.directoryName,
    type: 'ls',
    style: TableStyle.Light,
    noEntityColors: true,
    noSort: true,
    header: formHeader(options),
    body
  })
}

/** combine multile file lists into 1 */
const formatList = (mixedListResult: DirOrFile[]) => {
  const files = flatten(
    mixedListResult.map(result => {
      if (result.isFile) {
        return result.content
      }
    })
  ).filter(x => x)

  const combinedFiles: DirOrFile[] = [{ isDirectory: true, content: files }]
  console.error('???', combinedFiles)

  const directories = mixedListResult
    .map(result => {
      if (result.isDirectory) {
        return result
      }
    })
    .filter(x => x)

  return combinedFiles.concat(directories)
}

const listFromPath = async (path: string, options: ParsedOptions) => {
  const findAndExpandPath = await globp(path) // TODO: add file name expansion

  if (!findAndExpandPath[0]) {
    const err = new Error(`ls: ${path}: No such file or directory`)
    err['code'] = 404
    throw err
  } else if (findAndExpandPath.length === 1) {
    // globbing and resulting with 1 single result
    return listDirectoryOrFile(findAndExpandPath[0], options)
  } else {
    // globbing and resulting with multiple results
    const listResult = await Promise.all(
      findAndExpandPath.map(_findAndExpandPath => listDirectoryOrFile(_findAndExpandPath, options))
    )
    return formatList(listResult)
  }
}

/**
 * ls command handler
 *
 */
const doLs = (cmd: string) => async (opts: EvaluatorArgs) => {
  const semi = await repl.semicolonInvoke(opts)
  if (semi) {
    debug('ls with semi', semi)
    return semi
  }

  const { argvNoOptions: argv, parsedOptions: options } = opts

  const filepathsAsGiven = argv.filter(_argv => _argv !== cmd)

  /** 1. ls
   *  2. ls file
   *  3. ls directory
   *  4. ls globbing
   *  5. ls files
   *  6. ls directories
   *  7. ls files and directories
   */
  const getListContent = async (filepathsAsGiven: string[]) => {
    if (!filepathsAsGiven[0]) {
      // 1. ls the current directory
      return listDirectory(process.cwd(), options)
    } else if (filepathsAsGiven.length === 1) {
      return listFromPath(filepathsAsGiven[0], options)
    } else {
      return Promise.all(filepathsAsGiven.map(_filepathsAsGiven => listFromPath(_filepathsAsGiven, options)))
    }
  }

  const content = await getListContent(filepathsAsGiven)
  console.error('content', content)

  if (!Array.isArray(content)) {
    // return single table containing all the files
    return formatTable(content, options)
  } else {
    // return multiple table with appropriate seperator
    const tables = await Promise.all(
      content.map(_content => {
        return formatTable(_content, options, true)
      })
    )

    return { tables } // we want title separator
  }
}

const usage = (command: string) => ({
  command,
  title: strings('lsUsageTitle'),
  header: strings('lsUsageHeader'),
  noHelpAlias: true,
  optional: localFilepath.concat([
    { name: '-A', boolean: true, docs: strings('lsDashAUsageDocs') },
    {
      name: '-a',
      boolean: true,
      docs: strings('lsDashaUsageDocs')
    },
    {
      name: '-c',
      boolean: true,
      docs: strings('lsDashcUsageDocs')
    },
    { name: '-l', boolean: true, hidden: true },
    { name: '-h', boolean: true, hidden: true },
    {
      name: '-t',
      boolean: true,
      docs: strings('lsDashtUsageDocs')
    },
    { name: '-r', boolean: true, docs: strings('lsDashrUsageDocs') },
    { name: '-s', boolean: true, hidden: true }, // "show size", which we always do; so hidden: true
    { name: '-S', boolean: true, docs: strings('lsDashSUsageDocs') }
  ])
})

/**
 * Register command handlers
 *
 */
export default (commandTree: CommandRegistrar) => {
  commandTree.listen('/fstat', fstat, {
    hidden: true,
    noAuthOk: true,
    requiresLocal: true
  })
  commandTree.listen('/lsOrOpen', lsOrOpen, {
    hidden: true,
    noAuthOk: true,
    inBrowserOk: true
  })
  const ls = commandTree.listen('/ls', doLs('ls'), {
    usage: usage('ls'),
    noAuthOk: true,
    requiresLocal: true
  })
  commandTree.synonym('/lls', doLs('lls'), ls, {
    usage: usage('lls'),
    noAuthOk: true,
    requiresLocal: true
  })
}
