import { all, call, put, takeEvery } from 'redux-saga/effects'
import { CatalystClient } from 'dcl-catalyst-client'
import { Entity, EntityType } from 'dcl-catalyst-commons'
import { Authenticator, AuthIdentity } from 'dcl-crypto'
import { getIdentity } from 'modules/identity/utils'
import {
  deployEntitiesFailure,
  DeployEntitiesRequestAction,
  deployEntitiesSuccess,
  DeployEntitiesSuccessAction,
  DEPLOY_ENTITIES_REQUEST,
  DEPLOY_ENTITIES_SUCCESS,
  fetchEntitiesFailure,
  fetchEntitiesRequest,
  FetchEntitiesRequestAction,
  fetchEntitiesSuccess,
  FETCH_ENTITIES_REQUEST
} from './actions'

export function* entitySaga(catalyst: CatalystClient) {
  // takes
  yield takeEvery(FETCH_ENTITIES_REQUEST, handleFetchEntitiesRequest)
  yield takeEvery(DEPLOY_ENTITIES_REQUEST, handleDeployEntitiesRequest)
  yield takeEvery(DEPLOY_ENTITIES_SUCCESS, handleDeployEntitiesSuccess)

  // handlers
  function* handleFetchEntitiesRequest(action: FetchEntitiesRequestAction) {
    const { type, pointers } = action.payload
    try {
      const entities: Entity[] = yield call([catalyst, 'fetchEntitiesByPointers'], type, pointers)
      yield put(fetchEntitiesSuccess(type, pointers, entities))
    } catch (error) {
      yield put(fetchEntitiesFailure(type, pointers, error.message))
    }
  }

  function* handleDeployEntitiesRequest(action: DeployEntitiesRequestAction) {
    const { entities } = action.payload
    try {
      const identity: AuthIdentity | undefined = yield getIdentity()

      if (!identity) {
        throw new Error('Invalid Identity')
      }

      yield all(
        entities.map(entity =>
          call([catalyst, 'deployEntity'], { ...entity, authChain: Authenticator.signPayload(identity, entity.entityId) })
        )
      )

      yield put(deployEntitiesSuccess(entities))
    } catch (error) {
      yield put(deployEntitiesFailure(entities, error.message))
    }
  }

  function* handleDeployEntitiesSuccess(action: DeployEntitiesSuccessAction) {
    const pointers = action.payload.entities.map(entity => entity.entityId)
    if (pointers.length > 0) {
      yield put(fetchEntitiesRequest(EntityType.WEARABLE, pointers))
    }
  }
}
