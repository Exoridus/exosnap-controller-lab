import {BufferGeometry,Float32BufferAttribute} from 'three';
export class LineSegmentsGeometry extends BufferGeometry {setPositions(array){this.setAttribute('position',new Float32BufferAttribute(Array.from(array),3));return this;}}
