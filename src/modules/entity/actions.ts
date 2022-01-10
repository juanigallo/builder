import { DeploymentPreparationData } from 'dcl-catalyst-client'
import { Entity, EntityType } from 'dcl-catalyst-commons'
import { action } from 'typesafe-actions'

// Fetch Item Entity
export const FETCH_ENTITIES_REQUEST = '[Request] Fetch Entities'
export const FETCH_ENTITIES_SUCCESS = '[Success] Fetch Entities'
export const FETCH_ENTITIES_FAILURE = '[Failure] Fetch Entities'

export const fetchEntitiesRequest = (type: EntityType, pointers: string[]) => action(FETCH_ENTITIES_REQUEST, { type, pointers })
export const fetchEntitiesSuccess = (type: EntityType, pointers: string[], entities: Entity[]) =>
  action(FETCH_ENTITIES_SUCCESS, { entities, type, pointers })
export const fetchEntitiesFailure = (type: EntityType, pointers: string[], error: string) =>
  action(FETCH_ENTITIES_FAILURE, { error, type, pointers })

export type FetchEntitiesRequestAction = ReturnType<typeof fetchEntitiesRequest>
export type FetchEntitiesSuccessAction = ReturnType<typeof fetchEntitiesSuccess>
export type FetchEntitiesFailureAction = ReturnType<typeof fetchEntitiesFailure>

// Deploy entities

export const DEPLOY_ENTITIES_REQUEST = '[Request] Deploy entities'
export const DEPLOY_ENTITIES_SUCCESS = '[Success] Deploy entities'
export const DEPLOY_ENTITIES_FAILURE = '[Failure] Deploy entities'

export const deployEntitiesRequest = (entities: DeploymentPreparationData[]) => action(DEPLOY_ENTITIES_REQUEST, { entities })
export const deployEntitiesSuccess = (entities: DeploymentPreparationData[]) => action(DEPLOY_ENTITIES_SUCCESS, { entities })
export const deployEntitiesFailure = (entities: DeploymentPreparationData[], error: string) =>
  action(DEPLOY_ENTITIES_FAILURE, { entities, error })

export type DeployEntitiesRequestAction = ReturnType<typeof deployEntitiesRequest>
export type DeployEntitiesSuccessAction = ReturnType<typeof deployEntitiesSuccess>
export type DeployEntitiesFailureAction = ReturnType<typeof deployEntitiesFailure>
