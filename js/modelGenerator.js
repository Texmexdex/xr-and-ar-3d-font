import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';

/**
 * Model Generator
 * Converts SVG path data into 3D models using Three.js
 */
class ModelGenerator {
    constructor() {
        this.svgLoader = new SVGLoader();
    }

    /**
     * Generate a 3D model from SVG path data
     * @param {Object} pathData - Object containing paths and bounds information
     * @param {Object} options - Options for 3D model generation
     * @returns {THREE.Group} - Three.js group containing the 3D model
     */
    generateModelFromPaths(pathData, options = {}) {
        // Default options
        const defaults = {
            extrusionDepth: 20,
            dynamicDepth: false,
            bevelEnabled: true,
            bevelThickness: 1,
            bevelSize: 0.5,
            bevelSegments: 3,
            frontColor: '#ffffff',
            sideColor: '#000000'
        };
        
        // Merge provided options with defaults
        const settings = { ...defaults, ...options };
        
        // Create a new group to hold all the meshes
        const group = new THREE.Group();
        
        // Calculate dynamic depth if enabled
        let depth = settings.extrusionDepth;
        if (settings.dynamicDepth && pathData.bounds) {
            const height = pathData.bounds.y2 - pathData.bounds.y1;
            depth = height / 4; // Use 1/4 of the design height
        }
        
        // Process each path
        pathData.paths.forEach(pathInfo => {
            try {
                // Parse SVG path string
                const paths = this.svgLoader.parse(`<svg><path d="${pathInfo.path}"/></svg>`).paths;
                
                // Process each path shape
                paths.forEach(path => {
                    const shapes = SVGLoader.createShapes(path);
                    
                    // Create a mesh for each shape
                    shapes.forEach(shape => {
                        // Extrusion settings
                        const extrudeSettings = {
                            depth: depth,
                            bevelEnabled: settings.bevelEnabled,
                            bevelThickness: settings.bevelThickness,
                            bevelSize: settings.bevelSize,
                            bevelSegments: settings.bevelSegments
                        };
                        
                        // Create geometry
                        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                        
                        // Create materials
                        const materials = [
                            // First material (index 0) is for front faces - now glossy
                            new THREE.MeshPhongMaterial({ 
                                color: settings.frontColor,
                                specular: 0x888888,
                                shininess: 80,
                                reflectivity: 0.8
                            }),
                            // Second material (index 1) for side faces - more intense metallic look
                            new THREE.MeshPhongMaterial({ 
                                color: settings.sideColor,
                                specular: 0x999999,
                                shininess: 120,
                                reflectivity: 1.0
                            })
                        ];
                        
                        // Create mesh with front and side materials
                        const mesh = new THREE.Mesh(geometry, materials);
                        
                        // Add the mesh to the group
                        group.add(mesh);
                    });
                });
            } catch (error) {
                console.error('Error creating 3D model from path:', error);
            }
        });
        
        // Center the model based on the bounding box
        if (group.children.length > 0) {
            this.centerModel(group);
        }
        
        return group;
    }

    /**
     * Center the model based on its bounding box
     * @param {THREE.Group} group - The group containing the model
     */
    centerModel(group) {
        // Create a bounding box for the group
        const bbox = new THREE.Box3().setFromObject(group);
        
        // Calculate the center of the bounding box
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        
        // Move the group to center it at origin
        group.position.sub(center);
        
        // Flip the model to display correctly (SVG Y-axis is inverted in Three.js)
        group.scale.set(1, -1, 1);
    }

    /**
     * Convert a Three.js model to STL format
     * @param {THREE.Object3D} model - The 3D model to convert
     * @returns {Blob} - STL file as a Blob
     */
    convertToSTL(model) {
        if (!model) return null;
        
        // Create an STL exporter
        const exporter = new STLExporter();
        
        // Convert the model to STL (binary format)
        const stl = exporter.parse(model, { binary: true });
        
        // Create a blob from the STL data
        return new Blob([stl], { type: 'application/octet-stream' });
    }
}

// Export the class as default
export default ModelGenerator;