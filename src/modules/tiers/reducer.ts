import { loadingReducer, LoadingState } from 'decentraland-dapps/dist/modules/loading/reducer'
import {
  BuyThirdPartyItemTiersFailureAction,
  BuyThirdPartyItemTiersRequestAction,
  BuyThirdPartyItemTiersSuccessAction,
  BUY_THIRD_PARTY_ITEM_TIERS_FAILURE,
  BUY_THIRD_PARTY_ITEM_TIERS_REQUEST,
  BUY_THIRD_PARTY_ITEM_TIERS_SUCCESS,
  ClearTiersErrorAction,
  CLEAR_TIERS_ERROR,
  FetchThirdPartyItemTiersFailureAction,
  FetchThirdPartyItemTiersRequestAction,
  FetchThirdPartyItemTiersSuccessAction,
  FETCH_THIRD_PARTY_ITEM_TIERS_FAILURE,
  FETCH_THIRD_PARTY_ITEM_TIERS_REQUEST,
  FETCH_THIRD_PARTY_ITEM_TIERS_SUCCESS
} from './actions'
import { ThirdPartyItemTier } from './types'

export type TiersState = {
  data: {
    thirdPartyItems: ThirdPartyItemTier[]
  }
  loading: LoadingState
  error: string | null
}

const INITIAL_STATE: TiersState = {
  data: {
    thirdPartyItems: []
  },
  loading: [],
  error: null
}

type TiersReducerAction =
  | FetchThirdPartyItemTiersRequestAction
  | FetchThirdPartyItemTiersSuccessAction
  | FetchThirdPartyItemTiersFailureAction
  | BuyThirdPartyItemTiersRequestAction
  | BuyThirdPartyItemTiersSuccessAction
  | BuyThirdPartyItemTiersFailureAction
  | ClearTiersErrorAction

export function tiersReducer(state = INITIAL_STATE, action: TiersReducerAction): TiersState {
  switch (action.type) {
    case BUY_THIRD_PARTY_ITEM_TIERS_REQUEST:
    case FETCH_THIRD_PARTY_ITEM_TIERS_REQUEST: {
      return {
        ...state,
        error: null,
        loading: loadingReducer(state.loading, action)
      }
    }

    case BUY_THIRD_PARTY_ITEM_TIERS_SUCCESS: {
      return {
        ...state,
        loading: loadingReducer(state.loading, action),
        error: null
      }
    }

    case FETCH_THIRD_PARTY_ITEM_TIERS_SUCCESS: {
      const { tiers } = action.payload
      return {
        ...state,
        loading: loadingReducer(state.loading, action),
        error: null,
        data: {
          ...state.data,
          thirdPartyItems: tiers
        }
      }
    }

    case BUY_THIRD_PARTY_ITEM_TIERS_FAILURE:
    case FETCH_THIRD_PARTY_ITEM_TIERS_FAILURE: {
      const { error } = action.payload
      return {
        ...state,
        loading: loadingReducer(state.loading, action),
        error
      }
    }

    case CLEAR_TIERS_ERROR: {
      return {
        ...state,
        error: null
      }
    }

    default:
      return state
  }
}
