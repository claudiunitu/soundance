// @ts-check


import './components/range-slider.component.js';
import './components/sample-toggler.component.js';

/**
 * @typedef {Object} SampleStitchingMethods
 * @property {string} JOIN_WITH_CROSSFADE When processed by the sound exporter fading will be applied to the looped samples
 * @property {string} JOIN_WITH_OVERLAY When processed by the sound exporter the loops will be overlaid but no fading will be applied to the looped samples. The samples files need to already be faded on both ends
 */

/**
 * @typedef {keyof SampleStitchingMethods} SampleStitchingMethod
 */

/** @type {SampleStitchingMethods} */
const SampleStitchingMethods = {
    JOIN_WITH_CROSSFADE: 'JOIN_WITH_CROSSFADE',
    JOIN_WITH_OVERLAY: 'JOIN_WITH_OVERLAY'
};

/**
 * @typedef {Object} SubsceneWindowsConfig
 * 
 * @property {number} currentVol 
 * @property {number} minVol 
 * @property {number} maxVol 
 * @property {number} minTimeframeLength 
 * @property {number} maxTimeframeLength 
 */

/**
 * @typedef {Object} SubsceneWindow
 * 
 * @property {number} startAt At which point (in milliseconds) the config should start when the final sound will be processed
 * @property {SubsceneWindowsConfig[]} config Subscene window config
 */

/**
 * @typedef {Object} SubsceneConfig
 * 
 * @property {string} label Subscene name
 * @property {SubsceneWindow[]} subsceneWindows Sequential config that to describe what happens at different time intervals
 */

/**
 * @typedef {Object} SoundSampleConfig
 * 
 * @property {number} concatOverlayMs How much to overlap when looping sound sample
 * @property {string} label Sound samples name
 * @property {SampleStitchingMethod} stitchingMethd Sound sample stitching method when looping
 * @property {string[]} variationNames Sound sample variations file paths
 */

/**
 * @typedef {Object} SoundSceneConfig
 * 
 * @property {string} directory Directory path for the sound files
 * @property {SoundSampleConfig[]} samples Sound samples config
 * @property {string} sceneName Sound samples config
 * @property {SubsceneConfig[]} subscenes Subscene config
 */

/** 
 * @type {SoundSceneConfig[]} will be populated with config.json data
 * */
let localConfigData;

let sceneSamplesAudioData = [];


/**
 * @type {AudioContext}
 */
let audioContext = new window.AudioContext();

/**
 * @type {boolean}
 */
let isStarted = true; // Flag to prevent re-initialization

/**
 * @type {{exportJsonButton: HTMLElement | null}}
 */
const ctas = {
    exportJsonButton: document.getElementById('generateJsonButton'),
}

/**
 * @returns {void}
 */
function onLoadingStarted() {
    for (let ctaKey in ctas) {
        ctas[ctaKey].setAttribute("disabled", "disabled");
    }
}

/**
 * @returns {void}
 */
function onLoadingFinished() {
    for (let ctaKey in ctas) {
        ctas[ctaKey].removeAttribute("disabled");
    }
}


/**
 * @returns {Promise<SoundSceneConfig[]>}
 */
async function loadConfig() {
    onLoadingStarted();
    const config = await loadJson(`/config.json`).catch(e => { throw e });
    onLoadingFinished();
    return config;
}

/**
 * 
 * @param {SoundSceneConfig[]} scenes 
 * @param {number} _selectedSceneIndex 
 * @param {number} _selectedSubsceneIndex 
 * @param {number} _selectedSubsceneWindowIndex 
 * @returns {Promise<void>}
 */
async function initScene(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {
    await loadAndParseNewSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);
}


/**
 * 
 * @param {SoundSceneConfig[]} scenes 
 * @param {number} _selectedSceneIndex 
 * @param {number} _selectedSubsceneIndex 
 * @param {number} _selectedSubsceneWindowIndex 
 * @returns {Promise<HTMLDivElement[]>} The HTML element containing the groupped sample controlers for one scene
 */
async function loadAndParseDataForSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {

    const groupHTMLParent = document.createElement('div');
    const slidersContainer = [];
    const sceneObject = scenes[_selectedSceneIndex];
    for (let i = 0; i < sceneObject.samples.length; i++) {

        /**
         * @typedef {Object} SampleVariationAudioData
         * 
         * @property {string} variationFilePath 
         * @property {AudioBuffer | null} audioBuffer 
         * @property {boolean} isAudioBufferLoading 
         * @property {GainNode} gainNode 
         */
        /**
         * @type {SampleVariationAudioData[]}
         */
        const sampleVariationsAudioData = [];


        const sampleSubsceneConfigParams = sceneObject.subscenes.map(scene => {
            return {
                label: scene.label,
                params: !scene.subsceneWindows[_selectedSubsceneWindowIndex] ? null : scene.subsceneWindows[_selectedSubsceneWindowIndex].config[i],
            }
        });

        const currentSubsceneParams = sampleSubsceneConfigParams[_selectedSubsceneIndex].params;

        let currentSceneSampleVol = 0;
        if (typeof currentSubsceneParams?.currentVol === "number") {
            currentSceneSampleVol = currentSubsceneParams.currentVol;
        } else if (typeof currentSubsceneParams?.minVol === "number" && typeof currentSubsceneParams.maxVol === "number") {
            currentSceneSampleVol = Math.floor((currentSubsceneParams.minVol + currentSubsceneParams.maxVol) / 2);
        }


        for (let j = 0; j < sceneObject.samples[i].variationNames.length; j++) {
            const variationFilePath = `${sceneObject.samples[i].variationNames[j]}`;
            const audioBuffer = null;
            const gainNode = audioContext.createGain();
            gainNode.gain.setValueAtTime(currentSceneSampleVol, audioContext.currentTime);

            sampleVariationsAudioData.push({
                variationFilePath,
                audioBuffer,
                isAudioBufferLoading: false,
                gainNode,
            });

        }

        const stitchingMethd = sceneObject.samples[i].stitchingMethd;
        const concatOverlayMs = sceneObject.samples[i].concatOverlayMs;

        const sampleContainer = document.createElement('div');
        sampleContainer.classList.add("sample")
        groupHTMLParent.appendChild(sampleContainer);
        slidersContainer.push(groupHTMLParent);

        // add label to controls group
        const labelElement = document.createElement('label');
        labelElement.classList.add('sample-fields-groul-label');
        labelElement.innerText = `${sceneObject.sceneName} - ${sceneObject.samples[i].label}`;
        sampleContainer.appendChild(labelElement);


        const forCurrentSampleIndex = sceneSamplesAudioData.length;

        // setup sample toggler
        /**
         * @type {SampleTogglerHTMLElement}
         */
        const sampleTogglerElement = /** @type {SampleTogglerHTMLElement} */ (document.createElement('sample-toggler'));
        sampleTogglerElement.addEventListener('toggle', async (event) => {
            /** @type {SampleTogglerHTMLElement} */
            const target = /** @type {SampleTogglerHTMLElement} */ (event.target);
            if (target.state === true) {
                let wasLoadedAndNotPlayed = false;
                for (let k = 0; k < sampleVariationsAudioData.length; k++) {
                    const sampleVariationAudioData = sampleVariationsAudioData[k];
                    if (sampleVariationAudioData.audioBuffer === null && sampleVariationAudioData.isAudioBufferLoading === false) {
                        sampleVariationAudioData.isAudioBufferLoading = true;
                        sampleVariationAudioData.audioBuffer = await loadSound(sampleVariationAudioData.variationFilePath).catch(e => { throw e });
                        sampleVariationAudioData.isAudioBufferLoading = false;
                        if (k === sampleVariationsAudioData.length - 1) {
                            // all variations loaded
                            wasLoadedAndNotPlayed = true;
                        }
                    }
                }
                sampleContainer.classList.add("active");
                if(maxVolElement.value === 0){
                    maxVolElement.value = 50;
                    maxVolElement.dispatchEvent(new Event('valueChange'));
                }
                if(volElement.value === 0){
                    volElement.value = 50;
                    volElement.dispatchEvent(new Event('valueChange'));
                }

                if (wasLoadedAndNotPlayed) {
                    wasLoadedAndNotPlayed = false;
                    try {

                        playRandomVariation(sceneSamplesAudioData[forCurrentSampleIndex]); // mark*
                    } catch (e) {
                        console.error(e);
                    }

                }
            } else {
                sampleContainer.classList.remove("active");
                maxVolElement.value = 0;
                maxVolElement.dispatchEvent(new Event('valueChange'));

                stopSceneSampleVariations(sceneSamplesAudioData[forCurrentSampleIndex]);
                for (let k = 0; k < sampleVariationsAudioData.length; k++) {
                    const sampleVariationAudioData = sampleVariationsAudioData[k];
                    if (sampleVariationAudioData.audioBuffer !== null) {
                        sampleVariationAudioData.audioBuffer = null;
                    }
                }
            }
        });
        sampleContainer.appendChild(sampleTogglerElement);



        // setup volume slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const volElement = /** @type {RangeSliderHTMLElement} */(document.createElement('range-slider'));
        volElement.label = 'Volume';
        volElement.value = currentSceneSampleVol;
        volElement.min = 0;
        volElement.max = 100;
        volElement.scaleUnitLabel = '%';
        volElement.addEventListener('valueChange', async (event) => {
            /** @type {RangeSliderHTMLElement} */
            const target = /** @type {RangeSliderHTMLElement} */ (event.target);
            const value = target.value;

            if (maxVolElement && value > maxVolElement.value) {
                maxVolElement.value = target.value;
                maxVolElement.dispatchEvent(new Event('valueChange'));
            }

            if (minVolElement && value < minVolElement.value) {
                minVolElement.value = target.value;
                minVolElement.dispatchEvent(new Event('valueChange'));
            }

            for (let j = 0; j < sampleVariationsAudioData.length; j++) {
                // we don't know which variation is playing so we should set the vorlume to all of them
                sampleVariationsAudioData[j].gainNode.gain.setValueAtTime(target.value / 100, audioContext.currentTime);
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].currentVol = target.value;

        });

        sampleContainer.appendChild(volElement);


        // setup volume min slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const minVolElement = /** @type {RangeSliderHTMLElement} */ (document.createElement('range-slider'));
        minVolElement.label = 'Volume Min';
        minVolElement.min = 0;
        minVolElement.max = 100;
        volElement.scaleUnitLabel = '%';
        minVolElement.value = sampleSubsceneConfigParams[_selectedSubsceneIndex].params !== null ? sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minVol : 0;
        minVolElement.addEventListener('valueChange', (event) => {

            /** @type {RangeSliderHTMLElement} */
            const target = /** @type {RangeSliderHTMLElement} */ (event.target);

            if (volElement && target.value > volElement.value) {
                volElement.value = target.value;
                volElement.dispatchEvent(new Event('valueChange'));
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].minVol = target.value

        });
        sampleContainer.appendChild(minVolElement);


        // setup volume max slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const maxVolElement = /** @type {RangeSliderHTMLElement} */ (document.createElement('range-slider'));
        maxVolElement.label = 'Volume Max';
        maxVolElement.min = 0;
        maxVolElement.max = 100;
        volElement.scaleUnitLabel = '%';
        maxVolElement.value = sampleSubsceneConfigParams[_selectedSubsceneIndex].params !== null ? sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxVol : 0;
        maxVolElement.addEventListener('valueChange', (event) => {

            /** @type {RangeSliderHTMLElement} */
            const target = /** @type {RangeSliderHTMLElement} */ (event.target);

            if (target.value > 0 && sampleTogglerElement.state == false) {
                sampleTogglerElement.state = true;
                sampleTogglerElement.dispatchEvent(new Event('toggle'));
            } else if (target.value <= 0 && sampleTogglerElement.state == true) {
                sampleTogglerElement.state = false;
                sampleTogglerElement.dispatchEvent(new Event('toggle'));
            }

            if (volElement && target.value < volElement.value) {
                volElement.value = target.value;
                volElement.dispatchEvent(new Event('valueChange'));
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].maxVol = target.value

        });
        sampleContainer.appendChild(maxVolElement);


        // setup variational timeframe min slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const minTimeframeElement =  /**@type {RangeSliderHTMLElement} */ (document.createElement('range-slider'));
        minTimeframeElement.label = 'Timeframe Min';
        minTimeframeElement.min = 2;
        minTimeframeElement.max = 60 * 60;
        minTimeframeElement.scaleUnitLabel = 's';
        minTimeframeElement.step = 10;
        minTimeframeElement.value = sampleSubsceneConfigParams[_selectedSubsceneIndex].params !== null ? Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength / 1000) : 60;
        minTimeframeElement.addEventListener('valueChange', (event) => {

            /** @type {RangeSliderHTMLElement} */
            const target = /** @type {RangeSliderHTMLElement} */ (event.target);

            const limitingValue = sampleSubsceneConfigParams[_selectedSubsceneIndex].params !== null ? Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength / 1000) - 2 : 120;
            if (target.value >= limitingValue) {
                if(sampleSubsceneConfigParams[_selectedSubsceneIndex].params){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength = limitingValue * 1000;
                }
                target.value = limitingValue;
            } else {
                if(sampleSubsceneConfigParams[_selectedSubsceneIndex].params){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength = target.value * 1000;
                }
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].minTimeframeLength = target.value * 1000

        });
        sampleContainer.appendChild(minTimeframeElement);


        // setup variational timeframe max slider
        /**
         *  @type {RangeSliderHTMLElement} 
         */
        const maxTimeframeElement = /**@type {RangeSliderHTMLElement} */ (document.createElement('range-slider'));
        maxTimeframeElement.label = 'Timeframe Max';
        maxTimeframeElement.min = 2;
        maxTimeframeElement.max = 60 * 60;
        maxTimeframeElement.scaleUnitLabel = 's';
        maxTimeframeElement.step = 10;
        maxTimeframeElement.value = sampleSubsceneConfigParams[_selectedSubsceneIndex].params !== null ? Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength / 1000) : 120;
        maxTimeframeElement.addEventListener('valueChange', (event) => {
            /** @type {RangeSliderHTMLElement} */
            const target = /** @type {RangeSliderHTMLElement} */ (event.target);

            const limitingValue = sampleSubsceneConfigParams[_selectedSubsceneIndex].params !== null ? Math.floor(sampleSubsceneConfigParams[_selectedSubsceneIndex].params.minTimeframeLength / 1000) + 2 : 60;
            if (target.value <= limitingValue) {
                if(sampleSubsceneConfigParams[_selectedSubsceneIndex].params){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength = limitingValue * 1000;
                }
                target.value = limitingValue;
            } else {
                if(sampleSubsceneConfigParams[_selectedSubsceneIndex].params){
                    sampleSubsceneConfigParams[_selectedSubsceneIndex].params.maxTimeframeLength = target.value * 1000;
                }
            }

            // persist value in state
            sceneObject.subscenes[_selectedSubsceneIndex].subsceneWindows[_selectedSubsceneWindowIndex].config[i].maxTimeframeLength = target.value * 1000

        });
        sampleContainer.appendChild(maxTimeframeElement);

        sceneSamplesAudioData.push({
            overlayTimeout: null,
            currentSource: null,
            stitchingMethd,
            concatOverlayMs,
            sampleSubsceneConfigParams,
            sampleVariationsAudioData,
            sampleTogglerElement,
            associatedCurrentVolumeSliderHtmlElement: volElement,
            minVolElement,
            maxVolElement,
            minTimeframeElement,
            maxTimeframeElement,
        });
    }
    return slidersContainer;
}

async function loadAndParseNewSceneData(scenes, _selectedSceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex) {

    onLoadingStarted();

    removeCurrentSliders();

    sceneSamplesAudioData = [];
    const slidersContainer = document.getElementById('sliders');

    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
        const groupHTMLParent = document.createElement('div');
        const groupLabel = /** @type {HTMLLabelElement} */ (document.createElement('label'));
        groupLabel.classList.add('group-label');
        groupLabel.innerText = scenes[sceneIndex].sceneName;

        groupLabel.addEventListener('click', (event) => {
             /** @type {HTMLLabelElement} */
             const target = /** @type {HTMLLabelElement} */ (event.target);
            if (target.classList.contains('group-label-open')) {
                target.classList.remove('group-label-open');
            } else {
                target.classList.add('group-label-open');
            }
        })

        groupHTMLParent.appendChild(groupLabel);
        const groupSamplesWrapper = document.createElement('div');
        groupSamplesWrapper.classList.add('group-samples-wrapper');
        groupHTMLParent.appendChild(groupSamplesWrapper);


        const samplesGroupHtmlElement = await loadAndParseDataForSceneData(scenes, sceneIndex, _selectedSubsceneIndex, _selectedSubsceneWindowIndex);
        samplesGroupHtmlElement.forEach(sampleHTMLElement => {
            groupSamplesWrapper.appendChild(sampleHTMLElement);
        })

        slidersContainer?.appendChild(groupHTMLParent);
    }

    onLoadingFinished();
}

function stopSceneSampleVariations(sceneSamplesAudio) {

    for (let i = 0; i < sceneSamplesAudioData.length; i++) {
        if (sceneSamplesAudio.overlayTimeout) {

            clearTimeout(sceneSamplesAudio.overlayTimeout)
        }
        const currentSource = sceneSamplesAudio.currentSource;
        if (currentSource) {
            currentSource.stop();  // Stop the audio
            sceneSamplesAudio.currentSource = null;  // Clear the reference
        }
    }
}

// Function to fetch and decode an audio file
async function loadSound(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
        console.error(`Failed to load sound file at ${url}:`, error);
        return null; // Return null to prevent errors from breaking the whole program
    }
}
/**
 * @param {string} url URL of config.json file
 * @returns {Promise<SoundSceneConfig[]>}
 */
async function loadJson(url) {

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error fetching config file. Response status: ${response.status}`);
    }

    return await response.json();

}

function playRandomVariation(scenerySampleAudioData) {
    if (isStarted === false) return;

    const numberOfVariations = scenerySampleAudioData.sampleVariationsAudioData.length;
    const randomIndex = Math.floor(Math.random() * numberOfVariations);

    const audioBuffer = scenerySampleAudioData.sampleVariationsAudioData[randomIndex].audioBuffer;
    const gainNode = scenerySampleAudioData.sampleVariationsAudioData[randomIndex].gainNode;


    const audioBufferSource = audioContext.createBufferSource();
    audioBufferSource.buffer = audioBuffer;
    audioBufferSource.connect(gainNode).connect(audioContext.destination);

    // Store the buffer source for later stopping
    scenerySampleAudioData.currentSource = audioBufferSource;

    if (scenerySampleAudioData.stitchingMethd === "JOIN_WITH_CROSSFADE") {

        // this will only start immediately after one sample ended and does not really create a crossfade
        audioBufferSource.onended = () => {
            if (isStarted) playRandomVariation(scenerySampleAudioData);
        };

    } else if (scenerySampleAudioData.stitchingMethd === "JOIN_WITH_OVERLAY") {

        // Schedule the next variation to start before the current one ends
        let nextStartTime = audioBuffer.duration * 1000 - scenerySampleAudioData.concatOverlayMs; // mark*

        if (nextStartTime <= 0) {
            console.warn(`
                The overlay duration must be higher than the sample duration.\n
                Will play the next variation after the current one ends:\n
                ${scenerySampleAudioData.sampleVariationsAudioData[randomIndex].variationFilePath}
            `);
            nextStartTime = audioBuffer.duration;
        }
        // Set a timeout to start the next variation before the current one ends
        scenerySampleAudioData.overlayTimeout = setTimeout(() => {
            if (isStarted) playRandomVariation(scenerySampleAudioData);
        }, nextStartTime);

    }

    audioBufferSource.start();
}


function removeCurrentSliders() {
    const slidersContainer = document.getElementById('sliders');
    if(!slidersContainer){
        return;
    }
    slidersContainer.innerHTML = '';
}


/**
 * @typedef {Object} SubsceneWindowsConfigExportable
 * @property {number} minVolRatio
 * @property {number} maxVolRatio
 * @property {number} minTimeframeLengthMs
 * @property {number} maxTimeframeLengthMs

 */
/**
 * @typedef {Object} SubsceneWindowExportable
 * 
 * @property {number} startAt At which point (in milliseconds) the config should start when the final sound will be processed
 * @property {SubsceneWindowsConfigExportable} params Subscene window config
 */

/**
 * @typedef {Object} ExportableSceneSamplesConfig
 * 
 * @property {string[]} variationFilePath
 * @property {SampleStitchingMethod} stitchingMethod
 * @property {number} concatOverlayMs
 * @property {SubsceneWindowExportable[]} timingWindows
 */
/**
 * 
 * @param {SoundSceneConfig} currentScene 
 * @param {SubsceneConfig} currentSubscene 
 * @returns {ExportableSceneSamplesConfig[]}
 */
function generateCurrentConfigJsonForScene(currentScene, currentSubscene) {
    return currentScene.samples.map((sample, sampleIndex) => {

        const timingWindows = currentSubscene.subsceneWindows.map((subsceneWindow, i) => {
            if (i === 0 && subsceneWindow.startAt !== 0) {
                throw new Error("The property 'startAt' needs to be 0 in the first timing window")
            }
            return {
                startAt: subsceneWindow.startAt,

                params: {

                    minVolRatio: subsceneWindow.config[sampleIndex].minVol / 100,
                    maxVolRatio: subsceneWindow.config[sampleIndex].maxVol / 100,
                    minTimeframeLengthMs: subsceneWindow.config[sampleIndex].minTimeframeLength,
                    maxTimeframeLengthMs: subsceneWindow.config[sampleIndex].maxTimeframeLength
                }
            }
        })

        const variationFilePath = sample.variationNames.map(variationName => `./${variationName}`);

        return {
            variationFilePath,
            stitchingMethod: sample.stitchingMethd,
            concatOverlayMs: sample.concatOverlayMs,
            timingWindows
        };
    })
        // do not add to export file the samples with max volume = 0
        .filter(mappedSample => mappedSample.timingWindows.some(timingWindow => timingWindow.params.maxVolRatio !== 0))
}

function generateCurrentConfigJson() {

    let sampleDataConfig = []

    for (let sceneIndex = 0; sceneIndex < localConfigData.length; sceneIndex++) {
        sampleDataConfig = [...sampleDataConfig, ...generateCurrentConfigJsonForScene(localConfigData[sceneIndex], localConfigData[sceneIndex].subscenes[0])]
    }

    const configData = {
        lengthMs: 60 * 60 * 1000,
        bitDepth: 16,
        sampleRate: 44100,
        format: 'wav', // aac = adts
        sampleDataConfig
    };

    const jsonString = JSON.stringify(configData, null, 2); // Pretty print the JSON
    downloadJsonFile(jsonString, 'currentConfig.json'); // Trigger download
}

function downloadJsonFile(jsonString, filename) {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); // Free up memory
}

function addCtaEventListeners() {
    ctas.exportJsonButton?.addEventListener('click', generateCurrentConfigJson);
}

/**
 * @param {SoundSceneConfig[]} config
 */
function initApp(config) {
    localConfigData = config;
    initScene(localConfigData, 0, 0, 0).then().catch(e => { throw e });
}

loadConfig().then((config) => {
    initApp(config)
    addCtaEventListeners();

}).catch(e => { throw e });



