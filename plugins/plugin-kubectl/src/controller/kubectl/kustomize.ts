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
import { KubeOptions } from './options'
import { doExecWithStdout } from './exec'
import commandPrefix from '../command-prefix'
import { fetchFileKustomize } from '../../lib/util/fetch-file'

import { isUsage, doHelp } from '../../lib/util/help'

/**
 * Tilde expansion of the positional filepath parameter.
 *
 */
function prepare(args: Arguments<KubeOptions>): string {
  const idx = args.argvNoOptions.indexOf('kustomize')
  const filepath = args.argvNoOptions[idx + 1]
  return args.command.replace(new RegExp(`(\\s)${filepath}(\\b)`), `$1${expandHomeDir(filepath)}$2`)
}

const doKustomize = (command = 'kubectl') => async (args: Arguments<KubeOptions>) => {
  if (isUsage(args)) {
    return doHelp(command, args)
  } else {
    const raw = await doExecWithStdout(args, prepare, command)

    try {
      const inputFile = resolve(expandHomeDir(args.argvNoOptions[args.argvNoOptions.indexOf('kustomize') + 1]))
      const yaml = await fetchFileKustomize(args.REPL, inputFile)

      const yamlMode = {
        mode: 'yaml',
        label: 'Kustomization.yaml',
        content: yaml.data,
        contentType: 'yaml'
      }

      const rawMode = {
        mode: 'raw',
        label: 'Raw',
        content: raw,
        contentType: 'yaml'
      }

      const applyButton = {
        mode: 'apply',
        label: 'Apply',
        kind: 'drilldown' as const,
        command: `${command} apply -k ${inputFile}`
      }

      return {
        kind: 'Kustomize',
        metadata: {
          name: basename(inputFile)
        },
        onclick: {
          name: `open ${inputFile}`
        },
        modes: [rawMode, yamlMode, applyButton]
      }
    } catch (err) {
      console.error('error preparing kustomize response', err)
      return raw
    }
  }
}

export default (registrar: Registrar) => {
  registrar.listen(`/${commandPrefix}/kubectl/kustomize`, doKustomize(), flags)
  registrar.listen(`/${commandPrefix}/k/kustomize`, doKustomize(), flags)
}
