// The game systems are written against a global THREE (as in the original no-build version). Expose the npm build,
// plus the loaders the asset pipeline needs, on window before any system module runs.
import * as THREE_NS from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
window.THREE = Object.assign({}, THREE_NS, { GLTFLoader, RGBELoader, BufferGeometryUtils, SimplifyModifier, RoomEnvironment });
