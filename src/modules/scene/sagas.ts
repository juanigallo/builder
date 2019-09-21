import uuidv4 from 'uuid/v4'
import { takeLatest, put, select, call, delay, take } from 'redux-saga/effects'

import {
  ADD_ITEM,
  AddItemAction,
  provisionScene,
  RESET_ITEM,
  ResetItemAction,
  UPDATE_TRANSFORM,
  UpdateTransfromAction,
  DUPLICATE_ITEM,
  DELETE_ITEM,
  DuplicateItemAction,
  DeleteItemAction,
  SET_GROUND,
  SetGroundAction,
  ApplyLayoutAction,
  APPLY_LAYOUT,
  FIX_ASSET_MAPPINGS,
  FixAssetMappingsAction
} from 'modules/scene/actions'
import { getMappings } from 'modules/asset/utils'
import {
  getGLTFsBySrc,
  getCurrentScene,
  getEntityComponentByType,
  getEntityComponents,
  getData as getScenes,
  getCollectiblesByURL,
  getEntityShape
} from 'modules/scene/selectors'
import { ComponentType, Scene, ComponentDefinition, ShapeComponent, AnyComponent } from 'modules/scene/types'
import { getSelectedEntityId } from 'modules/editor/selectors'
import { selectEntity, deselectEntity, setEditorReady, createEditorScene, SET_EDITOR_READY } from 'modules/editor/actions'
import { getCurrentBounds, getData as getProjects, getCurrentProject } from 'modules/project/selectors'
import { PARCEL_SIZE } from 'modules/project/utils'
import { EditorWindow } from 'components/Preview/Preview.types'
import { COLLECTIBLE_ASSET_PACK_ID } from 'modules/ui/sidebar/utils'
import { LOAD_MANIFEST_SUCCESS, LoadManifestSuccessAction } from 'modules/project/actions'
import { snapToGrid, snapToBounds, cloneEntities, filterEntitiesWithComponent, areEqualMappings, getSceneByProjectId } from './utils'
import { getGroundAssets } from 'modules/asset/selectors'
import { Asset } from 'modules/asset/types'
import { getFullAssetPacks } from 'modules/assetPack/selectors'
import { Project } from 'modules/project/types'

const editorWindow = window as EditorWindow

export function* sceneSaga() {
  yield takeLatest(ADD_ITEM, handleAddItem)
  yield takeLatest(UPDATE_TRANSFORM, handleUpdateTransfrom)
  yield takeLatest(RESET_ITEM, handleResetItem)
  yield takeLatest(DUPLICATE_ITEM, handleDuplicateItem)
  yield takeLatest(DELETE_ITEM, handleDeleteItem)
  yield takeLatest(SET_GROUND, handleSetGround)
  yield takeLatest(FIX_ASSET_MAPPINGS, handleFixAssetMappings)
  yield takeLatest(LOAD_MANIFEST_SUCCESS, handleLoadProjectSuccess)
  yield takeLatest(APPLY_LAYOUT, handleApplyLayout)
}

function* handleLoadProjectSuccess(action: LoadManifestSuccessAction) {
  yield put(provisionScene(action.payload.manifest.scene, true))
}

function* handleAddItem(action: AddItemAction) {
  const scene: Scene = yield select(getCurrentScene)
  if (!scene) return

  let shapeId: string | null
  let { position } = action.payload
  const { asset } = action.payload
  const transformId = uuidv4()
  const newComponents = { ...scene.components }

  if (!position) {
    position = yield call(editorWindow.editor.getCameraTarget)
    position!.y = 0
  }

  if (asset.assetPackId === COLLECTIBLE_ASSET_PACK_ID) {
    const collectibles: ReturnType<typeof getCollectiblesByURL> = yield select(getCollectiblesByURL)
    const collectible = collectibles[asset.url]
    shapeId = collectible ? collectibles[asset.url].id : null

    if (!shapeId) {
      shapeId = uuidv4()
      newComponents[shapeId] = {
        id: shapeId,
        type: ComponentType.NFTShape,
        data: {
          url: asset.url
        }
      }
    }

    position = { ...position!, y: 1.72 }
  } else {
    const gltfs: ReturnType<typeof getGLTFsBySrc> = yield select(getGLTFsBySrc)
    const gltf = gltfs[asset.url]
    shapeId = gltf ? gltfs[asset.url].id : null

    if (!shapeId) {
      shapeId = uuidv4()
      newComponents[shapeId] = {
        id: shapeId,
        type: ComponentType.GLTFShape,
        data: {
          src: asset.url,
          mappings: getMappings(asset)
        }
      }
    }
  }

  const bounds: ReturnType<typeof getCurrentBounds> = yield select(getCurrentBounds)
  if (bounds) {
    position = snapToBounds(position!, bounds)
  }

  position = snapToGrid(position!)

  newComponents[transformId] = {
    id: transformId,
    type: ComponentType.Transform,
    data: {
      position,
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 }
    }
  }

  const newEntities = { ...scene.entities }
  const entityId = uuidv4()
  newEntities[entityId] = { id: entityId, components: [shapeId, transformId] }

  yield put(provisionScene({ ...scene, components: newComponents, entities: newEntities }))
  yield delay(200) // gotta wait for the webworker to process the updateEditor action
  yield put(selectEntity(entityId))
}

function* handleUpdateTransfrom(action: UpdateTransfromAction) {
  const scene: Scene = yield select(getCurrentScene)
  if (!scene) return

  const { componentId, data } = action.payload

  if (componentId in scene.components) {
    const newComponents: Scene['components'] = { ...scene.components }
    newComponents[componentId] = {
      ...newComponents[componentId],
      data: {
        position: {
          ...data.position
        },
        rotation: {
          ...data.rotation
        },
        scale: {
          ...data.scale
        }
      }
    }

    yield put(provisionScene({ ...scene, components: newComponents }))
  }
}

function* handleResetItem(_: ResetItemAction) {
  const scene: Scene = yield select(getCurrentScene)
  if (!scene) return

  const selectedEntityId: string | null = yield select(getSelectedEntityId)
  if (!selectedEntityId) return

  const components: ReturnType<typeof getEntityComponentByType> = yield select(getEntityComponentByType)
  const transform = components[selectedEntityId][ComponentType.Transform] as ComponentDefinition<ComponentType.Transform>
  if (!transform) return

  const newComponents = {
    ...scene.components,
    [transform.id]: {
      ...transform,
      data: {
        ...transform.data,
        position: snapToGrid(transform.data.position),
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
      }
    }
  }

  yield put(provisionScene({ ...scene, components: newComponents }))
}

function* handleDuplicateItem(_: DuplicateItemAction) {
  const scene: Scene = yield select(getCurrentScene)
  if (!scene) return

  const selectedEntityId: string | null = yield select(getSelectedEntityId)
  if (!selectedEntityId) return

  const newComponents = { ...scene.components }

  const shapes: Record<string, ShapeComponent> = yield select(getEntityShape)
  const shape = shapes[selectedEntityId]

  const components: ReturnType<typeof getEntityComponentByType> = yield select(getEntityComponentByType)
  const transform = components[selectedEntityId][ComponentType.Transform] as ComponentDefinition<ComponentType.Transform>

  if (shape && shape.type === ComponentType.NFTShape) return

  if (!shape || !transform) return

  const {
    data: { position, rotation, scale }
  } = transform

  const transformId = uuidv4()
  newComponents[transformId] = {
    id: transformId,
    type: ComponentType.Transform,
    data: {
      position: { ...position },
      rotation: { ...rotation },
      scale: { ...scale }
    }
  }

  const newEntities = { ...scene.entities }
  const entityId = uuidv4()
  newEntities[entityId] = { id: entityId, components: [shape.id, transformId] }

  yield put(provisionScene({ ...scene, components: newComponents, entities: newEntities }))
  yield delay(200) // gotta wait for the webworker to process the updateEditor action
  yield put(selectEntity(entityId))
}

function* handleDeleteItem(_: DeleteItemAction) {
  const scene: Scene = yield select(getCurrentScene)
  if (!scene) return

  const selectedEntityId: string | null = yield select(getSelectedEntityId)
  if (!selectedEntityId) return

  const entityComponents: Record<string, AnyComponent[]> = yield select(getEntityComponents)
  const idsToDelete = entityComponents[selectedEntityId].filter(component => !!component).map(component => component.id)

  const newComponents = { ...scene.components }
  const newEntities = { ...scene.entities }
  delete newEntities[selectedEntityId]

  for (const componentId of idsToDelete) {
    // check if commponentId is not used by other entities
    if (Object.values(newEntities).some(entity => entity.components.some(id => componentId === id))) {
      continue
    }
    delete newComponents[componentId]
  }

  yield put(deselectEntity())
  yield put(provisionScene({ ...scene, components: newComponents, entities: newEntities }))
}

function* handleSetGround(action: SetGroundAction) {
  const { asset, projectId } = action.payload
  const projects: ReturnType<typeof getProjects> = yield select(getProjects)
  const currentProject = projects[projectId]
  if (!currentProject) return

  const scenes: ReturnType<typeof getScenes> = yield select(getScenes)
  const scene = scenes[currentProject.sceneId]
  if (!scene) return

  const { rows, cols } = currentProject.layout

  if (asset) {
    yield applyGround(scene, rows, cols, asset)
  }
}

function* handleFixAssetMappings(_: FixAssetMappingsAction) {
  const assetPacksRecord: ReturnType<typeof getFullAssetPacks> = yield select(getFullAssetPacks)
  const assetPacks = Object.values(assetPacksRecord)
  const project: Project | null = yield select(getCurrentProject)

  if (!project) return

  // load current scene (if any)
  // const scene: ReturnType<typeof getCurrentScene> = yield select(getCurrentScene)
  const scene: Scene | null = yield getSceneByProjectId(project.id)

  if (!scene) return
  // keep track of the updated components
  const updatedComponents: Record<string, ComponentDefinition<ComponentType.GLTFShape>> = {}

  // generate map of GLTFShape components by source
  const gltfShapes: Record<string, ComponentDefinition<ComponentType.GLTFShape>[]> = {}
  for (const component of Object.values(scene.components)) {
    if (component.type === ComponentType.GLTFShape) {
      const gltfShape = component as ComponentDefinition<ComponentType.GLTFShape>
      if (!gltfShapes[gltfShape.data.src]) {
        gltfShapes[gltfShape.data.src] = []
      }
      gltfShapes[gltfShape.data.src].push(gltfShape)
    }
  }

  // loop over each loaded asset and update the mappings of the components using it
  for (const assetPack of assetPacks) {
    for (const asset of assetPack.assets) {
      if (asset.url in gltfShapes) {
        for (const component of gltfShapes[asset.url]) {
          const mappings = getMappings(asset)
          if (!areEqualMappings(component.data.mappings, mappings)) {
            updatedComponents[component.id] = {
              ...component,
              data: {
                ...component.data,
                mappings
              }
            }
          }
        }
      }
    }
  }

  // if there are any components that need to be updated, provision a new scene
  const hasUpdates = Object.keys(updatedComponents).length > 0
  if (hasUpdates) {
    const newScene = { ...scene, components: { ...scene.components, ...updatedComponents } }
    yield put(setEditorReady(false))
    yield put(createEditorScene(project))
    yield take(SET_EDITOR_READY)
    yield put(provisionScene(newScene))
  }
}

function* handleApplyLayout(action: ApplyLayoutAction) {
  const { project } = action.payload
  const { rows, cols } = project.layout
  const scenes: ReturnType<typeof getScenes> = yield select(getScenes)
  const scene = scenes[project.sceneId]

  if (scene && scene.ground) {
    const groundId = scene.ground.assetId
    const assets: ReturnType<typeof getGroundAssets> = yield select(getGroundAssets)
    const ground = assets[groundId]
    yield applyGround(scene, rows, cols, ground)
  }
}

function* applyGround(scene: Scene, rows: number, cols: number, asset: Asset) {
  let components = { ...scene.components }
  let entities = cloneEntities(scene)
  let gltfId: string = uuidv4()

  if (asset) {
    const gltfs: ReturnType<typeof getGLTFsBySrc> = yield select(getGLTFsBySrc)
    const gltf = gltfs[asset.url]
    const foundId = gltf ? gltfs[asset.url].id : null

    // Create the Shape component if necessary
    if (!foundId) {
      components[gltfId] = {
        id: gltfId,
        type: ComponentType.GLTFShape,
        data: {
          src: asset.url,
          mappings: getMappings(asset)
        }
      }
    } else {
      gltfId = foundId
    }

    if (scene.ground) {
      entities = filterEntitiesWithComponent(scene.ground.componentId, entities)
    }

    for (let j = 0; j < cols; j++) {
      for (let i = 0; i < rows; i++) {
        const entityId = uuidv4()
        const transformId = uuidv4()

        components[transformId] = {
          id: transformId,
          type: ComponentType.Transform,
          data: {
            position: { x: i * PARCEL_SIZE + PARCEL_SIZE / 2, y: 0, z: j * PARCEL_SIZE + PARCEL_SIZE / 2 },
            rotation: { x: 0, y: 0, z: 0, w: 1 },
            scale: { x: 1, y: 1, z: 1 }
          }
        }

        entities[entityId] = { id: entityId, components: [gltfId, transformId], disableGizmos: true }
      }
    }
  } else if (scene.ground) {
    entities = filterEntitiesWithComponent(scene.ground.componentId, entities)
  }

  const ground = asset ? { assetId: asset.id, componentId: gltfId } : null

  // remove unused components
  for (const component of Object.values(components)) {
    if (!Object.values(entities).some(entity => entity.components.some(componentId => componentId === component.id))) {
      delete components[component.id]
    }
  }

  yield put(provisionScene({ ...scene, components, entities, ground }))
}
