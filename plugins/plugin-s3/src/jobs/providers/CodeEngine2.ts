/*
 * Copyright 2020 IBM Corporation
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

import { v4 } from 'uuid'
import { REPL, Table } from '@kui-shell/core'

import { JobParameters, JobEnv } from '../'
import { MinioConfig } from '../../providers'

type JobName = string

export default class CodeEngine /* implements JobProvider<JobName> */ {
  // eslint-disable-next-line no-useless-constructor
  public constructor(private readonly repl: REPL, private readonly minioConfig: MinioConfig) {}

  /** @return the details of the given Job */
  /* public get(jobName: JobName) {
    return undefined
  } */

  /** @return the logs of the give Task of the given Job */
  public logs(jobName: JobName, taskIdx: number) {
    return this.repl.qexec<string>(`ibmcloud ce kubectl logs ${jobName}-${taskIdx}-0`)
  }

  /** Block until the given job completes */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async wait(jobName: JobName, nTasks: number) {
    return this.repl.qexec<Table>(`ibmcloud ce jobrun list ${jobName} --watch`)
  }

  /** -e key=value */
  private dashE(env: JobEnv): string {
    return Object.keys(env)
      .map(key => `-e ${key}=${Array.isArray(env[key]) ? `'${JSON.stringify(env[key])}'` : `"${env[key]}"`}`)
      .join(' ')
  }

  /** Schedule a Job execution */
  public async run(image: string, params: JobParameters & Required<{ cmdlines: string[] }>, env: JobEnv = {}) {
    const { nTasks, nShards } = params

    const parOpts = this.dashE(params)
    const envOpts = this.dashE(env)
    const keyOpts = this.dashE({
      minioConfig: Buffer.from(JSON.stringify(this.minioConfig))
        .toString('base64')
        .replace(/=$/, '') // bug in codeengine cli with =
    })

    const jobrunName = `kui-jobrun-${v4()}`
    const cmdline = `ibmcloud ce jobrun submit --image ${image} --name ${jobrunName} --array-indices 1-${nTasks} -e NSHARDS=${nShards} ${parOpts} ${envOpts} ${keyOpts}`
    await this.repl.qexec<string>(cmdline).catch(err => {
      console.error(err)
      throw new Error(err.message)
    })

    return jobrunName
  }
}
