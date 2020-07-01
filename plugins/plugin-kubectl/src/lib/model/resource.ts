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

import { KResponse, ResourceWithMetadata, MultiModalResponse } from '@kui-shell/core'

import kubeuiApiVersion from '../../controller/kubectl/apiVersion'

export interface KubeStatusCondition {
  lastProbeTime?: string
  lastUpdateTime: string
  lastTransitionTime: string
  status: string | boolean
  reason?: string
  message: string
  type?: string
  phase?: string
}

interface KubeContainerStatus {
  name: string
  containerID: string
  restartCount: number
  ready: boolean
  state: any // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface KubeLoadBalancer {
  ingress: string
}

export interface KubeStatus {
  message?: string
  state?: string
  startTime?: string
  completionTime?: string
  phase?: string
  podName?: string // e.g. tekton PipelineRun or TaskRun
  qosClass?: string
  replicas?: number
  readyReplicas?: number
  availableReplicas?: number
  unavailableReplicas?: number
  updatedReplicas?: number
  loadBalancer?: KubeLoadBalancer
  conditions?: KubeStatusCondition[]
}
export class DefaultKubeStatus implements KubeStatus {
  public message = undefined
}

export interface WithOwnerReferences {
  ownerReferences: {
    apiVersion: string
    kind: string
    name: string
  }[]
}

interface WithResourceVersion {
  resourceVersion: string
}

export type KubeResourceWithResourceVersion = KubeResource<
  Record<string, any>,
  KubeMetadata & Required<WithResourceVersion>
>

export function hasResourceVersion(resource: KubeResource): resource is KubeResourceWithResourceVersion {
  const withVersion = resource as KubeResourceWithResourceVersion
  return typeof withVersion.metadata.resourceVersion === 'string'
}

export function sameResourceVersion(a: MultiModalResponse<KubeResource>, b: MultiModalResponse<KubeResource>) {
  return (
    a.apiVersion === b.apiVersion &&
    a.kind === b.kind &&
    a.metadata.name === b.metadata.name &&
    a.metadata.namespace === b.metadata.namespace &&
    hasResourceVersion(a) &&
    hasResourceVersion(b) &&
    a.metadata.resourceVersion === b.metadata.resourceVersion
  )
}

export type KubeMetadata = Partial<WithOwnerReferences> &
  Partial<WithResourceVersion> & {
    name: string
    namespace?: string
    labels?: { [key: string]: string }
    annotations?: Record<string, any>
    creationTimestamp?: string
    generation?: string
    generateName?: string
  }

export type KubeResourceWithOwnerReferences = KubeResource<
  Record<string, any>,
  KubeMetadata & Required<WithOwnerReferences>
>

export function hasSingleOwnerReference(resource: KubeResource): resource is KubeResourceWithOwnerReferences {
  if (!resource.metadata) {
    return false
  }

  const { ownerReferences } = resource.metadata as WithOwnerReferences
  return (
    ownerReferences &&
    Array.isArray(ownerReferences) &&
    ownerReferences.length === 1 &&
    typeof ownerReferences[0].apiVersion === 'string' &&
    typeof ownerReferences[0].kind === 'string' &&
    typeof ownerReferences[0].name === 'string'
  )
}

export class DefaultKubeMetadata implements KubeMetadata {
  public kind = undefined

  public name = undefined
}

interface RoleRule {
  apiGroups: string[]
  resources: string[]
  verbs: string[]
}

interface RoleRef {
  apiGroup: string
  kind: string
  name: string
}

export interface WithRawData<Content = void> extends ResourceWithMetadata<Content> {
  kuiRawData?: string // the raw data
}

export function hasRawData(resource: ResourceWithMetadata) {
  const withData = resource as WithRawData
  return typeof withData.kuiRawData === 'string'
}

/**
 * The basic Kubernetes resource
 *
 */
export type KubeResource<Status = KubeStatus, Metadata = KubeMetadata> = ResourceWithMetadata &
  WithRawData & {
    apiVersion: string
    kind: string
    metadata?: Metadata
    status?: Status
    spec?: any // eslint-disable-line @typescript-eslint/no-explicit-any

    // TODO we should factor these out into a trait
    originatingCommand: string // the command that generated this raw data
    isSimulacrum?: boolean // is this a manufactured resource that does not exist on the api server?
    isKubeResource: true // this tag helps `isKubeResource()` to check if an `Entity` is KubeResource
  }

/** is the resource Namespaced? */
export function isNamespaced(resource: KubeResource) {
  return resource.metadata !== undefined && resource.metadata.namespace !== undefined
}

/** is the command response a Kubernetes resource? note: excluding any ones we simulate in kubeui */
export function isKubeResource(entity: KResponse | ResourceWithMetadata): entity is KubeResource {
  const kube = entity as KubeResource
  return (
    kube !== undefined &&
    kube.isKubeResource === true &&
    kube.apiVersion !== undefined &&
    kube.apiVersion !== kubeuiApiVersion &&
    kube.kind !== undefined
  )
}

export interface WithSummary {
  summary: {
    content: string
    contentType?: 'yaml' | 'text/markdown'
  }
}

/**
 * `KubeResourceWithSummary` allows plugins to provide their own
 * Summary. Otherwise lib/views/modes/summary will try to fetch one
 * automatically.
 *
 */
export type KubeResourceWithSummary<Status = KubeStatus> = KubeResource<Status> & WithSummary

export function isKubeResourceWithItsOwnSummary(resource: KubeResource): resource is KubeResourceWithSummary {
  return resource !== undefined && (resource as KubeResourceWithSummary).summary !== undefined
}

/**
 * This allows us to exclude certain resource kinds from auto-summarization
 *
 */
export function isSummarizableKubeResource(resource: KubeResource): boolean {
  return (
    isKubeResource(resource) &&
    (isKubeResourceWithItsOwnSummary(resource) ||
      (resource.kind !== undefined && resource.kind !== 'List' && resource.kind !== 'CustomResourceDefinition'))
  )
}

/** Role */
interface Role extends KubeResource {
  rules: RoleRule[]
}
export function isRole(resource: KubeResource): resource is Role {
  const role = resource as Role
  return role.rules !== undefined
}

/** RoleBinding */
interface RoleBinding extends KubeResource {
  roleRef: RoleRef
  subjects: { kind: string; name: string }[]
}
export function isRoleBinding(resource: KubeResource): resource is RoleBinding {
  const rb = resource as RoleBinding
  return rb.roleRef !== undefined && rb.subjects !== undefined
}

/** ServiceAccount */
interface ServiceAccount extends KubeResource {
  secrets: { name: string }[]
}
export function isServiceAccount(resource: KubeResource): resource is ServiceAccount {
  const sa = resource as ServiceAccount
  return isKubeResource(resource) && sa.secrets !== undefined
}

export interface CRDResource extends KubeResource {
  spec: {
    names: {
      kind: string
      shortnames: string[]
    }
  }
}

/**
 * Kubernetes Pod resource type
 *
 */
interface PodStatus extends KubeStatus {
  containerStatuses: KubeContainerStatus[]
  hostIP: string
  podIP: string
}
export interface Pod extends KubeResource<PodStatus> {
  apiVersion: 'v1'
  kind: 'Pod'
  spec: {
    nodeName: string
    nominatedNodeName?: string
    readinessGates?: { conditionType: string }[]
    containers: {
      args: string[]
      command: string[]
      env: { name: string; value: string }[]
      image: string
      imagePullPolicy: string
      name: string
      resource: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
      terminationMessagePath: string
      terminationMessagePolicy: string
      volumeMounts: { mountPath: string; name: string }[]
      ports?: { containerPort: string; protocol: string }[]
      workingDir: string
    }[]
  }
}

/**
 * @return whether the given resource is an instance of a Pod
 *
 */
export function isPod(resource: KubeResource): resource is Pod {
  return isKubeResource(resource) && resource.apiVersion === 'v1' && resource.kind === 'Pod'
}

/**
 * Kubernetes Namespace resource type
 *
 */
export interface Namespace extends KubeResource {
  apiVersion: 'v1'
  kind: 'Namespace'
}

/**
 * @return whether the given resource is an instance of a Namespace
 *
 */
export function isNamespace(resource: KubeResource): resource is Namespace {
  return isKubeResource(resource) && resource.apiVersion === 'v1' && resource.kind === 'Namespace'
}

/**
 * Kubernetes Job resource type
 *
 */
export interface Job extends KubeResource {
  apiVersion: 'batch/v1'
  kind: 'Job'
}

/**
 * @return whether the given resource is an instance of a Deploymemt
 *
 */
export function isJob(resource: KubeResource): resource is Job {
  return isKubeResource(resource) && resource.apiVersion === 'batch/v1' && resource.kind === 'Job'
}

/**
 * Kubernetes Deployment resource type
 *
 */
export interface Deployment extends KubeResource {
  apiVersion: 'extensions/v1beta1'
  kind: 'Deployment'
}

/**
 * @return whether the given resource is an instance of a Deployment
 *
 */
export function isDeployment(resource: KubeResource): resource is Deployment {
  return isKubeResource(resource) && resource.apiVersion === 'extensions/v1beta1' && resource.kind === 'Deployment'
}

/**
 * Kubernetes ReplicaSet resource type
 *
 */
export interface ReplicaSet extends KubeResource {
  apiVersion: 'extensions/v1beta1'
  kind: 'ReplicaSet'
}

/**
 * @return whether the given resource is an instance of a ReplicaSet
 *
 */
export function isReplicaSet(resource: KubeResource): resource is ReplicaSet {
  return isKubeResource(resource) && resource.apiVersion === 'extensions/v1beta1' && resource.kind === 'ReplicaSet'
}

/**
 * Trait that defines an involvedObject, e.g. for Events
 *
 */
export interface InvolvedObject {
  involvedObject: {
    apiVersion: string
    kind: string
    name: string
    namespace: string
    uid?: string
    fieldPath?: string
    resourceVersion?: string
  }
}
export type KubeResourceWithInvolvedObject = KubeResource & InvolvedObject

export function hasInvolvedObject(
  resource: KubeResource | KubeResourceWithInvolvedObject
): resource is KubeResourceWithInvolvedObject {
  const io = resource as KubeResourceWithInvolvedObject
  return (
    io.involvedObject !== undefined &&
    typeof io.involvedObject.apiVersion === 'string' &&
    typeof io.involvedObject.kind === 'string' &&
    typeof io.involvedObject.name === 'string'
  )
}

/**
 * Kubernetes Event resource type
 *
 */
export type Event = KubeResourceWithInvolvedObject & {
  apiVersion: 'v1'
  kind: 'Event'
  firstTimestamp: string
  lastTimestamp: string
  count: number
  reason: string
  message: string
  type: 'Normal' | 'Warning' | 'Error'
  source: {
    component: string
    host: string
  }
  metadata: {
    name: string
    namespace: string
  }
  involvedObject: {
    apiVersion: string
    kind: string
    name: string
    namespace: string
  }
}

/**
 * @return whether the given resource is an instance of an Event
 *
 */
export function isEvent(resource: KubeResource): resource is Event {
  return isKubeResource(resource) && resource.apiVersion === 'v1' && resource.kind === 'Event'
}

/** is the command response a kube resource that can responds to "kubectl delete", etc.? */
export function isCrudableKubeResource(entity: ResourceWithMetadata): entity is KubeResource {
  return isKubeResource(entity) && !isEvent(entity) && !(entity as KubeResource).isSimulacrum
}

/**
 * e.g. `kubectl get pods -o json` will return a kind: items
 *
 */
export interface KubeItems<Item extends KubeResource = KubeResource> extends KubeResource {
  apiVersion: 'v1'
  kind: 'List'
  items: Item[]
}

export function isKubeItems(resource: KubeResource): resource is KubeItems {
  return isKubeResource(resource) && resource.apiVersion === 'v1' && resource.kind === 'List'
}

export function isKubeItemsOfKind<Item extends KubeResource = KubeResource>(
  resource: KubeResource,
  isOfKind: (item: KubeResource) => item is Item
): resource is KubeItems<Item> {
  return isKubeItems(resource) && resource.items.length > 0 && isOfKind(resource.items[0])
}

/** Scope */
type Scope = 'Namespaced' | 'Cluster'

/**
 * CustomResourceDefinition
 *
 */
export type CustomResourceDefinition = KubeResource & {
  apiVersion: 'apiextensions.k8s.io/v1' | 'apiextensions.k8s.io/v1beta1'
  kind: 'CustomResourceDefinition'
  spec: {
    scope: Scope
    group: string
    version: string
    names: {
      categories: Record<string, string>
      kind: string
      listKind: string
      plural: string
      singular: string
    }
  }
}

/**
 * @return whether the given resource is an instance of a CustomResourceDefinition
 *
 */
export function isCustomResourceDefinition(resource: KubeResource): resource is CustomResourceDefinition {
  return (
    isKubeResource(resource) &&
    (resource.apiVersion === 'apiextensions.k8s.io/v1' || resource.apiVersion === 'apiextensions.k8s.io/v1beta1') &&
    resource.kind === 'CustomResourceDefinition'
  )
}

/**
 * ConfigMap
 *
 */
export type ConfigMap = KubeResource & {
  apiVersion: 'v1'
  kind: 'ConfigMap'
  data: Record<string, any>
}

/**
 * @return whether the given resource is an instance of a CustomResourceDefinition
 *
 */
export function isConfigMap(resource: KubeResource): resource is ConfigMap {
  return isKubeResource(resource) && resource.apiVersion === 'v1' && resource.kind === 'ConfigMap'
}

/**
 * Kubernetes context
 *
 */
export interface KubeContext extends KubeResource {
  apiVersion: typeof kubeuiApiVersion
  kind: 'Context'
  spec: {
    user: string
    cluster: string
  }
}

export interface Resource<T = KubeResource> {
  filepathForDrilldown?: string
  kind?: string
  name?: string
  resource: T
}

/**
 * Is the given resource kind cluster scoped (as opposed to namespace scoped)?
 * FIXME: apiVersion
 */
export function isClusterScoped(kind: string) {
  return kind === 'CustomResourceDefinition' || kind === 'Namespace' || kind === 'Node'
}

interface NodeCapacity {
  cpu: string
  'ephemeral-storage': string
  'hugepages-1Gi': string
  'hugepages-2Mi': string
  memory: string
  pods: string
}

export type AddressType = 'InternalIP' | 'ExternalIP' | 'Hostname'
interface NodeStatus {
  addresses: { address: string; type: AddressType }[]
  allocatable: NodeCapacity
  capacity: NodeCapacity
  conditions: KubeStatusCondition[]
  images: { names: string[]; sizeBytes: number }[]
  nodeInfo: {
    architecture: string
    bootId: string
    containerRuntimeVersion: string
    kernelVersion: string
    kubeProxyVersion: string
    kubeletVersion: string
    machineID: string
    operatingSystem: string
    osImage: string
    systemUUID: string
  }
}

export interface Node extends KubeResource<NodeStatus> {
  apiVersion: 'v1'
  kind: 'Node'
}

export function isNode(resource: KubeResource): resource is Node {
  return resource.apiVersion === 'v1' && resource.kind === 'Node'
}

export default KubeResource
