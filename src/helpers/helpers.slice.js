import GeometriesSlice from '../../src/geometries/geometries.slice';
import ShadersData     from '../../src/shaders/shaders.data';

let glslify =  require('glslify');

/**
 * @module helpers/slice
 */

export default class HelpersSlice extends THREE.Object3D{
  constructor(stack,
              index = 0,
              position = new THREE.Vector3(0, 0, 0),
              direction = new THREE.Vector3(0, 0, 1),
              aabbSpace = 'IJK') {
    //
    super();

    // private vars
    this._stack = stack;

    // image settings
    // index only used to grab window/level and intercept/slope
    this._invert = this._stack.invert;

    this._lut = 'none';
    this._lutTexture = null;
    // if auto === true, get from index
    // else from stack which holds the default values
    this._intensityAuto = true;
    this._interpolation = 1; // default to trilinear interpolation
    // starts at 0
    this._index = index;
    this._windowWidth = null;
    this._windowCenter = null;
    this._rescaleSlope = null;
    this._rescaleIntercept = null;

    // Object3D settings
    // shape
    this._planePosition = position;
    this._planeDirection = direction;
    // change aaBBSpace changes the box dimensions
    // also changes the transform
    // there is also a switch to move back mesh to LPS space automatically
    this._aaBBspace = aabbSpace; // or LPS -> different transforms, esp for the geometry/mesh
    this._material = null;
    this._uniforms = ShadersData.uniforms();
    this._geometry = null;
    this._mesh = null;
    this._visible = true;

    // update dimensions, center, etc.
    // depending on aaBBSpace
    this._init();

    // update object
    this._create();
  }

  // getters/setters

  get stack() {
    return this._stack;
  }

  set stack(stack) {
    this._stack = stack;
  }

  get windowWidth() {
    return this._windowWidth;
  }

  set windowWidth(windowWidth) {
    this._windowWidth = windowWidth;
    this.updateIntensitySettingsUniforms();
  }

  get windowCenter() {
    return this._windowCenter;
  }

  set windowCenter(windowCenter) {
    this._windowCenter = windowCenter;
    this.updateIntensitySettingsUniforms();
  }

  get rescaleSlope() {
    return this._rescaleSlope;
  }

  set rescaleSlope(rescaleSlope) {
    this._rescaleSlope = rescaleSlope;
    this.updateIntensitySettingsUniforms();
  }

  get rescaleIntercept() {
    return this._rescaleIntercept;
  }

  set rescaleIntercept(rescaleIntercept) {
    this._rescaleIntercept = rescaleIntercept;
    this.updateIntensitySettingsUniforms();
  }

  get invert() {
    return this._invert;
  }

  set invert(invert) {
    this._invert = invert;
    this.updateIntensitySettingsUniforms();
  }

  get lut() {
    return this._lut;
  }

  set lut(lut) {
    this._lut = lut;
  }

  get lutTexture() {
    return this._lutTexture;
  }

  set lutTexture(lutTexture) {
    this._lutTexture = lutTexture;
    this.updateIntensitySettingsUniforms();
  }

  get intensityAuto() {
    return this._intensityAuto;
  }

  set intensityAuto(intensityAuto) {
    this._intensityAuto = intensityAuto;
    this.updateIntensitySettings();
    this.updateIntensitySettingsUniforms();
  }

  get interpolation() {
    return this._interpolation;
  }

  set interpolation(interpolation) {
    this._interpolation = interpolation;
    this.updateIntensitySettingsUniforms();
  }

  get index() {
    return this._index;
  }

  set index(index) {
    this._index = index;
    this._update();
  }

  set planePosition(position) {
    this._planePosition = position;
    this._update();
  }

  get planePosition() {
    return this._planePosition;
  }

  set planeDirection(direction) {
    this._planeDirection = direction;
    this._update();
  }

  get planeDirection() {
    return this._planeDirection;
  }

  set halfDimensions(halfDimensions) {
    this._halfDimensions = halfDimensions;
  }

  get halfDimensions() {
    return this._halfDimensions;
  }

  set center(center) {
    this._center = center;
  }

  get center() {
    return this._center;
  }

  set aabbSpace(aabbSpace) {
    this._aaBBspace = aabbSpace;
    this._init();
  }

  get aabbSpace() {
    return this._aaBBspace;
  }

  set mesh(mesh) {
    this._mesh = mesh;
  }

  get mesh() {
    return this._mesh;
  }

  set geometry(geometry) {
    this._geometry = geometry;
  }

  get geometry() {
    return this._geometry;
  }

  _init() {
    if (!this._stack || !this._stack._prepared || !this._stack._packed) {
      return;
    }

    if (this._aaBBspace === 'IJK') {
      this._halfDimensions = this._stack.halfDimensionsIJK;
      this._center = new THREE.Vector3(
        this._stack.halfDimensionsIJK.x - 0.5,
        this._stack.halfDimensionsIJK.y - 0.5,
        this._stack.halfDimensionsIJK.z - 0.5);
      this._toAABB = new THREE.Matrix4();
    } else {
      // LPS
      let aaBBox  = this._stack.AABBox();
      this._halfDimensions = aaBBox.clone().multiplyScalar(0.5);
      this._center = this._stack.centerAABBox();
      this._toAABB = this._stack.lps2AABB;
    }
  }

  // private methods
  _create() {

    if (!this._stack || !this._stack.prepared || !this._stack.packed) {
      return;
    }

    // Convenience vars
    try {
      this._geometry = new GeometriesSlice(
        this._halfDimensions,
        this._center,
        this._planePosition,
        this._planeDirection,
        this._toAABB);
    }
    catch (e) {
      window.console.log(e);
      window.console.log('invalid slice geometry - exiting...');
      return;
    }

    if (!this._geometry.vertices) {
      return;
    }

    if (!this._material) {
      //
      this._uniforms.uTextureSize.value = this._stack.textureSize;
      this._uniforms.uDataDimensions.value =
        [this._stack.dimensionsIJK.x,
         this._stack.dimensionsIJK.y,
         this._stack.dimensionsIJK.z];
      this._uniforms.uWorldToData.value = this._stack.lps2IJK;
      this._uniforms.uNumberOfChannels.value = this._stack.numberOfChannels;
      this._uniforms.uPixelType.value = this._stack.pixelType;
      this._uniforms.uBitsAllocated.value = this._stack.bitsAllocated;
      this._uniforms.uPackedPerPixel.value = this._stack.packedPerPixel;

      // compute texture if material exist
      let textures = [];
      // replace 7 by a letiable!!!!
      for (let m = 0; m < this._stack.rawData.length; m++) {
        let tex = new THREE.DataTexture(
          this._stack.rawData[m],
          this._stack.textureSize, this._stack.textureSize,
          this._stack.textureType, THREE.UnsignedByteType,
          THREE.UVMapping,
          THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping,
          THREE.NearestFilter, THREE.NearestFilter);
        tex.needsUpdate = true;
        tex.flipY = true;
        textures.push(tex);
      }

      this._uniforms.uTextureContainer.value = textures;

      this._material = new THREE.ShaderMaterial({
        'side': THREE.DoubleSide,
        'uniforms': this._uniforms,
        'vertexShader': glslify('../shaders/shaders.data.vert'),
        'fragmentShader': glslify('../shaders/shaders.data.frag')
      });
    }

    // update intensity related stuff
    this.updateIntensitySettings();
    this.updateIntensitySettingsUniforms();

    // create the mesh!
    this._mesh = new THREE.Mesh(this._geometry, this._material);
    if (this._aaBBspace === 'IJK') {
      this._mesh.applyMatrix(this._stack.ijk2LPS);
    }

    this._mesh.visible = this._visible;

    // and add it!
    this.add(this._mesh);
  }

  updateIntensitySettings() {
    // if auto, get from frame index
    if (this._intensityAuto) {
      this.updateIntensitySetting('windowCenter');
      this.updateIntensitySetting('windowWidth');
      this.updateIntensitySetting('rescaleSlope');
      this.updateIntensitySetting('rescaleIntercept');
    } else {
      if (this._windowCenter === null) {
        this._windowCenter = this._stack.windowCenter;
      }

      if (this.__windowWidth === null) {
        this._windowWidth = this._stack.windowWidth;
      }

      if (this._rescaleSlope === null) {
        this._rescaleSlope = this._stack.rescaleSlope;
      }

      if (this._rescaleIntercept === null) {
        this._rescaleIntercept = this._stack.rescaleIntercept;
      }
    }

  }

  updateIntensitySettingsUniforms() {
    // set slice window center and width
    this._uniforms.uRescaleSlopeIntercept.value = [this._rescaleSlope, this._rescaleIntercept];
    this._uniforms.uWindowCenterWidth.value = [this._windowCenter, this._windowWidth];

    // invert
    this._uniforms.uInvert.value = this._invert === true ? 1 : 0;

    // interpolation
    this._uniforms.uInterpolation.value = this._interpolation;

    // lut
    if (this._lut === 'none') {
      this._uniforms.uLut.value = 0;
    } else {
      this._uniforms.uLut.value = 1;
      this._uniforms.uTextureLUT.value = this._lutTexture;
    }
  }

  updateIntensitySetting(setting) {
    if (this._stack.frame[this._index] &&
        this._stack.frame[this._index][setting]) {
      this['_' + setting] = this._stack.frame[this._index][setting];
    } else {
      this['_' + setting] = this._stack[setting];
    }
  }

  _update() {
    // update slice
    if (this._mesh) {
      this.remove(this._mesh);
      this._mesh.geometry.dispose();
      this._mesh.geometry = null;
      // we do not want to dispose the texture!
      // this._mesh.material.dispose();
      // this._mesh.material = null;
      this._mesh = null;
    }

    this._create();
  }
}
