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

import { join } from 'path'
import { Arguments, i18n, TreeItem, TreeResponse } from '@kui-shell/core'

import { KubeOptions, isRecursive } from '../../controller/kubectl/options'
import { kindPartOf } from '../../controller/kubectl/fqn'
import { _needle } from './fetch-file'
import { KubeResource, isKubeResource, isKubeItems } from '../../lib/model/resource'

const strings = i18n('plugin-kubectl')
const KEYSEPARATER = '---'

/**
 * fetch raw files from `filepath`
 */
async function fetchRawFiles(args: Arguments<KubeOptions>, filepath: string) {
  if (filepath.match(/http(s)?:\/\//)) {
    const fetchOnce = () => _needle(args.REPL, 'get', filepath).then(_ => _.body)

    const retry = (delay: number) => async (err: Error) => {
      if (/timeout/.test(err.message) || /hang up/.test(err.message) || /hangup/.test(err.message)) {
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
    const path = args.REPL.encodeComponent(filepath)
    const resourceStats = (
      await args.REPL.rexec<{ data?: string; isDirectory?: boolean }>(`vfs fstat ${path} --with-data`)
    ).content

    if (resourceStats.isDirectory) {
      return args.REPL.rexec<{ path: string }[]>(
        `vfs ls ${join(path, isRecursive(args) ? '/**/*.yaml' : '/*.yaml')} --with-data`
      )
        .then(_ => _.content)
        .then(filenames =>
          Promise.all(
            filenames.map(({ path }) =>
              args.REPL.rexec<{ data: string }>(`vfs fstat ${path} --with-data`).then(_ => _.content.data)
            )
          )
        )
        .then(_ => _.join('---\n'))
    } else {
      return resourceStats.data
    }
  }
}

function joinKey(keys: string[]) {
  return keys.join(KEYSEPARATER)
}

type BucketValue = {
  raw: TreeItem['content']
}

type Bucket = {
  [key: string]: BucketValue
}

interface Buckets {
  all: Bucket
  labels: Bucket
  labeledResources: Bucket
  kind: Bucket
  name: Bucket
}

async function categorizeResources(resources: KubeResource[]) {
  const { safeDump } = await import('js-yaml')

  const buckets: Buckets = {
    all: {},
    labels: {},
    labeledResources: {},
    kind: {},
    name: {}
  }

  const unlabeled = {}

  await Promise.all(
    resources.map(async resource => {
      const kind = kindPartOf(resource)
      const name = resource.metadata.name
      const raw = resource.kuiRawData ? await safeDump(resource.kuiRawData) : await safeDump(resource) // FIXME why get deployed yaml resource would contain execoptions,..?

      const append = (bucket: Bucket, key?: string) => {
        if (!key) {
          return Object.assign(bucket, { raw })
        } else if (!bucket[key]) {
          return Object.assign(bucket, { [key]: { raw } })
        } else {
          bucket[key].raw = !bucket[key].raw ? raw : `${bucket[key].raw}---\n${raw}`
        }
      }

      const addToAll = (key: string) => {
        append(buckets.all, key)
      }

      const addToLabels = (key: string) => {
        append(buckets.labels, key)
      }

      const addToKind = (key: string) => {
        append(buckets.kind, key)
      }

      const addToLabeledResources = (key: string) => {
        append(buckets.labeledResources, key)
      }

      const addToName = (name: string) => {
        append(buckets.name, name)
      }

      addToAll('all')
      if (resource.metadata.labels) {
        Object.entries(resource.metadata.labels).map(([labelKey, labelValue]) => {
          let label = labelKey
          if (labelKey === 'app') {
            label = labelValue
            addToLabels(label)
          } else if (labelKey === 'name') {
            label = 'unlabeled'
            append(unlabeled)
          } else {
            addToLabels(label)
            addToLabeledResources(joinKey([labelKey, labelValue]))
          }

          addToKind(joinKey([label, kind]))
          addToName(joinKey([label, kind, name]))
        })
      } else {
        append(unlabeled)
        addToKind(joinKey(['unlabeled', kind]))
        addToName(joinKey(['unlabeled', kind, name]))
      }
    })
  )

  // Add unlabeled now to make sure it shows up at the end of the labels
  if (Object.keys(unlabeled).length !== 0) {
    Object.assign(buckets.labels, { unlabeled })
  }

  return buckets
}

/**
 * This is the function to put and categorize raw input into buckets
 *
 */
async function categorizeRaw(raw: string): Promise<Buckets> {
  const { safeLoadAll } = await import('js-yaml')
  const resources: KubeResource[] = await safeLoadAll(raw)
  return categorizeResources(resources)
}

/**
 * This is the function to transform buckets into `TreeDataItem[]`
 *
 */
function transformBucketsToTree(buckets: Buckets): TreeResponse['data'] {
  const levels = Object.keys(buckets)

  const next = (buckets: Buckets, idx: number, findNextBucketByKey?: string) => {
    const findNextBucket = (idx: number, filterKey: string) => {
      if (levels[idx]) {
        if (!filterKey) {
          return Object.entries(buckets[levels[idx]])
        } else if (levels[idx + 1]) {
          return Object.entries(buckets[levels[idx + 1]]).filter(([key]) => key.includes(`${filterKey}${KEYSEPARATER}`))
        }
      }
    }

    const nextBucket = findNextBucket(idx, findNextBucketByKey)

    return !nextBucket || nextBucket.length === 0
      ? undefined
      : nextBucket.map(([key, value]: [string, BucketValue]) => {
          const _name = key.split(KEYSEPARATER)
          return {
            name: strings(_name[_name.length - 1]),
            id: key,
            content: value.raw,
            contentType: 'yaml' as const,
            children: next(buckets, idx + 1, key)
          }
        })
  }

  const data = [
    {
      name: strings('All Resources'),
      id: 'all',
      content: buckets.all.all.raw,
      contentType: 'yaml' as const,
      defaultExpanded: true,
      children: next(buckets, 1)
    }
  ]

  return data
}

/**
 * This is the function to fetch templates as `MultiModalMode` with `TreeRespons`:
 * 1. it fetches raw inputs in a directory or a single file
 * 2. it categorizes and puts the raw inputs into four buckets
 * 3. it transforms the buckets into `TreeResponse` and returns a `MultiModalMode`
 *
 */
export async function getSources(args: Arguments<KubeOptions>, filepath: string) {
  const raw = await fetchRawFiles(args, filepath)
  const buckets = await categorizeRaw(raw)
  const tree = transformBucketsToTree(buckets)

  return {
    mode: 'sources',
    label: strings('sources'),
    content: {
      apiVersion: 'kui-shell/v1' as const,
      kind: 'TreeResponse' as const,
      data: tree
    }
  }
}

/**
 * This is the function to present the deployed resources as `MultiModalMode` with `TreeRespons`:
 * 1. it categorizes and puts the resources into four buckets
 * 3. it transforms the buckets into `TreeResponse` and returns a `MultiModalMode`
 *
 */
export async function getDeployedResources(resource: KubeResource) {
  if (isKubeResource(resource)) {
    console.error('resource', resource)
    const raw = isKubeItems(resource) ? resource.items : [resource]
    const buckets = await categorizeResources(raw)
    console.error('buckets', buckets)
    const tree = transformBucketsToTree(buckets)
    return {
      mode: 'deployed resources',
      label: strings('deployed resources'),
      content: {
        apiVersion: 'kui-shell/v1' as const,
        kind: 'TreeResponse' as const,
        data: tree
      }
    }
  }
}
