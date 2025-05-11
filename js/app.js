/**
 * Main Application
 * Initializes and coordinates the components of the 3D Sign Creator
 */

// Ensure THREE is imported if you're using modules consistently
// import * as THREE from 'three'; 

// These AR variables should be at the top level of your app.js
let arSession = null;
let arController = null;
let arReticle = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let modelToPlaceAR = null;
let currentPreviewRenderer = null; // Will be set in DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {
    // Initialize components
    const fontManager = new FontManager();
    const svgProcessor = new SvgProcessor();
    const modelGenerator = new ModelGenerator();
    const previewRenderer = new PreviewRenderer('preview-container');
    const exportManager = new ExportManager(svgProcessor, modelGenerator);

    currentPreviewRenderer = previewRenderer; // Store for global AR functions
    if (currentPreviewRenderer && currentPreviewRenderer.renderer) {
        // It's generally good practice to enable XR on the renderer early.
        // The actual session management will handle starting/stopping.
        currentPreviewRenderer.renderer.xr.enabled = true; 
        console.log("Three.js WebXR enabled on renderer.");
    } else {
        console.error("PreviewRenderer or its renderer is not initialized at DOMContentLoaded!");
    }
    
    // Global variables to store current state
    window.currentPathData = null;
    window.currentModel = null;
    window.designMode = 'text'; // 'text' or 'svg'
    
    // Input elements
    const textInput = document.getElementById('text-input');
    const letterSpacingInput = document.getElementById('letter-spacing');
    const letterSpacingValue = document.getElementById('letter-spacing-value');
    const extrusionDepthInput = document.getElementById('extrusion-depth');
    const extrusionDepthValue = document.getElementById('extrusion-depth-value');
    const dynamicDepthInput = document.getElementById('dynamic-depth');
    const bevelEnabledInput = document.getElementById('bevel-enabled');
    const frontColorInput = document.getElementById('front-color');
    const sideColorInput = document.getElementById('side-color'); // Still exists, though hidden
    const updatePreviewButton = document.getElementById('update-preview');
    const svgUploadInput = document.getElementById('svg-upload');

    // AR UI Elements
    const arContainerWrapper = document.getElementById('ar-container-wrapper');
    const arUiContainer = document.getElementById('ui-container');
    const arInfoMessage = document.getElementById('info-message');
    const viewInARButton = document.getElementById('view-in-ar-button');
    const arExitButton = document.getElementById('ar-exit-button');
    
    // Set default colors
    frontColorInput.value = "#ffffff"; 
    
    if (previewRenderer) {
        previewRenderer.frontColor = frontColorInput.value;
    }
    
    const sideColorGroup = sideColorInput.closest('.input-group');
    if (sideColorGroup) {
        sideColorGroup.style.display = 'none';
    }
    
    const themeToggle = document.createElement('button');
    themeToggle.className = 'btn';
    themeToggle.innerHTML = '<i class="ri-sun-line"></i> Toggle Light Mode';
    themeToggle.style.marginTop = '20px';
    const exportOptionsDiv = document.querySelector('.export-options');
    if (exportOptionsDiv) {
        exportOptionsDiv.after(themeToggle);
    }
    
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        // Assuming you have a default dark-mode or will add it
        if (!document.body.classList.contains('light-mode')) {
            document.body.classList.add('dark-mode'); 
        } else {
            document.body.classList.remove('dark-mode');
        }
    });
    
    const colorPickerContainers = document.querySelectorAll('.color-picker-container');
    colorPickerContainers.forEach(container => {
        const colorInput = container.querySelector('input[type="color"]');
        const colorValue = container.querySelector('.color-value');
        if (colorInput && colorValue) {
            colorValue.textContent = colorInput.value;
            colorInput.addEventListener('input', () => {
                colorValue.textContent = colorInput.value;
            });
        }
    });
    
    if (svgUploadInput) {
        const fileUploadLabel = document.querySelector('.file-upload-label');
        svgUploadInput.addEventListener('change', function() {
            if (this.files.length > 0) {
                const fileName = this.files[0].name;
                if(fileUploadLabel) fileUploadLabel.innerHTML = `<i class="ri-file-line"></i><span>${fileName}</span>`;
            } else {
                if(fileUploadLabel) fileUploadLabel.innerHTML = `<i class="ri-upload-cloud-line"></i><span>Choose a file or drag it here</span>`;
            }
        });
    }
    
    extrusionDepthInput.addEventListener('input', () => {
        extrusionDepthValue.textContent = `${extrusionDepthInput.value}mm`;
    });
    
    letterSpacingInput.addEventListener('input', () => {
        letterSpacingValue.textContent = `${letterSpacingInput.value}px`;
    });
    
    document.addEventListener('fontChanged', () => {
        window.designMode = 'text';
        updatePreview();
    });
    
    document.addEventListener('svgUploaded', (event) => {
        window.designMode = 'svg';
        window.currentPathData = event.detail;
        updatePreview();
    });
    
    frontColorInput.addEventListener('input', updateModelColors);
    updatePreviewButton.addEventListener('click', updatePreview);
    
    document.getElementById('download-svg').addEventListener('click', () => {
        exportManager.handleSvgExport(); 
    });
    
    document.getElementById('download-stl').addEventListener('click', () => {
        exportManager.handleStlExport();
    });

    if (viewInARButton) viewInARButton.addEventListener('click', startAR);
    if (arExitButton) arExitButton.addEventListener('click', endARSession);

    function updatePreview() {
        document.getElementById('loading-indicator').classList.remove('hidden');
        try {
            if (window.designMode === 'text') {
                const text = textInput.value || 'Hello';
                const letterSpacing = parseFloat(letterSpacingInput.value);
                window.currentPathData = fontManager.generateTextPath(text, 72, letterSpacing);
            }
            if (!window.currentPathData || !window.currentPathData.paths || window.currentPathData.paths.length === 0) {
                throw new Error('No valid path data to generate model.');
            }
            const settings = get3DSettings();
            window.currentModel = modelGenerator.generateModelFromPaths(window.currentPathData, settings);
            previewRenderer.updateModel(window.currentModel); // This updates the model in the 2D/3D preview
            document.getElementById('loading-indicator').classList.add('hidden');
        } catch (error) {
            console.error('Error updating preview:', error);
            document.getElementById('loading-indicator').classList.add('hidden');
            const errorMsgEl = document.getElementById('error-message');
            if (errorMsgEl) {
                errorMsgEl.classList.remove('hidden');
                setTimeout(() => {
                    errorMsgEl.classList.add('hidden');
                }, 3000);
            }
        }
    }
    
    function updateModelColors() {
        const colorSettings = {
            frontColor: frontColorInput.value,
            sideColor: '#000000' 
        };
        previewRenderer.updateModelColors(colorSettings);
    }
    
    function get3DSettings() {
        // Ensure outlineColor and outlineThickness are defined if used by modelGenerator
        // These were virtual in a previous version of app.js
        const outlineColor = '#000000'; // Example default
        const outlineThickness = 0; // Example default, or get from UI if re-added
        return {
            extrusionDepth: parseFloat(extrusionDepthInput.value),
            dynamicDepth: dynamicDepthInput.checked,
            bevelEnabled: bevelEnabledInput.checked,
            bevelThickness: 1,
            bevelSize: 0.5,
            bevelSegments: 3,
            frontColor: frontColorInput.value,
            sideColor: '#000000',
            outlineColor: outlineColor, 
            outlineThickness: outlineThickness,
            letterSpacing: parseFloat(letterSpacingInput.value)
        };
    }
    
    setTimeout(() => {
        updatePreview();
    }, 1000);
});


// --- AR Core Functions ---

function prepareModelForAR() {
    if (!window.currentModel) {
        console.error("No current model to prepare for AR.");
        if(arInfoMessage) {
            arInfoMessage.textContent = "Please generate a design first.";
            arInfoMessage.style.display = 'block';
        }
        return false;
    }
    console.log("Preparing model for AR. Original model:", window.currentModel);
    modelToPlaceAR = window.currentModel.clone();

    const box = new THREE.Box3().setFromObject(modelToPlaceAR);
    const center = new THREE.Vector3();
    box.getCenter(center);
    modelToPlaceAR.position.sub(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const desiredSize = 0.3; // 30cm

    if (maxDim > 0) {
        const scale = desiredSize / maxDim;
        modelToPlaceAR.scale.set(scale, scale, scale);
    } else {
        modelToPlaceAR.scale.set(1, 1, 1);
    }
    console.log("Model prepared for AR:", modelToPlaceAR);
    return true;
}

async function startAR() {
    console.log("AR Button clicked - starting AR experience");
    if (!currentPreviewRenderer || !currentPreviewRenderer.renderer) {
        console.error("PreviewRenderer not ready for AR.");
        return;
    }
    if (!currentPreviewRenderer.renderer.xr.enabled) {
        console.warn("WebXR not enabled on renderer. Enabling now."); // Should have been enabled at init
        currentPreviewRenderer.renderer.xr.enabled = true;
    }

    if (!prepareModelForAR()) {
        return;
    }

    if (navigator.xr) {
        console.log("navigator.xr exists. AR potentially supported.");
        try {
            const sessionSupported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!sessionSupported) {
                console.warn("immersive-ar session is not supported by this device/browser.");
                if(arInfoMessage) {
                    arInfoMessage.textContent = "AR is not supported on this device/browser.";
                    arInfoMessage.style.display = 'block';
                    setTimeout(() => { arInfoMessage.style.display = 'none'; }, 5000);
                }
                return;
            }
            console.log("immersive-ar session IS supported.");

            const sessionOptions = {
                requiredFeatures: ['hit-test', 'dom-overlay'],
                optionalFeatures: ['local-floor', 'viewer', 'bounded-floor'], // Added bounded-floor
                domOverlay: { root: document.getElementById('ar-container-wrapper') } // Corrected root
            };
            console.log("Requesting AR session with options:", sessionOptions);
            const session = await navigator.xr.requestSession('immersive-ar', sessionOptions);
            console.log("AR Session created successfully:", session);
            onSessionStartedAR(session);
        } catch (e) {
            console.error("Failed to start AR session:", e);
            if(arInfoMessage) {
                arInfoMessage.textContent = "Failed to start AR: " + e.message;
                arInfoMessage.style.display = 'block';
                setTimeout(() => { arInfoMessage.style.display = 'none'; }, 7000);
            }
        }
    } else {
        console.warn("navigator.xr does not exist. WebXR not supported.");
        if(arInfoMessage) {
            arInfoMessage.textContent = "WebXR API not found in this browser.";
            arInfoMessage.style.display = 'block';
            setTimeout(() => { arInfoMessage.style.display = 'none'; }, 5000);
        }
    }
}

function onSessionStartedAR(session) {
    arSession = session;
    arSession.addEventListener('end', onSessionEndedAR);

    currentPreviewRenderer.renderer.xr.setSession(arSession)
        .then(() => {
            console.log("Successfully set XR session on renderer's WebXRManager.");

            let referenceSpaceSet = false;
            try {
                currentPreviewRenderer.renderer.xr.setReferenceSpaceType('local-floor');
                console.log("WebXRManager successfully set reference space type to 'local-floor'");
                referenceSpaceSet = true;
            } catch (e) {
                console.warn("Failed to set reference space type to 'local-floor', trying 'local':", e);
                try {
                    currentPreviewRenderer.renderer.xr.setReferenceSpaceType('local');
                    console.log("WebXRManager successfully set reference space type to 'local'");
                    referenceSpaceSet = true;
                } catch (e2) {
                    console.warn("Failed to set reference space type to 'local', trying 'viewer':", e2);
                    try {
                        currentPreviewRenderer.renderer.xr.setReferenceSpaceType('viewer');
                        console.log("WebXRManager successfully set reference space type to 'viewer'");
                        referenceSpaceSet = true;
                    } catch (e3) {
                        console.error("Failed to set any default reference space type for WebXRManager:", e3);
                        if(arInfoMessage) {
                            arInfoMessage.textContent = "AR Error: Device doesn't support required spatial tracking features.";
                            arInfoMessage.style.display = 'block';
                        }
                        if (arSession) arSession.end().catch(err => console.error("Error ending session after ref space fail:", err));
                        return; 
                    }
                }
            }

            if (!referenceSpaceSet) {
                console.error("No reference space could be set. AR will likely not function correctly.");
                // Potentially end session or show error.
            }

            // UI Updates
            const arContainerWrapper = document.getElementById('ar-container-wrapper');
            if(arContainerWrapper) arContainerWrapper.style.display = 'block';
            const mainAppContainer = document.querySelector('.container');
            if(mainAppContainer) mainAppContainer.style.display = 'none';
            if(arExitButton) arExitButton.style.display = 'block';
            if(arInfoMessage) {
                arInfoMessage.textContent = "Move phone to find a surface. Tap to place.";
                arInfoMessage.style.display = 'block';
            }

            if (currentPreviewRenderer && typeof currentPreviewRenderer.hideCustomBackground === 'function') {
                currentPreviewRenderer.hideCustomBackground();
            }

            currentPreviewRenderer.pauseAnimation();

            if (!arReticle) {
                arReticle = new THREE.Mesh(
                    new THREE.RingGeometry(0.05, 0.07, 32).rotateX(-Math.PI / 2),
                    new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.7, transparent: true })
                );
                arReticle.matrixAutoUpdate = false;
                currentPreviewRenderer.scene.add(arReticle);
            }
            arReticle.visible = false; 
            
            if (arController && arController.parent) {
                arController.parent.remove(arController); 
                arController.removeEventListener('select', onSelectAR);
            }
            arController = currentPreviewRenderer.renderer.xr.getController(0);
            arController.addEventListener('select', onSelectAR);
            currentPreviewRenderer.scene.add(arController);

            hitTestSourceRequested = false;
            hitTestSource = null;

            currentPreviewRenderer.renderer.setAnimationLoop(renderXRSession);
            console.log("AR Session Started and configured");

        })
        .catch(err => { 
            console.error("Error from renderer.xr.setSession() or subsequent setup:", err);
            if(arInfoMessage) {
                arInfoMessage.textContent = "AR initialization failed: " + err.message;
                arInfoMessage.style.display = 'block';
            }
            if (arSession) {
                if (arSession.visibilityState === 'visible' && !arSession.ended) { // Check if session is active
                     arSession.end().catch(e => console.error("Error ending session after setSession fail:", e));
                } else if (arSession.ended === false) { // Handle cases where it might be 'ending' but not fully 'ended'
                    console.log("Session was not 'visible' but also not 'ended', attempting to end.");
                    arSession.end().catch(e => console.error("Error ending non-visible session:", e));
                }
            }
        });
}

function onSelectAR() {
    if (arReticle && arReticle.visible && modelToPlaceAR) {
        const newSignAR = modelToPlaceAR.clone();
        newSignAR.position.setFromMatrixPosition(arReticle.matrix);
        newSignAR.visible = true;
        newSignAR.userData.isARPlacedObject = true;
        currentPreviewRenderer.scene.add(newSignAR);
        console.log("AR Sign placed at:", newSignAR.position);
    }
}

function renderXRSession(timestamp, frame) {
    if (!frame || !arSession || !currentPreviewRenderer || !currentPreviewRenderer.renderer.xr.isPresenting) {
        return;
    }
    
    const referenceSpace = currentPreviewRenderer.renderer.xr.getReferenceSpace();
    if (!referenceSpace) {
        return;
    }

    if (!hitTestSourceRequested) {
        arSession.requestReferenceSpace('viewer').then((viewerSpace) => {
            if (viewerSpace) {
                arSession.requestHitTestSource({ space: viewerSpace })
                .then((source) => {
                    hitTestSource = source;
                    console.log("Hit test source obtained.");
                })
                .catch(err => {
                    console.error("Could not get hit test source:", err);
                    hitTestSourceRequested = false; 
                });
            } else {
                console.error("Viewer reference space is null for hit-test source request.");
                hitTestSourceRequested = false;
            }
        }).catch(err => {
            console.error("Could not get viewer reference space for hit test:", err);
            hitTestSourceRequested = false;
        });
        hitTestSourceRequested = true; 
    }

    if (hitTestSource && arReticle) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const hitPose = hit.getPose(referenceSpace); 
            if (hitPose) {
                arReticle.visible = true;
                arReticle.matrix.fromArray(hitPose.transform.matrix);
            } else {
                arReticle.visible = false;
            }
        } else {
            arReticle.visible = false;
        }
    }
}

function endARSession() {
    if (arSession) {
        arSession.end().catch(e => console.error("Error during arSession.end():", e));
    }
}

function onSessionEndedAR() {
    console.log("onSessionEndedAR called");
    if (arController) {
        arController.removeEventListener('select', onSelectAR);
        if (arController.parent) { 
            arController.parent.remove(arController);
        }
        arController = null;
    }
    if (arReticle) {
        arReticle.visible = false;
    }

    const objectsToRemove = [];
    currentPreviewRenderer.scene.traverse(child => {
        if (child.userData.isARPlacedObject) {
            objectsToRemove.push(child);
        }
    });
    objectsToRemove.forEach(obj => {
        if (obj.parent) {
            obj.parent.remove(obj);
        }
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(mat => mat.dispose());
            } else if (obj.material.dispose) { // Check if material has dispose method
                obj.material.dispose();
            }
        }
    });

    hitTestSourceRequested = false;
    hitTestSource = null;

    if (currentPreviewRenderer && currentPreviewRenderer.renderer.xr.isPresenting) {
         // It's good practice to await this promise or handle its potential rejection
        currentPreviewRenderer.renderer.xr.setSession(null)
            .then(() => console.log("XR session set to null on renderer."))
            .catch(e => console.error("Error setting XR session to null on end:", e));
    }
   
    currentPreviewRenderer.renderer.setAnimationLoop(null);

    const arContainerWrapper = document.getElementById('ar-container-wrapper');
    if(arContainerWrapper) arContainerWrapper.style.display = 'none';
    const mainAppContainer = document.querySelector('.container');
    if(mainAppContainer) mainAppContainer.style.display = 'block';
    const arExitButton = document.getElementById('ar-exit-button');
    if(arExitButton) arExitButton.style.display = 'none';
    const arInfoMessage = document.getElementById('info-message');
    if(arInfoMessage) arInfoMessage.style.display = 'none';

    if (currentPreviewRenderer && typeof currentPreviewRenderer.showCustomBackground === 'function') {
        currentPreviewRenderer.showCustomBackground();
    }
    currentPreviewRenderer.resumeAnimation();
    
    arSession = null; 
    console.log("AR Session Ended and cleaned up.");
}
