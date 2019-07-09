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

/* eslint-disable @typescript-eslint/no-use-before-define */

import * as Debug from 'debug'

import { basename, dirname, join } from 'path'
import { inBrowser } from '@kui-shell/core/core/capabilities'
import { CommandRegistrar, EvaluatorArgs } from '@kui-shell/core/models/command'
import { injectCSS } from '@kui-shell/core/webapp/util/inject'
import expandHomeDir from '@kui-shell/core/util/home'
import { findFile } from '@kui-shell/core/core/find-file'
import { Tab } from '@kui-shell/core/webapp/cli'
import { Table } from '@kui-shell/core/webapp/models/table'
import { EntitySpec } from '@kui-shell/core/models/entity'
import { get as relevantModes } from '@kui-shell/core/webapp/views/registrar/modes'

import { FinalState } from '../model/states'
import { KubeResource, Resource } from '../model/resource'

import { redactYAML } from '../view/redact'
import { statusButton } from '../view/modes/status'
import { formatEntity } from '../view/formatEntity'
import { generateForm } from '../view/form'

import repl = require('@kui-shell/core/core/repl')

const debug = Debug('k8s/controller/kedit')

const usage = {
  kedit: {
    command: 'kedit',
    strict: 'kedit',
    docs: 'Edit a resource definition file',
    example: 'kedit @seed/cloud-functions/function/echo.yaml',
    required: [
      { name: 'file', file: true, docs: 'A kubernetes resource file or kind' }
    ],
    optional: [
      {
        name: 'resource',
        positional: true,
        docs: 'A resource within the file to view'
      }
    ]
  }
}

/**
 * Show a customized view of a given yaml in the editor
 *
 */
const showResource = async (yaml: KubeResource, filepath: string, tab: Tab) => {
  debug('showing one resource', yaml)

  if (inBrowser()) {
    injectCSS({
      css: require('@kui-shell/plugin-k8s/web/css/main.css').toString(),
      key: 'kedit'
    })
  } else {
    const ourRoot = dirname(
      require.resolve('@kui-shell/plugin-k8s/package.json')
    )
    injectCSS(join(ourRoot, 'web/css/main.css'))
  }

  // override the type shown in the sidecar header to show the
  // resource kind
  const typeOverride = yaml.kind
  const nameOverride = (resource: KubeResource) =>
    (resource.metadata && resource.metadata.name) || basename(filepath)

  // add our mode buttons
  const resource = {
    kind: yaml.kind,
    filepathForDrilldown: filepath,
    resource: yaml
  }
  const addModeButtons = (defaultMode: string) => (response: EntitySpec) => {
    response['modes'] = (response['modes'] || []).concat([
      { mode: 'edit', direct: openAsForm },
      ...relevantModes('kubectl', { resource: yaml }),
      statusButton('kubectl', resource, FinalState.NotPendingLike),
      { mode: 'raw', direct: openInEditor }
    ])

    // adjust selected mode
    response['modes'].forEach(spec => {
      if (spec.mode === defaultMode) {
        spec.defaultMode = true
      } else {
        spec.defaultMode = false
      }
    })

    return response
  }

  interface ResourceSource extends Resource {
    source: string
  }

  const { safeLoad, safeDump } = await import('js-yaml')

  /** re-extract the structure from raw yaml string */
  const extract = (
    rawText: string,
    entity?: ResourceSource
  ): ResourceSource => {
    const resource = (editorEntity.resource = safeLoad(rawText))
    editorEntity.source = rawText
    editorEntity.name = resource.metadata.name
    editorEntity.kind = resource.kind

    if (entity) {
      entity.source = editorEntity.source
      entity.name = editorEntity.name
      entity.kind = editorEntity.kind
    }

    return entity
  }

  const editorEntity = {
    name: yaml.metadata.name,
    kind: yaml.kind,
    lock: false, // we don't want a lock icon
    extract,
    filepath,
    source: redactYAML(safeDump(yaml)),
    resource: yaml
  }

  /** open the content in the monaco editor */
  const openInEditor = () => {
    debug('openInEditor', yaml.metadata.name)

    return repl
      .qexec(
        `edit !source --type "${typeOverride}" --name "${nameOverride(
          editorEntity.resource
        )}" --language yaml`,
        undefined,
        undefined,
        {
          parameters: editorEntity
        }
      )
      .then(addModeButtons('raw'))
  }

  /** open the content as a pretty-printed form */
  const openAsForm = () => {
    return Promise.resolve(
      generateForm(tab)(
        editorEntity.resource,
        filepath,
        nameOverride(editorEntity.resource),
        typeOverride,
        extract
      )
    ).then(addModeButtons('edit'))
  }

  // open as form by default
  return openAsForm()
}

/**
 * Render the resources as a REPL table
 *
 */
const showAsTable = async (
  yamls: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  filepathAsGiven: string,
  parsedOptions
): Promise<Table> => {
  debug('showing as table', yamls)

  const ourOptions = {
    'no-status': true,
    onclickFn: kubeEntity => {
      return evt => {
        evt.stopPropagation() // row versus name click handling; we don't want both
        return repl.pexec(
          `kedit ${repl.encodeComponent(
            filepathAsGiven
          )} ${repl.encodeComponent(kubeEntity.metadata.name)}`
        )
      }
    }
  }

  return Promise.all(
    yamls.map(formatEntity(Object.assign({}, parsedOptions, ourOptions)))
  ).then(formattedEntities => {
    return new Table({ body: formattedEntities })
  })
}

/**
 * kedit command handler
 *
 */
const kedit = async ({ tab, argvNoOptions, parsedOptions }: EvaluatorArgs) => {
  const idx = argvNoOptions.indexOf('kedit') + 1
  const filepathAsGiven = argvNoOptions[idx]
  const resource = argvNoOptions[idx + 1]
  const filepath = findFile(expandHomeDir(filepathAsGiven))
  debug('filepath', filepath)

  const { safeLoadAll: parseYAML } = await import('js-yaml')
  const { readFile } = await import('fs-extra') // 22ms or so to load fs-extra, so defer it
  const yamls = parseYAML(await readFile(filepath)).filter(x => x)
  debug('yamls', yamls)

  if (yamls.length === 0) {
    throw new Error('The specified file is empty')
  } else if (
    yamls.filter(({ apiVersion, kind }) => apiVersion && kind).length === 0
  ) {
    debug(
      'The specified file does not contain any Kubernetes resource definitions'
    )
    return repl.qexec(`edit "${filepathAsGiven}"`)
  } else if (yamls.length > 1 && !resource) {
    return showAsTable(yamls, filepathAsGiven, parsedOptions)
  } else {
    const yamlIdx = !resource
      ? 0
      : yamls.findIndex(({ metadata: { name } }) => name === resource)
    if (yamlIdx < 0) {
      throw new Error('Cannot find the specified resource')
    } else {
      return showResource(yamls[yamlIdx], filepath, tab)
    }
  }
}

/**
 * Register the commands
 *
 */
const registration = (commandTree: CommandRegistrar) => {
  commandTree.listen('/k8s/kedit', kedit, {
    usage: usage.kedit,
    noAuthOk: ['openwhisk']
  })
}

export default registration
