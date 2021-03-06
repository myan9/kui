/*
 * Copyright 2019 The Kubernetes Authors
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

import { Tab } from '../../tab'
import { SidecarModeFilter } from './modes'
import { MetadataBearing } from '../../../models/entity'

/**
 * This is the most complete form of a badge specification, allowing
 * the caller to provide a title, an onclick handler, and an optional
 * fontawesome icon representation.
 *
 */
export interface BadgeSpec {
  title: string
  fontawesome?: string
  image?: HTMLImageElement | SVGElement
  css?: string
  onclick?: () => void
}

export type Badge = string | BadgeSpec | Element

/**
 * Interpretation: if the resource passes the given "when" filter,
 * then add the given sidecar badge
 *
 */
export interface BadgeRegistration<Resource extends MetadataBearing> {
  when: SidecarModeFilter<Resource> // when this filter returns true...
  badge: BadgeSpec | ((resource: Resource, tab: Tab) => BadgeSpec) // either a badge spec, or a function that produces one
}

/** registered badge handlers */
export const registrar: BadgeRegistration<MetadataBearing>[] = []

/**
 * Register a new badge
 *
 */
export function registerSidecarBadge<Resource extends MetadataBearing>(registration: BadgeRegistration<Resource>) {
  registrar.push(registration)
}
export default registerSidecarBadge
