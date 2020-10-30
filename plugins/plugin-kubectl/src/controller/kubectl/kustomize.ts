/*
 * Copyright 2019 IBM Corporation
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

import { resolve, basename } from 'path'
import { Arguments, Registrar, expandHomeDir } from '@kui-shell/core'

import flags from './flags'
import { kindPartOf } from './fqn'
import { KubeOptions } from './options'
import { doExecWithStdout, doExecWithStdoutViaPty } from './exec'
import commandPrefix from '../command-prefix'
import { fetchFileKustomize } from '../../lib/util/fetch-file'

import { isUsage, doHelp } from '../../lib/util/help'
import KubeResource from '../../lib/model/resource'

/**
 * Tilde expansion of the positional filepath parameter.
 *
 */
function prepare(args: Arguments<KubeOptions>): string {
  const idx = args.argvNoOptions.indexOf('kustomize')
  const filepath = args.argvNoOptions[idx + 1]
  return args.command.replace(new RegExp(`(\\s)${filepath}(\\b)`), `$1${expandHomeDir(filepath)}$2`)
}

/** fetch and merge all the yamls in a directory */
function mergeYamlsInDirectory(repl: Arguments['REPL'], dir: string) {
  return repl
    .rexec<{ path: string }[]>(`vfs ls ${repl.encodeComponent(dir)}/**/*.yaml --with-data`)
    .then(_ => _.content)
    .then(_ =>
      Promise.all(
        _.map(({ path }) =>
          repl.rexec<{ data: string }>(`vfs fstat ${repl.encodeComponent(path)} --with-data`).then(_ => _.content.data)
        )
      )
    )
    .then(_ => _.join('---\n'))
}

function fetchKustomizeOutput(args: Arguments<KubeOptions>, command: string, isKustomizeCmd: boolean) {
  return isKustomizeCmd ? doExecWithStdoutViaPty(args) : doExecWithStdout(args, prepare, command)
}

async function fetchKustomizeInput(
  args: Arguments<KubeOptions>,
  kustomization: { resources?: string[] },
  rawKustomization: { dir?: string; data: string }
) {
  const { join } = await import('path')
  return !kustomization.resources
    ? rawKustomization.data
    : Promise.all(
        kustomization.resources.reverse().map(async resource => {
          const resourcePath = rawKustomization.dir ? join(rawKustomization.dir, resource) : resource
          const resourceStats = (
            await args.REPL.rexec<{ data?: string; isDirectory?: boolean }>(
              `vfs fstat ${args.REPL.encodeComponent(resourcePath)} --with-data`
            )
          ).content

          if (resourceStats.isDirectory) {
            return mergeYamlsInDirectory(args.REPL, resourcePath)
          } else {
            return resourceStats.data
          }
        })
      ).then(_ => _.join('---\n'))
}

function mergeRaw(prev: string, next: string) {
  if (!prev) {
    return next
  } else {
    return `${prev}---\n${next}`
  }
}

async function kustomizedResources(rawOutput: string, resources: KubeResource[]) {
  const { safeDump } = await import('js-yaml')
  const bucket1 = { application: '' }
  const bucket2 = { others: '' }
  const bucket3 = {}
  const bucket4 = {}

  await Promise.all(
    resources.map(async resource => {
      const raw: string = await safeDump(resource)
      bucket1.application = mergeRaw(bucket1.application, raw)

      if (resource.metadata.labels) {
        Object.entries(resource.metadata.labels).map(([key, value]) => {
          bucket2[key] = mergeRaw(bucket2[key], raw)
          bucket3[`${key}:${value}`] = mergeRaw(bucket3[`${key}:${value}`], raw)
          bucket4[`${key}:${value}:${kindPartOf(resource)}`] = mergeRaw(
            bucket4[`${key}:${value}:${kindPartOf(resource)}`],
            raw
          )
        })
      } else {
        bucket2.others = mergeRaw(bucket2.others, raw)
        if (resource.kind) {
          bucket3[`others:${resource.kind}`] = mergeRaw(bucket3[`others:${resource.kind}`], raw)
        }
      }
    })
  )

  const findNextBucket = (bucket: { [key: string]: string }, prevKey: string) => {
    return Object.entries(bucket).filter(([key]) => {
      return key.includes(`${prevKey}:`)
    })
  }

  const data = Object.assign({
    name: 'application',
    content: bucket1.application,
    contentType: 'yaml',
    defaultExpanded: true,
    children: Object.entries(bucket2).map(([key2, value2]) => {
      return {
        name: key2,
        content: value2,
        contentType: 'yaml',
        children: findNextBucket(bucket3, key2).map(([key3, value3]) => {
          return {
            name: key3.split(`${key2}:`)[1],
            content: value3,
            contentType: 'yaml',
            children: findNextBucket(bucket4, key3).map(([key4, value4]) => {
              return {
                name: key4.split(`${key3}:`)[1],
                content: value4,
                contentType: 'yaml'
              }
            })
          }
        })
      }
    })
  })

  return {
    mode: 'kustomized resources',
    label: 'Kustomized Resources',
    content: {
      apiVersion: 'kui-shell/v1',
      kind: 'TreeViewResponse' as const,
      data: [data]
    }
  }
}

function templates(rawInput: string) {
  const input = {
    mode: 'tree',
    label: 'Templates',
    content: {
      apiVersion: 'kui-shell/v1',
      kind: 'TreeViewResponse' as const,
      data: [
        {
          name: 'Application',
          content: rawInput,
          contentType: 'yaml',
          children: [
            {
              name: 'wordpress',
              children: [{ name: 'Deployment' }, { name: 'Secret' }]
            },
            {
              name: 'mysql',
              children: [{ name: 'Deployment' }, { name: 'Secret' }]
            }
          ],
          defaultExpanded: true
        }
      ]
    }
  }

  return input
}

function applyButton(command: string, inputFile: string) {
  const button = {
    mode: 'apply',
    label: 'Apply',
    kind: 'drilldown' as const,
    command: `${command} apply -k ${inputFile}`
  }
  return button
}

function delta(rawInput: string, rawOutput: string) {
  const diff = {
    mode: 'delta',
    label: 'Delta',
    content: {
      original: rawInput,
      modified: rawOutput
    },
    contentType: 'yaml'
  }
  return diff
}

const doKustomize = (command = 'kubectl', isKustomizeCmd?: boolean) => async (args: Arguments<KubeOptions>) => {
  if (isUsage(args)) {
    return doHelp(command, args)
  } else {
    const [rawOutput, { safeLoadAll }] = await Promise.all([
      fetchKustomizeOutput(args, command, isKustomizeCmd),
      import('js-yaml')
    ])

    try {
      const inputFile = isKustomizeCmd
        ? resolve(expandHomeDir(args.argvNoOptions[args.argvNoOptions.indexOf('build') + 1]))
        : resolve(expandHomeDir(args.argvNoOptions[args.argvNoOptions.indexOf('kustomize') + 1]))

      const rawKustomization = await fetchFileKustomize(args.REPL, inputFile)
      const kustomization: { resources?: string[] } = safeLoadAll(rawKustomization.data)[0]
      const rawInput = await fetchKustomizeInput(args, kustomization, rawKustomization)

      return {
        kind: 'Kustomize',
        metadata: {
          name: basename(inputFile)
        },
        onclick: {
          name: `open ${inputFile}`
        },
        modes: await Promise.all([
          templates(rawInput),
          await kustomizedResources(rawOutput, await safeLoadAll(rawOutput)),
          delta(rawInput, rawOutput),
          applyButton(command, inputFile)
        ])
      }
    } catch (err) {
      console.error('error preparing kustomize response', err)
      return rawOutput
    }
  }
}

export default (registrar: Registrar) => {
  registrar.listen(`/${commandPrefix}/kubectl/kustomize`, doKustomize(), flags)
  registrar.listen(`/${commandPrefix}/k/kustomize`, doKustomize(), flags)
  registrar.listen(`/${commandPrefix}/kustomize/build`, doKustomize('kubectl', true), flags)
}
