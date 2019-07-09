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

import { basename, join } from 'path'
import { safeLoadAll as parseYAML } from 'js-yaml'

import { findFile } from '@kui-shell/core/core/find-file'
import { CommandRegistrar, EvaluatorArgs } from '@kui-shell/core/models/command'
import { ExecOptions, ParsedOptions } from '@kui-shell/core/models/execOptions'
import {
  Row,
  Table,
  formatWatchableTable,
  isTable,
  isMultiTable
} from '@kui-shell/core/webapp/models/table'
import { CodedError } from '@kui-shell/core/models/errors'

import { withRetryOn404 } from '../util/retry'
import { flatten, isDirectory } from '../util/util'

import { CRDResource, KubeResource } from '../model/resource'
import { States, FinalState } from '../model/states'

import { formatContextAttr, formatEntity } from '../view/formatEntity'
const debug = Debug('k8s/controller/status')
debug('loading')
import repl = require('@kui-shell/core/core/repl')

/** icon to indicate "is a cluster" */
const fontawesome = 'fas fa-network-wired'
const fontawesomeCSS = 'selected-entity'

const strings = {
  allContexts: 'Resources Across All Contexts',
  currentContext: 'This is your current context',
  notCurrentContext: 'This is not your current context'
}

/** administartive core controllers that we want to ignore */
const adminCoreFilter = '-l provider!=kubernetes'

/** administrative CRDs that we want to ignore */
const adminCRDFilter =
  '-l app!=mixer,app!=istio-pilot,app!=ibmcloud-image-enforcement,app!=ibm-cert-manager'

const usage = (command: string) => ({
  command,
  strict: command,
  docs: 'Check the deployment status of a set of resources',
  onlyEnforceOptions: true,
  optional: [
    {
      name: 'file|kind',
      file: true,
      positional: true,
      docs: 'A kubernetes resource file or kind'
    },
    {
      name: 'resourceName',
      positional: true,
      docs: 'The name of a kubernetes resource of the given kind'
    },
    { name: '--final-state', hidden: true }, // when do we stop polling for status updates?
    { name: '--namespace', alias: '-n', docs: 'Inspect a specified namespace' },
    { name: '--all', alias: '-a', docs: 'Show status across all namespaces' },
    {
      name: '--multi',
      alias: '-m',
      docs: 'Display multi-cluster views as a multiple tables'
    },
    {
      name: '--watch',
      alias: '-w',
      docs: 'After listing/getting the requested object, watch for changes'
    }
  ],
  example: `kubectl ${command} @seed/cloud-functions/function/echo.yaml`
})

interface HeaderRow {
  title?: string
  context?: boolean
  fontawesome?: string
  fontawesomeCSS?: string
  balloon?: string
  tableCSS?: string
}

const headerRow = (opts: HeaderRow, kind?: string): Row => {
  debug('headerRow', kind)

  const kindAttr = [
    { value: 'KIND', outerCSS: 'header-cell not-too-wide entity-kind' }
  ]
  const namespaceAttr =
    kind && kind.match(/(ns|Namespace)/i)
      ? []
      : [
          {
            value: 'NAMESPACE',
            outerCSS: 'header-cell pretty-narrow hide-with-sidecar'
          }
        ]
  const contextAttr = !opts.context
    ? []
    : formatContextAttr('CONTEXT', 'header-cell')
  const attributes = kindAttr
    .concat(contextAttr)
    .concat(namespaceAttr)
    .concat([
      { value: 'STATUS', outerCSS: 'header-cell badge-width' },
      {
        value: 'MESSAGE',
        outerCSS:
          'header-cell not-too-wide hide-with-sidecar min-width-date-like'
      }
    ])

  return Object.assign({}, opts, {
    type: 'status',
    name: 'NAME',
    noSort: true,
    outerCSS: 'header-cell',
    // flexWrap: 10,
    title: opts.title && basename(opts.title).replace(/\.yaml$/, ''),
    fontawesomeBalloon: opts.balloon,
    attributes
  })
}

/** fairly generic error handler */
function handleError(err: CodedError): CodedError {
  if (err.code === 404) {
    // e.g. no crds in this cluster
  } else {
    console.error(err)
    return err
  }
}

/** fairly generic error handler */
function handleErrorWithSquash<T>(err: CodedError): T[] {
  if (err.code === 404) {
    // e.g. no crds in this cluster
    return []
  } else {
    console.error(err)
    return []
  }
}

interface Context {
  name: string
  namespace: string
}

/**
 * Return an [IContext] model for all known contexts
 * @param {Boolean} fetchAllNS If set to true, fetch all the namespaces of a cluster
 */
const allContexts = async (
  execOptions: ExecOptions,
  { fetchAllNS = false } = {}
): Promise<Context[]> => {
  const table: Table = await repl.qexec(
    `k8s contexts`,
    undefined,
    undefined,
    execOptions
  )

  if (!fetchAllNS) {
    return table.body.map(({ attributes }) => ({
      name: attributes.find(({ key }) => key === 'NAME').value,
      namespace: attributes.find(({ key }) => key === 'NAMESPACE').value
    }))
  }

  return flatten(
    await Promise.all(
      table.body.map(cluster => {
        const ns: Promise<Context[]> = repl
          .qexec(
            `k get ns --context ${cluster.name}`,
            undefined,
            undefined,
            execOptions
          )
          .then((nsTable: Table) =>
            nsTable.body.map(({ name }) => ({
              name: cluster.name,
              namespace: name
            }))
          )
          .catch(err => handleErrorWithSquash<Context>(err))
        return ns
      })
    )
  ).filter(x => x)
}

/**
 * Make sure the given list of resources contains no duplicates
 *
 */
const removeDuplicateResources = (L: KubeResource[]) =>
  L.filter((item, idx) => {
    return (
      L.findIndex(
        _ =>
          _.metadata.name === item.metadata.name &&
          _.metadata.namespace === item.metadata.namespace
      ) === idx
    )
  })

/**
 * Fetch the status for a given list of contexts
 *
 */
const getStatusForKnownContexts = (
  execOptions: ExecOptions,
  parsedOptions: ParsedOptions
) => async (contexts: Context[] = []) => {
  const raw = Object.assign({}, execOptions, { raw: true })

  const currentContext: Promise<string> = repl.qexec(
    `kubectl config current-context`,
    undefined,
    undefined,
    raw
  )

  if (contexts.length === 0) {
    const ccName = await currentContext
    contexts = (await allContexts(execOptions)).filter(
      ({ name }) => name === ccName
    )
    if (contexts.length === 0) {
      debug(
        'Odd, no contexts found',
        await allContexts(execOptions),
        (await allContexts(execOptions)).filter(({ name }) => name === ccName)
      )
      throw new Error('No contexts found')
    }
  }
  debug('getStatusForKnownContexts', contexts)

  // format the tables
  const tables: Promise<Row[][]> = Promise.all(
    contexts.map(async ({ name, namespace }) => {
      try {
        const inNamespace = namespace ? `-n "${namespace}"` : ''

        debug('fetching kubectl get all', name, namespace)
        const coreResources: Promise<KubeResource[]> = repl
          .qexec(
            `kubectl get --context "${name}" ${inNamespace} all ${adminCoreFilter} -o json`,
            undefined,
            undefined,
            raw
          )
          .catch(handleError)
        debug('fetching crds', name, namespace)
        const crds: CRDResource[] = await repl.qexec(
          `kubectl get --context "${name}" ${inNamespace} crds ${adminCRDFilter} -o json`,
          undefined,
          undefined,
          raw
        )
        debug('crds', name, crds)

        // TODO: hack for now; we need app=seed, or something like that
        const filteredCRDs = crds.filter(_ => !_.metadata.name.match(/knative/))

        const crdResources = flatten(
          await Promise.all(
            filteredCRDs.map(crd => {
              const kind =
                (crd.spec.names.shortnames && crd.spec.names.shortnames[0]) ||
                crd.spec.names.kind
              const resource: Promise<KubeResource[]> = repl
                .qexec(
                  `kubectl get --context "${name}" ${inNamespace} ${adminCoreFilter} "${kind}" -o json`,
                  undefined,
                  undefined,
                  raw
                )
                .catch(handleError)
              return resource
            })
          )
        )

        const resources = removeDuplicateResources(
          (await coreResources).concat(crdResources)
        )
        debug('resources', resources, crdResources)

        if (execOptions.raw) {
          return resources
        } else if (resources.length === 0) {
          // no header row if no body rows!
          return []
        } else {
          // icon to represent kubernetes cluster/context
          const thisContextIsCurrent = (await currentContext) === name
          const tableCSS = thisContextIsCurrent ? 'selected-row' : ''
          const balloon = thisContextIsCurrent
            ? strings.currentContext
            : strings.notCurrentContext

          if (!parsedOptions.multi) {
            return Promise.all(resources.map(formatEntity(parsedOptions, name)))
          } else {
            return Promise.all(
              resources.map(formatEntity(parsedOptions, name))
            ).then(rows => {
              return [
                headerRow({
                  title: name,
                  fontawesome,
                  fontawesomeCSS,
                  balloon,
                  tableCSS
                })
              ].concat(rows)
            })
          }
        }
      } catch (err) {
        handleError(err)
        return []
      }
    })
  )

  if (!parsedOptions.multi) {
    const resources = flatten(await tables).filter(x => x)
    if (resources.length === 0) {
      return []
    } else {
      const header = headerRow({
        title: parsedOptions.all ? strings.allContexts : await currentContext,
        context: true,
        tableCSS: 'selected-row',
        fontawesome,
        fontawesomeCSS,
        balloon: strings.currentContext
      })
      return [header].concat(resources)
    }
  } else {
    return tables
  }
}

/**
 * In case of an error fetching the status of an entity, return something...
 *
 */
const errorEntity = (
  execOptions: ExecOptions,
  base: KubeResource,
  backupNamespace?: string
) => (err: CodedError) => {
  debug('creating error entity', err.code, base, backupNamespace, err)

  if (!base) {
    base = {
      apiVersion: undefined,
      kind: undefined,
      metadata: { name: undefined, namespace: backupNamespace }
    }
  } else if (!base.metadata) {
    base.metadata = { name: undefined, namespace: backupNamespace }
  } else if (!base.metadata.namespace) {
    base.metadata.namespace = backupNamespace
  }

  if (err.code === 404) {
    return Object.assign({}, base, {
      status: {
        state: States.Offline,
        message: 'resource has been deleted'
      }
    })
  } else {
    if (execOptions.raw) {
      throw err
    } else {
      return Object.assign({}, base, {
        status: {
          state: States.Failed,
          message: 'error fetching resource'
        }
      })
    }
  }
}

/**
 * Get the status of those entities referenced directly, either:
 *
 *   1. across all entities across all contexts
 *   2. across all entities in the current context
 *   3. of a given kind,name
 *   4. across files in a given directory
 *   5. in a given file (local or remote)
 *
 */
interface FinalStateOptions extends ParsedOptions {
  'final-state': FinalState
}
const getDirectReferences = (command: string) => async ({
  execOptions,
  argvNoOptions,
  parsedOptions
}: EvaluatorArgs) => {
  const raw = Object.assign({}, execOptions, { raw: true })

  const idx = argvNoOptions.indexOf(command) + 1
  const file = argvNoOptions[idx]
  const name = argvNoOptions[idx + 1]
  const namespace = parsedOptions.namespace || parsedOptions.n || 'default'
  const finalState: FinalState =
    (parsedOptions as FinalStateOptions)['final-state'] ||
    FinalState.NotPendingLike
  debug('getDirectReferences', file, name)

  /** format a --namespace cli option for the given kubeEntity */
  const ns = ({ metadata = {} } = {}) => {
    debug('ns', metadata['namespace'], namespace)
    return metadata['namespace']
      ? `-n "${metadata['namespace']}"`
      : parsedOptions.namespace || parsedOptions.n
      ? `-n ${namespace}`
      : ''
  }

  if (parsedOptions.all) {
    //
    // global status check
    //
    // as of now (october 13, 2018), `kubectl get all` does not
    // cover CRD-controlled resources, so we have to hack a bit,
    // by querying the CRDs, then getting the resources under
    // these CRDs; we also try to filter out some of the admin
    // CRDs
    //
    debug('global status check')
    return getStatusForKnownContexts(execOptions, parsedOptions)(
      await allContexts(execOptions, { fetchAllNS: true })
    )
  } else if (!file && !name) {
    //
    // ibid, but only for the current context
    //
    debug('status check for the current context')
    return getStatusForKnownContexts(execOptions, parsedOptions)()
  } else if (file.charAt(0) === '!') {
    const resources: KubeResource[] = parseYAML(
      execOptions.parameters[file.slice(1)]
    )
    debug('status by programmatic parameter', resources)
    const entities = await Promise.all(
      resources.map(_ => {
        return repl.qexec(
          `kubectl get "${_.kind}" "${_.metadata.name}" ${ns(_)} -o json`,
          undefined,
          undefined,
          raw
        )
      })
    )
    if (execOptions.raw) {
      return entities
    } else {
      return {
        headerRow: headerRow({} /* TODO kind */),
        entities
      }
    }
  } else if (name) {
    //
    // then the user has asked for the status of a named resource
    //
    const kind = file
    const command = `kubectl get "${kind}" "${name || ''}" ${ns()} -o json`
    debug('status by kind and name', command)

    // note: don't retry the getter on 404 if we're expecting the
    // element (eventually) not to exist
    const getter = () => {
      return repl.qexec(command, undefined, undefined, raw)
    }
    const kubeEntity =
      finalState === FinalState.OfflineLike
        ? getter()
        : withRetryOn404(getter, command)

    if (execOptions.raw) {
      return kubeEntity
    } else {
      debug('kubeEntity', kubeEntity)
      return {
        headerRow: headerRow({ title: file }, kind),
        entities: [kubeEntity]
      }
    }
  } else {
    const filepath = findFile(file)
    const isURL = file.match(/^http[s]?:\/\//)
    const isDir = isURL ? false : await isDirectory(filepath)

    debug('status by filepath', file, filepath, isURL, isDir)

    if (isDir) {
      // this is a directory of yamls
      debug('status of directory')

      // why the dynamic import? being browser friendly here
      const { readdir } = await import('fs-extra')

      const files: string[] = await readdir(filepath)
      const yamls = files
        .filter(_ => _.match(/^[^\\.#].*\.yaml$/))
        .map(file => join(filepath, file))

      if (files.find(file => file === 'seeds')) {
        const seedsDir = join(filepath, 'seeds')
        if (await isDirectory(seedsDir)) {
          const seeds: string[] = (await readdir(seedsDir)).filter(_ =>
            _.match(/\.yaml$/)
          )
          seeds.forEach(file => yamls.push(join(filepath, 'seeds', file)))
        }
      }

      const main = yamls.find(_ => _.match(/main.yaml$/))
      const yamlsWithMainFirst = (main ? [main] : []).concat(
        yamls.filter(_ => !_.match(/main.yaml$/))
      )

      // make a list of tables, recursively calling ourselves for
      // each yaml file in the given directory
      return Promise.all(
        yamlsWithMainFirst.map(filepath =>
          repl.qexec(
            `k status "${filepath}" --final-state ${finalState}`,
            undefined,
            undefined,
            execOptions
          )
        )
      )
    } else if (isDir === undefined) {
      // then the file does not exist; maybe the user specified a resource kind, e.g. k status pods
      debug('status by resource kind', file, name)

      const kubeEntities = repl
        .qexec(
          `kubectl get "${file}" "${name || ''}" ${ns()} -o json`,
          undefined,
          undefined,
          raw
        )
        .catch(err => {
          if (err.code === 404) {
            // then no such resource type exists
            throw err
          } else {
            return errorEntity(execOptions, undefined, namespace)(err)
          }
        })

      if (execOptions.raw) {
        return kubeEntities
      } else {
        return {
          headerRow: headerRow({ title: file }, file),
          entities: kubeEntities
        }
      }
    } else {
      // then the user has pointed us to a yaml file
      debug('status by file', file)

      // handle !spec
      const passedAsParameter = !isURL && filepath.match(/\/(!.*$)/)

      const { fetchFileString } = await import('../util/fetch-file')
      const specs: KubeResource[] = (passedAsParameter
        ? parseYAML(execOptions.parameters[passedAsParameter[1].slice(1)]) // yaml given programatically
        : flatten((await fetchFileString(file)).map(_ => parseYAML(_)))
      ).filter(_ => _) // in case there are empty paragraphs;
      debug('specs', specs)

      const kubeEntities = Promise.all(
        specs.map(spec => {
          return repl
            .qexec(
              `kubectl get "${spec.kind}" "${spec.metadata.name}" ${ns(
                spec
              )} -o json`,
              undefined,
              undefined,
              raw
            )
            .catch(errorEntity(execOptions, spec, namespace))
        })
      )

      // make a table where the rows are the paragraphs in the yaml file
      if (execOptions.raw) {
        return kubeEntities
      } else {
        debug('kubeEntities', await kubeEntities)
        return {
          headerRow: headerRow({ title: file }),
          entities: kubeEntities
        }
      }
    }
  }
}

/**
 * Add any kube-native resources that might be associated with the controllers
 *
 */
const findControlledResources = async (
  args: EvaluatorArgs,
  kubeEntities: KubeResource[]
): Promise<Row[] | KubeResource[]> => {
  debug('findControlledResources', kubeEntities)

  const raw = Object.assign({}, args.execOptions, { raw: true })
  const pods = removeDuplicateResources(
    flatten(
      await Promise.all(
        kubeEntities
          .map(({ kind, metadata: { labels, namespace } }) => {
            if (labels && labels.app && kind !== 'Pod') {
              const pods: Promise<KubeResource[]> = repl.qexec(
                `kubectl get pods -n "${namespace || 'default'}" -l "app=${
                  labels.app
                }" -o json`,
                undefined,
                undefined,
                raw
              )
              return pods
            }
          })
          .filter(x => x)
      )
    )
  )

  if (args.execOptions.raw) {
    return pods
  } else if (pods.length > 0) {
    return Promise.all(pods.map(formatEntity(args.parsedOptions))).then(
      formattedEntities => {
        return [headerRow({ title: 'pods' })].concat(flatten(formattedEntities))
      }
    )
  } else {
    return []
  }
}

/**
 * port status entities to table module
 *
 */
const statusTable = entities => {
  if (Array.isArray(entities) && entities.length > 1) {
    const headerRow = entities[0]
    const entitiesRows = entities.slice(1)
    const header: Row = {
      name: headerRow.name,
      attributes: headerRow.attributes,
      outerCSS: headerRow.outerCSS,
      fontawesome: headerRow.fontawesome,
      fontawesomeCSS: headerRow.fontawesomeCSS
    }

    return new Table({
      title: headerRow.title,
      noSort: headerRow.noSort,
      tableCSS: headerRow.tableCSS,
      fontawesome,
      fontawesomeCSS,
      fontawesomeBalloon: headerRow.fontawesomeBalloon,
      header,
      body: entitiesRows
    })
  } else {
    debug('not a valid table', entities)
    return entities
  }
}

/**
 * k status command handler
 *
 */
export const status = (command: string) => async (
  args: EvaluatorArgs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> => {
  debug('constructing status', args)

  const doWatch = args.parsedOptions.watch || args.parsedOptions.w

  const refreshCommand = args.command.replace('--watch', '').replace('-w', '')

  const direct = await getDirectReferences(command)(args)

  debug('getDirectReferences', direct)
  if (Array.isArray(direct)) {
    const statusResult =
      args.parsedOptions.multi || Array.isArray(direct[0])
        ? { tables: direct.map(d => statusTable(d)) }
        : statusTable(direct)

    return doWatch && (isTable(statusResult) || isMultiTable(statusResult))
      ? formatWatchableTable(statusResult, {
          refreshCommand,
          watchByDefault: true
        })
      : statusResult
  }

  const maybe = await (direct.entities || direct)
  const directEntities = await (Array.isArray(maybe)
    ? Promise.all(maybe)
    : [maybe])

  const controlled = await findControlledResources(args, directEntities)

  debug('direct', maybe, directEntities)
  debug('controlled', controlled)

  if (controlled.length === 0) {
    if (args.execOptions.raw) {
      return direct
    } else {
      return Promise.all(
        directEntities.map(formatEntity(args.parsedOptions))
      ).then(formattedEntities => {
        debug('formatted entities', formattedEntities)
        if (direct.headerRow) {
          const statusResult = statusTable(
            [direct.headerRow].concat(...formattedEntities)
          )
          return doWatch && isTable(statusResult)
            ? formatWatchableTable(statusResult, {
                refreshCommand,
                watchByDefault: true
              })
            : statusResult
        } else {
          return formattedEntities
        }
      })
    }
  } else {
    if (args.execOptions.raw) {
      return (await direct).concat(controlled)
    } else {
      return Promise.all(
        directEntities.map(formatEntity(args.parsedOptions))
      ).then(formattedEntities => {
        if (direct.headerRow) {
          const directTable = statusTable(
            [direct.headerRow].concat(formattedEntities)
          )
          const controlledTable = statusTable(controlled)
          const statusResult = { tables: [directTable, controlledTable] }
          return doWatch &&
            (isTable(statusResult) || isMultiTable(statusResult))
            ? formatWatchableTable(statusResult, {
                refreshCommand,
                watchByDefault: true
              })
            : statusResult
        } else {
          console.error('internal error: expected headerRow for direct')
          return formattedEntities.concat(controlled)
        }
      })
    }
  }
}

/**
 * Register the commands
 *
 */
export default (commandTree: CommandRegistrar) => {
  const cmd = commandTree.listen('/k8s/status', status('status'), {
    usage: usage('status'),
    inBrowserOk: true,
    noAuthOk: ['openwhisk']
  })

  commandTree.synonym('/k8s/list', status('list'), cmd, {
    usage: usage('list'),
    inBrowserOk: true,
    noAuthOk: ['openwhisk']
  })
}
