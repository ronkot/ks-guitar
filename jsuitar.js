// modules are defined as an array
// [ module function, map of requires ]
//
// map of requires is short require name -> numeric require
//
// anything defined in a previous bundle is accessed via the
// orig method which is the require for previous bundles

// eslint-disable-next-line no-global-assign
require = (function (modules, cache, entry) {
  // Save the require from previous bundle to this closure if any
  var previousRequire = typeof require === "function" && require;

  function newRequire(name, jumped) {
    if (!cache[name]) {
      if (!modules[name]) {
        // if we cannot find the module within our internal map or
        // cache jump to the current global require ie. the last bundle
        // that was added to the page.
        var currentRequire = typeof require === "function" && require;
        if (!jumped && currentRequire) {
          return currentRequire(name, true);
        }

        // If there are other bundles on this page the require from the
        // previous one is saved to 'previousRequire'. Repeat this as
        // many times as there are bundles until the module is found or
        // we exhaust the require chain.
        if (previousRequire) {
          return previousRequire(name, true);
        }

        var err = new Error('Cannot find module \'' + name + '\'');
        err.code = 'MODULE_NOT_FOUND';
        throw err;
      }
      
      localRequire.resolve = resolve;

      var module = cache[name] = new newRequire.Module;

      modules[name][0].call(module.exports, localRequire, module, module.exports);
    }

    return cache[name].exports;

    function localRequire(x){
      return newRequire(localRequire.resolve(x));
    }

    function resolve(x){
      return modules[name][1][x] || x;
    }
  }

  function Module() {
    this.bundle = newRequire;
    this.exports = {};
  }

  newRequire.Module = Module;
  newRequire.modules = modules;
  newRequire.cache = cache;
  newRequire.parent = previousRequire;

  for (var i = 0; i < entry.length; i++) {
    newRequire(entry[i]);
  }

  // Override the current require with this new one
  return newRequire;
})({17:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getAudioContext;
function getAudioContext() {
  if ('localAudioContext' in window) {
    return window.localAudioContext;
  }

  var constructor;
  var error;
  if ('AudioContext' in window) {
    // Firefox, Chrome
    constructor = window.AudioContext;
  } else if ('webkitAudioContext' in window) {
    // Safari
    constructor = window.webkitAudioContext;
  } else {
    return null;
  }

  var audioContext = new constructor();
  window.localAudioContext = audioContext;
  return audioContext;
}
},{}],19:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = AsmFunctionsWrapper;
function AsmFunctionsWrapper() {}

AsmFunctionsWrapper.prototype.initAsm = function (heapSize) {
  var roundedHeapSize = getNextValidFloat32HeapLength(heapSize);

  // asm.js requires all data in/out of function to
  // be done through heap object
  // we don't want to allocate a new heap on every call,
  // so we reuse a static variable
  // but seedNoise.length will be different depending on the string,
  // so be willing to enlarge it if necessary
  this.heap = new Float32Array(roundedHeapSize);

  // from the asm.js spec, it sounds like the heap must be
  // passed in as a plain ArrayBuffer
  // (.buffer is the ArrayBuffer referenced by the Float32Buffer)
  var heapBuffer = this.heap.buffer;
  // any non-asm.js functions must be referenced through a
  // "foreign function" interface
  var foreignFunctions = {
    random: Math.random,
    round: Math.round
  };
  // we specifically do this here so that we only recreate
  // the asm functions if we really have to
  // that way, V8 will be able to cache optimized versions
  // of the functions
  this.asm = asmFunctions(window, foreignFunctions, heapBuffer);
};

AsmFunctionsWrapper.prototype.pluckDecayedSine = function (channelBuffer, sampleRate, hz, velocity, decayFactor) {

  var requiredHeapSize = channelBuffer.length;
  if (typeof this.heap == 'undefined') {
    this.initAsm(requiredHeapSize);
  }
  if (requiredHeapSize > this.heap.length) {
    this.initAsm(requiredHeapSize);
  }

  var heapOffsets = {
    targetStart: 0,
    targetEnd: channelBuffer.length - 1
  };

  var heapFloat32 = this.heap;
  var asm = this.asm;

  asm.renderDecayedSine(heapOffsets.targetStart, heapOffsets.targetEnd, sampleRate, hz, velocity, decayFactor);

  var targetArrayL = channelBuffer.getChannelData(0);
  var targetArrayR = channelBuffer.getChannelData(1);
  for (var i = 0; i < targetArrayL.length; i++) {
    targetArrayL[i] = heapFloat32[i];
    targetArrayR[i] = heapFloat32[i];
  }
};

AsmFunctionsWrapper.prototype.pluck = function (channelBuffer, seedNoise, sampleRate, hz, smoothingFactor, velocity, options, acousticLocation) {

  var requiredHeapSize = seedNoise.length + channelBuffer.length;
  if (typeof this.heap == 'undefined') {
    this.initAsm(requiredHeapSize);
  }
  if (requiredHeapSize > this.heap.length) {
    this.initAsm(requiredHeapSize);
  }

  var heapFloat32 = this.heap;
  var asm = this.asm;

  var i;
  for (i = 0; i < seedNoise.length; i++) {
    heapFloat32[i] = seedNoise[i];
  }

  var heapOffsets = {
    seedStart: 0,
    seedEnd: seedNoise.length - 1,
    targetStart: seedNoise.length,
    targetEnd: seedNoise.length + channelBuffer.length - 1
  };

  asm.renderKarplusStrong(heapOffsets.seedStart, heapOffsets.seedEnd, heapOffsets.targetStart, heapOffsets.targetEnd, sampleRate, hz, velocity, smoothingFactor, options.stringTension, options.pluckDamping, options.pluckDampingVariation, options.characterVariation);

  if (options.body == "simple") {
    asm.resonate(heapOffsets.targetStart, heapOffsets.targetEnd);
  }

  asm.fadeTails(heapOffsets.targetStart, heapOffsets.targetEnd - heapOffsets.targetStart + 1);

  var targetArrayL = channelBuffer.getChannelData(0);
  var targetArrayR = channelBuffer.getChannelData(1);
  // string.acousticLocation is set individually for each string such that
  // the lowest note has a value of -1 and the highest +1
  var stereoSpread = options.stereoSpread * acousticLocation;
  // for negative stereoSpreads, the note is pushed to the left
  // for positive stereoSpreads, the note is pushed to the right
  var gainL = (1 - stereoSpread) * 0.5;
  var gainR = (1 + stereoSpread) * 0.5;
  for (i = 0; i < targetArrayL.length; i++) {
    targetArrayL[i] = heapFloat32[heapOffsets.targetStart + i] * gainL;
  }
  for (i = 0; i < targetArrayL.length; i++) {
    targetArrayR[i] = heapFloat32[heapOffsets.targetStart + i] * gainR;
  }
};

// http://asmjs.org/spec/latest/#modules
// the byte length must be 2^n for n in [12, 24],
// or for bigger heaps, 2^24 * n for n >= 1
function getNextValidFloat32HeapLength(desiredLengthFloats) {
  var heapLengthBytes;
  var desiredLengthBytes = desiredLengthFloats << 2;

  if (desiredLengthBytes <= Math.pow(2, 12)) {
    heapLengthBytes = Math.pow(2, 12);
  } else if (desiredLengthBytes < Math.pow(2, 24)) {
    heapLengthBytes = Math.pow(2, Math.ceil(Math.log2(desiredLengthBytes)));
  } else {
    throw "Heap length greater than 2^24 bytes not implemented";
  }
  return heapLengthBytes;
}

// standard asm.js block
// stdlib: object through which standard library functions are called
// foreign: object through which external javascript functions are called
// heap: buffer used for all data in/out of function
function asmFunctions(stdlib, foreign, heapBuffer) {
  "use asm";

  // heap is supposed to come in as just an ArrayBuffer
  // so first need to get a Float32 view of it

  var heap = new stdlib.Float32Array(heapBuffer);
  var fround = stdlib.Math.fround;
  var sin = stdlib.Math.sin;
  var pi = stdlib.Math.PI;
  var floor = stdlib.Math.floor;
  var pow = stdlib.Math.pow;
  var random = foreign.random;
  var round = foreign.round;

  // simple discrete-time low-pass filter from Wikipedia
  function lowPass(lastOutput, currentInput, smoothingFactor) {
    // coersion to indicate type of arguments
    // +x represents double
    // we do all the arithmetic using doubles rather than floats,
    // because in the asm.js spec, operations done floats resolve
    // to 'floatish'es, which need to be coerced back into floats,
    // and the code becomes unreadable
    lastOutput = +lastOutput;
    currentInput = +currentInput;
    smoothingFactor = +smoothingFactor;

    var currentOutput = 0.0;
    currentOutput = smoothingFactor * currentInput + (1.0 - smoothingFactor) * lastOutput;

    return +currentOutput;
  }

  // simple discrete-time high-pass filter from Wikipedia
  function highPass(lastOutput, lastInput, currentInput, smoothingFactor) {
    lastOutput = +lastOutput;
    lastInput = +lastInput;
    currentInput = +currentInput;
    smoothingFactor = +smoothingFactor;

    var currentOutput = 0.0;
    currentOutput = smoothingFactor * lastOutput + smoothingFactor * (currentInput - lastInput);

    return +currentOutput;
  }

  // this is copied verbatim from the original ActionScript source
  // haven't figured out how it works yet
  function resonate(heapStart, heapEnd) {
    // '|0' declares parameter as int
    // http://asmjs.org/spec/latest/#parameter-type-annotations
    heapStart = heapStart | 0;
    heapEnd = heapEnd | 0;

    // explicitly initialise all variables so types are declared
    var r00 = 0.0;
    var f00 = 0.0;
    var r10 = 0.0;
    var f10 = 0.0;
    var f0 = 0.0;
    var c0 = 0.0;
    var c1 = 0.0;
    var r0 = 0.0;
    var r1 = 0.0;
    var i = 0;
    var resonatedSample = 0.0;
    var resonatedSamplePostHighPass = 0.0;
    // by making the smoothing factor large, we make the cutoff
    // frequency very low, acting as just an offset remover
    var highPassSmoothingFactor = 0.999;
    var lastOutput = 0.0;
    var lastInput = 0.0;

    // +x indicates that x is a double
    // (asm.js Math functions take doubles as arguments)
    c0 = 2.0 * sin(pi * 3.4375 / 44100.0);
    c1 = 2.0 * sin(pi * 6.124928687214833 / 44100.0);
    r0 = 0.98;
    r1 = 0.98;

    // asm.js seems to require byte addressing of the heap...?
    // http://asmjs.org/spec/latest/#validateheapaccess-e
    // yeah, when accessing the heap with an index which is an expression,
    // the total index expression is validated in a way that
    // forces the index to be a byte
    // and apparently '|0' coerces to signed when not in the context
    // of parameters
    // http://asmjs.org/spec/latest/#binary-operators
    for (i = heapStart << 2; (i | 0) <= heapEnd << 2; i = i + 4 | 0) {
      r00 = r00 * r0;
      r00 = r00 + (f0 - f00) * c0;
      f00 = f00 + r00;
      f00 = f00 - f00 * f00 * f00 * 0.166666666666666;
      r10 = r10 * r1;
      r10 = r10 + (f0 - f10) * c1;
      f10 = f10 + r10;
      f10 = f10 - f10 * f10 * f10 * 0.166666666666666;
      f0 = +heap[i >> 2];
      resonatedSample = f0 + (f00 + f10) * 2.0;

      // I'm not sure why, but the resonating process plays
      // havok with the DC offset - it jumps around everywhere.
      // We put it back to zero DC offset by adding a high-pass
      // filter with a super low cutoff frequency.
      resonatedSamplePostHighPass = +highPass(lastOutput, lastInput, resonatedSample, highPassSmoothingFactor);
      heap[i >> 2] = resonatedSamplePostHighPass;

      lastOutput = resonatedSamplePostHighPass;
      lastInput = resonatedSample;
    }
  }

  // apply a fade envelope to the end of a buffer
  // to make it end at zero ampltiude
  // (to avoid clicks heard when sample otherwise suddenly
  //  cuts off)
  function fadeTails(heapStart, length) {
    heapStart = heapStart | 0;
    length = length | 0;

    var heapEnd = 0;
    var tailProportion = 0.0;
    var tailSamples = 0;
    var tailSamplesStart = 0;
    var i = 0;
    var samplesThroughTail = 0;
    var proportionThroughTail = 0.0;
    var gain = 0.0;

    tailProportion = 0.1;
    // we first convert length from an int to an unsigned (>>>0)
    // so that we can convert it a double for the argument of floor()
    // then convert it to a double (+)
    // then convert the double result of floor to a signed with ~~
    // http://asmjs.org/spec/latest/#binary-operators
    // http://asmjs.org/spec/latest/#standard-library
    // http://asmjs.org/spec/latest/#binary-operators
    tailSamples = ~~floor(+(length >>> 0) * tailProportion);
    // http://asmjs.org/spec/latest/#additiveexpression
    // the result of an additive addition is an intish,
    // which must be coerced back to an int
    tailSamplesStart = heapStart + length - tailSamples | 0;

    heapEnd = heapStart + length | 0;

    // so remember, i represents a byte index,
    // and the heap is a Float32Array (4 bytes)
    for (i = tailSamplesStart << 2, samplesThroughTail = 0; (i | 0) < heapEnd << 2; i = i + 4 | 0, samplesThroughTail = samplesThroughTail + 1 | 0) {
      proportionThroughTail = +(samplesThroughTail >>> 0) / +(tailSamples >>> 0);
      gain = 1.0 - proportionThroughTail;
      heap[i >> 2] = heap[i >> 2] * fround(gain);
    }
  }

  // the "smoothing factor" parameter is the coefficient
  // used on the terms in the main low-pass filter in the
  // Karplus-Strong loop
  function renderKarplusStrong(seedNoiseStart, seedNoiseEnd, targetArrayStart, targetArrayEnd, sampleRate, hz, velocity, smoothingFactor, stringTension, pluckDamping, pluckDampingVariation, characterVariation) {
    seedNoiseStart = seedNoiseStart | 0;
    seedNoiseEnd = seedNoiseEnd | 0;
    targetArrayStart = targetArrayStart | 0;
    targetArrayEnd = targetArrayEnd | 0;
    sampleRate = sampleRate | 0;
    hz = +hz;
    velocity = +velocity;
    smoothingFactor = +smoothingFactor;
    stringTension = +stringTension;
    pluckDamping = +pluckDamping;
    pluckDampingVariation = +pluckDampingVariation;
    characterVariation = +characterVariation;

    var period = 0.0;
    var periodSamples = 0;
    var sampleCount = 0;
    var lastOutputSample = 0.0;
    var curInputSample = 0.0;
    var noiseSample = 0.0;
    var skipSamplesFromTension = 0;
    var curOutputSample = 0.0;
    var pluckDampingMin = 0.0;
    var pluckDampingMax = 0.0;
    var pluckDampingVariationMin = 0.0;
    var pluckDampingVariationMax = 0.0;
    var pluckDampingVariationDifference = 0.0;
    var pluckDampingCoefficient = 0.0;

    // the (byte-addressed) index of the heap as a whole that
    // we get noise samples from
    var heapNoiseIndexBytes = 0;
    // the (Float32-addressed) index of the portion of the heap
    // that we'll be writing to
    var targetIndex = 0;
    // the (byte-addressed) index of the heap as a whole where
    // we'll be writing
    var heapTargetIndexBytes = 0;
    // the (byte-addressed) index of the heap as a whole of
    // the start of the last period of samples
    var lastPeriodStartIndexBytes = 0;
    // the (byte-addressed) index of the heap as a whole from
    // where we'll be taking samples from the last period, after
    // having added the skip from tension
    var lastPeriodInputIndexBytes = 0;

    period = 1.0 / hz;
    periodSamples = ~~+round(period * +(sampleRate >>> 0));
    sampleCount = targetArrayEnd - targetArrayStart + 1 | 0;

    /*
    |- pluckDampingMax
    |
    |               | - pluckDampingVariationMax         | -
    |               | (pluckDampingMax - pluckDamping) * |
    |               | pluckDampingVariation              | pluckDamping
    |- pluckDamping | -                                  | Variation
    |               | (pluckDamping - pluckDampingMin) * | Difference
    |               | pluckDampingVariation              |
    |               | - pluckDampingVariationMin         | -
    |
    |- pluckDampingMin
    */
    pluckDampingMin = 0.1;
    pluckDampingMax = 0.9;
    pluckDampingVariationMin = pluckDamping - (pluckDamping - pluckDampingMin) * pluckDampingVariation;
    pluckDampingVariationMax = pluckDamping + (pluckDampingMax - pluckDamping) * pluckDampingVariation;
    pluckDampingVariationDifference = pluckDampingVariationMax - pluckDampingVariationMin;
    pluckDampingCoefficient = pluckDampingVariationMin + +random() * pluckDampingVariationDifference;

    for (targetIndex = 0; (targetIndex | 0) < (sampleCount | 0); targetIndex = targetIndex + 1 | 0) {

      heapTargetIndexBytes = targetArrayStart + targetIndex << 2;

      if ((targetIndex | 0) < (periodSamples | 0)) {
        // for the first period, feed in noise
        // remember, heap index has to be bytes...
        heapNoiseIndexBytes = seedNoiseStart + targetIndex << 2;
        noiseSample = +heap[heapNoiseIndexBytes >> 2];
        // create room for character variation noise
        noiseSample = noiseSample * (1.0 - characterVariation);
        // add character variation
        noiseSample = noiseSample + characterVariation * (-1.0 + 2.0 * +random());
        // also velocity
        noiseSample = noiseSample * velocity;
        // by varying 'pluck damping', we can control the spectral
        // content of the input noise
        curInputSample = +lowPass(curInputSample, noiseSample, pluckDampingCoefficient);
      } else if (stringTension != 1.0) {
        // for subsequent periods, feed in the output from
        // about one period ago
        lastPeriodStartIndexBytes = heapTargetIndexBytes - (periodSamples << 2) | 0;
        skipSamplesFromTension = ~~floor(stringTension * +(periodSamples >>> 0));
        lastPeriodInputIndexBytes = lastPeriodStartIndexBytes + (skipSamplesFromTension << 2) | 0;
        curInputSample = +heap[lastPeriodInputIndexBytes >> 2];
      } else {
        // if stringTension == 1.0, we would be reading from the
        // same sample we were writing to
        // ordinarily, this would have the effect that only the first
        // period of noise was preserved, and the rest of the buffer
        // would be silence, but because we're reusing the heap,
        // we'd actually be reading samples from old waves
        curInputSample = 0.0;
      }

      // the current period is generated by applying a low-pass
      // filter to the last period
      curOutputSample = +lowPass(lastOutputSample, curInputSample, smoothingFactor);

      heap[heapTargetIndexBytes >> 2] = curOutputSample;
      lastOutputSample = curOutputSample;
    }
  }

  function renderDecayedSine(targetArrayStart, targetArrayEnd, sampleRate, hz, velocity, decayFactor) {
    targetArrayStart = targetArrayStart | 0;
    targetArrayEnd = targetArrayEnd | 0;
    sampleRate = sampleRate | 0;
    hz = +hz;
    velocity = +velocity;
    decayFactor = +decayFactor;

    var period = 0.0;
    var periodSamples = 0;
    var sampleCount = 0;
    // the (Float32-addressed) index of the portion of the heap
    // that we'll be writing to
    var targetIndex = 0;
    // the (byte-addressed) index of the heap as a whole where
    // we'll be writing
    var heapTargetIndexBytes = 0;

    var time = 0.0;

    period = 1.0 / hz;
    periodSamples = ~~+round(period * +(sampleRate >>> 0));
    sampleCount = targetArrayEnd - targetArrayStart + 1 | 0;

    for (targetIndex = 0; (targetIndex | 0) < (sampleCount | 0); targetIndex = targetIndex + 1 | 0) {

      heapTargetIndexBytes = targetArrayStart + targetIndex << 2;

      // >>>0: convert from int to unsigned
      time = +(targetIndex >>> 0) / +(sampleRate >>> 0);
      heap[heapTargetIndexBytes >> 2] = velocity * pow(2.0, -decayFactor * time) * sin(2.0 * pi * hz * time);
    }
  }

  return {
    renderKarplusStrong: renderKarplusStrong,
    renderDecayedSine: renderDecayedSine,
    fadeTails: fadeTails,
    resonate: resonate
  };
}
},{}],20:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getControlsValues = getControlsValues;
function getControlsValues() {
  // var stringTensionSlider =
  //     document.getElementById("stringTension");
  // var stringTension = stringTensionSlider.valueAsNumber;

  // var characterVariationSlider =
  //     document.getElementById("characterVariation");
  // var characterVariation = characterVariationSlider.valueAsNumber;

  // var stringDampingSlider =
  //     document.getElementById("stringDamping");
  // var stringDamping = stringDampingSlider.valueAsNumber;

  // var stringDampingVariationSlider =
  //     document.getElementById("stringDampingVariation");
  // var stringDampingVariation = stringDampingVariationSlider.valueAsNumber;

  // var pluckDampingSlider =
  //     document.getElementById("pluckDamping");
  // var pluckDamping = pluckDampingSlider.valueAsNumber;

  // var pluckDampingVariationSlider =
  //     document.getElementById("pluckDampingVariation");
  // var pluckDampingVariation = pluckDampingVariationSlider.valueAsNumber;

  // var stereoSpreadSlider =
  //     document.getElementById("stereoSpread");
  // var stereoSpread = stereoSpreadSlider.valueAsNumber;

  // var magicCalculationRadio =
  //     document.getElementById("magicCalculation");
  // var directCalculationRadio =
  //     document.getElementById("directCalculation");
  // var stringDampingCalculation;
  // if (magicCalculationRadio.checked) {
  //     stringDampingCalculation = "magic";
  // } else if (directCalculationRadio.checked) {
  //     stringDampingCalculation = "direct";
  // }

  // var noBodyRadio =
  //     document.getElementById("noBody");
  // var simpleBodyRadio =
  //     document.getElementById("simpleBody");
  // var body;
  // if (noBodyRadio.checked) {
  //     body = "none";
  // } else if (simpleBodyRadio.checked) {
  //     body = "simple";
  // }

  return {
    stringTension: 0.0,
    characterVariation: 0.5,
    stringDamping: 0.5,
    stringDampingVariation: 0.25,
    stringDampingCalculation: 'magic',
    pluckDamping: 0.5,
    pluckDampingVariation: 0.25,
    body: 'simple',
    stereoSpread: 0.2
  };
}

function toggleGuitarPlaying(buttonID, mode) {
  var startStopButton = document.getElementById(buttonID);
  var text = startStopButton.innerHTML;
  var playState = document.getElementById("playState");

  if (text == "Start") {
    startStopButton.innerHTML = "Stop";
    playState.value = "playing";
    guitar.setMode(mode);
    startGuitarPlaying();
  } else {
    startStopButton.innerHTML = "Start";
    playState.value = "stopped";
  }
}
function updateStringDamping() {
  var stringDampingInput = document.getElementById("stringDamping");
  var stringDamping = stringDampingInput.valueAsNumber;
  var output = document.getElementById("stringDampingValue");
  output.value = stringDamping.toFixed(1);
}
function updateStringDampingVariation() {
  var stringDampingVariationInput = document.getElementById("stringDampingVariation");
  var stringDampingVariation = stringDampingVariationInput.valueAsNumber;
  var output = document.getElementById("stringDampingVariationValue");
  output.value = stringDampingVariation.toFixed(2);
}
function updateStringTension() {
  var stringTensionInput = document.getElementById("stringTension");
  var stringTension = stringTensionInput.valueAsNumber;
  var output = document.getElementById("stringTensionValue");
  output.value = stringTension.toFixed(1);
}
function updateCharacterVariation() {
  var characterVariationInput = document.getElementById("characterVariation");
  var characterVariation = characterVariationInput.valueAsNumber;
  var output = document.getElementById("characterVariationValue");
  output.value = characterVariation.toFixed(1);
}
function updateStereoSpread() {
  var stereoSpreadInput = document.getElementById("stereoSpread");
  var stereoSpread = stereoSpreadInput.valueAsNumber;
  var output = document.getElementById("stereoSpreadValue");
  output.value = stereoSpread.toFixed(1);
}
function updatePluckDamping() {
  var pluckDampingInput = document.getElementById("pluckDamping");
  var pluckDamping = pluckDampingInput.valueAsNumber;
  var output = document.getElementById("pluckDampingValue");
  output.value = pluckDamping.toFixed(1);
}
function updatePluckDampingVariation() {
  var pluckDampingVariationInput = document.getElementById("pluckDampingVariation");
  var pluckDampingVariation = pluckDampingVariationInput.valueAsNumber;
  var output = document.getElementById("pluckDampingVariationValue");
  output.value = pluckDampingVariation.toFixed(2);
}
function updateFilterCutoff() {
  var filterCutoffInput = document.getElementById("filterCutoff");
  var filterCutoff = filterCutoffInput.valueAsNumber;
  var output = document.getElementById("filterCutoffValue");
  output.value = filterCutoff.toFixed(1);
}
},{}],18:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = GuitarString;

var _guitarstring_asm = require("./guitarstring_asm");

var _guitarstring_asm2 = _interopRequireDefault(_guitarstring_asm);

var _controls = require("./controls");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function GuitarString(audioCtx, audioDestination, stringN, octave, semitone) {
  this.audioCtx = audioCtx;
  this.audioDestination = audioDestination;

  // work from A0 as a reference,
  // since it has a nice round frequency
  var a0_hz = 27.5;
  // an increase in octave by 1 doubles the frequency
  // each octave is divided into 12 semitones
  // the scale goes C0, C0#, D0, D0#, E0, F0, F0#, G0, G0#, A0, A0#, B0
  // so go back 9 semitones to get to C0
  var c0_hz = a0_hz * Math.pow(2, -9 / 12);
  this.basicHz = c0_hz * Math.pow(2, octave + semitone / 12);
  this.basicHz = this.basicHz.toFixed(2);

  var basicPeriod = 1 / this.basicHz;
  var basicPeriodSamples = Math.round(basicPeriod * audioCtx.sampleRate);
  this.seedNoise = generateSeedNoise(65535, basicPeriodSamples);

  // this is only used in a magical calculation of filter coefficients
  this.semitoneIndex = octave * 12 + semitone - 9;

  // ranges from -1 for first string to +1 for last
  this.acousticLocation = (stringN - 2.5) * 0.4;

  this.mode = "karplus-strong";

  this.asmWrapper = new _guitarstring_asm2.default();

  function generateSeedNoise(seed, samples) {
    var noiseArray = new Float32Array(samples);
    for (var i = 0; i < samples; i++) {
      noiseArray[i] = -1 + 2 * Math.random();
    }
    return noiseArray;
  }
}

// calculate the constant used for the low-pass filter
// used in the Karplus-Strong loop
function calculateSmoothingFactor(string, tab, options) {
  var smoothingFactor;
  if (options.stringDampingCalculation == "direct") {
    smoothingFactor = options.stringDamping;
  } else if (options.stringDampingCalculation == "magic") {
    // this is copied verbatim from the flash one
    // is magical, don't know how it works
    var noteNumber = (string.semitoneIndex + tab - 19) / 44;
    smoothingFactor = options.stringDamping + Math.pow(noteNumber, 0.5) * (1 - options.stringDamping) * 0.5 + (1 - options.stringDamping) * Math.random() * options.stringDampingVariation;
  }
  return smoothingFactor;
}

GuitarString.prototype.pluck = function (startTime, velocity, tab) {
  // create the buffer we're going to write into
  var channels = 2;
  var sampleRate = this.audioCtx.sampleRate;
  // 1 second buffer
  var sampleCount = 1.0 * sampleRate;
  var buffer = this.audioCtx.createBuffer(channels, sampleCount, sampleRate);

  var options = (0, _controls.getControlsValues)();
  var smoothingFactor = calculateSmoothingFactor(this, tab, options);
  // 'tab' represents which fret is held while plucking
  // each fret represents an increase in pitch by one semitone
  // (logarithmically, one-twelth of an octave)
  var hz = this.basicHz * Math.pow(2, tab / 12);

  // to match original ActionScript source
  velocity /= 4;

  // TODO: make this a proper enum or something
  if (this.mode == "karplus-strong") {
    this.asmWrapper.pluck(buffer, this.seedNoise, sampleRate, hz, smoothingFactor, velocity, options, this.acousticLocation);
  } else if (this.mode == "sine") {
    var decayFactor = 8;
    this.asmWrapper.pluckDecayedSine(buffer, sampleRate, hz, velocity, decayFactor);
  }

  // create an audio source node fed from the buffer we've just written
  var bufferSource = this.audioCtx.createBufferSource();
  bufferSource.buffer = buffer;
  bufferSource.connect(this.audioDestination);

  bufferSource.start(startTime);
};
},{"./guitarstring_asm":19,"./controls":20}],16:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = Guitar;

var _guitarstring = require("./guitarstring");

var _guitarstring2 = _interopRequireDefault(_guitarstring);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// JavaScript's class definitions are just functions
// the function itself serves as the constructor for the class
function Guitar(audioCtx, audioDestination) {
  // 'strings' becomes a 'property'
  // (an instance variable)
  this.strings = [
  // arguments are:
  // - audio context
  // - string number
  // - octave
  // - semitone
  new _guitarstring2.default(audioCtx, audioDestination, 0, 2, 4), // E2
  new _guitarstring2.default(audioCtx, audioDestination, 1, 2, 9), // A2
  new _guitarstring2.default(audioCtx, audioDestination, 2, 3, 2), // D3
  new _guitarstring2.default(audioCtx, audioDestination, 3, 3, 7), // G3
  new _guitarstring2.default(audioCtx, audioDestination, 4, 3, 11), // B3
  new _guitarstring2.default(audioCtx, audioDestination, 5, 4, 4) // E4
  ];
}

Guitar.prototype.strum = function (time, downstroke, velocity, chord) {
  var pluckOrder;
  if (downstroke === true) {
    pluckOrder = [0, 1, 2, 3, 4, 5];
  } else {
    pluckOrder = [5, 4, 3, 2, 1, 0];
  }

  for (var i = 0; i < 6; i++) {
    var stringNumber = pluckOrder[i];
    if (chord[stringNumber] != -1) {
      this.strings[stringNumber].pluck(time, velocity, chord[stringNumber]);
    }
    time += Math.random() / 128;
  }
};

Guitar.prototype.pluck = function (stringNumber, chord) {
  if (chord[stringNumber] > -1) {
    this.strings[stringNumber].pluck(0, 1.0, chord[stringNumber]);
  }
};

Guitar.prototype.setMode = function (mode) {
  for (var i = 0; i < 6; i++) {
    this.strings[i].mode = mode;
  }
};
},{"./guitarstring":18}],7:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _webaudio = require("./external/karplus-strong-guitar/webaudio");

var _webaudio2 = _interopRequireDefault(_webaudio);

var _guitar = require("./external/karplus-strong-guitar/guitar");

var _guitar2 = _interopRequireDefault(_guitar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const audioCtx = (0, _webaudio2.default)();
const guitar = new _guitar2.default(audioCtx, audioCtx.destination);
exports.default = guitar;
},{"./external/karplus-strong-guitar/webaudio":17,"./external/karplus-strong-guitar/guitar":16}],14:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {
  NEW_CHORD: 'NEW_CHORD',
  PLAY_CHORD: 'PLAY_CHORD',
  PLUCK_STRING: 'PLUCK_STRING'
};
},{}],15:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = {
  C: [-1, 3, 2, 0, 1, 0],
  C7: [-1, 3, 2, 0, 3, 0],
  Cm: [-1, 3, 5, 5, 4, 3],
  Cm7: [-1, 3, 5, 3, 5, 3],

  'C#': [-1, 4, 6, 6, 6, 4],
  'C#7': [-1, 4, 6, 4, 6, 4],
  'C#m': [-1, 4, 6, 6, 5, 4],
  'C#m7': [-1, 4, 6, 4, 5, 4],

  D: [-1, -1, 0, 2, 3, 2],
  D7: [-1, -1, 0, 2, 1, 2],
  Dm: [-1, -1, 0, 2, 3, 1],
  Dm7: [-1, -1, 0, 2, 1, 1],

  'D#': [-1, 6, 8, 8, 8, 6],
  'D#7': [-1, 6, 8, 6, 8, 6],
  'D#m': [-1, 6, 8, 8, 7, 6],
  'D#m7': [-1, 6, 8, 6, 7, 6],

  E: [0, 2, 2, 1, 0, 0],
  E7: [0, 2, 0, 1, 3, 0],
  Em: [0, 2, 2, 0, 0, 0],
  Em7: [0, 2, 2, 0, 3, 0],

  F: [1, 3, 3, 2, 1, 1],
  F7: [1, 3, 1, 2, 1, 1],
  Fm: [1, 3, 3, 1, 1, 1],
  Fm7: [1, 3, 3, 1, 4, 1],

  'F#': [2, 4, 4, 3, 2, 2],
  'F#7': [2, 4, 2, 3, 2, 2],
  'F#m': [2, 4, 4, 2, 2, 2],
  'F#m7': [2, 4, 4, 2, 5, 2],

  G: [3, 2, 0, 0, 0, 3],
  G7: [3, 2, 0, 0, 0, 1],
  Gm: [3, 5, 5, 3, 3, 3],
  Gm7: [3, 5, 5, 3, 6, 3],

  'G#': [4, 6, 6, 5, 4, 4],
  'G#7': [4, 6, 4, 5, 4, 4],
  'G#m': [4, 6, 6, 4, 4, 4],
  'G#m7': [4, 6, 6, 4, 7, 4],

  A: [-1, 0, 2, 2, 2, 0],
  A7: [-1, 0, 2, 0, 2, 0],
  Am: [-1, 0, 2, 2, 1, 0],
  Am7: [-1, 0, 2, 0, 1, 0],

  'A#': [6, 8, 8, 7, 6, 6],
  'A#7': [6, 8, 6, 7, 6, 6],
  'A#m': [6, 8, 8, 6, 6, 6],
  'A#m7': [6, 8, 8, 6, 9, 6],

  H: [-1, 2, 4, 4, 4, 2],
  H7: [-1, 2, 4, 2, 4, 2],
  Hm: [-1, 2, 4, 4, 3, 2],
  Hm7: [-1, 2, 4, 0, 3, 2],

  none: [-1, -1, -1, -1, -1, -1]
};
},{}],8:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _actionTypes = require("./action-types");

var _actionTypes2 = _interopRequireDefault(_actionTypes);

var _chords = require("./chords");

var _chords2 = _interopRequireDefault(_chords);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const GuitarPlayer = guitar => {
  let chord = _chords2.default['none'];
  const playOptions = {
    time: 0, // delay before play
    velocity: 1.0 // ?
  };

  return action => {
    if (action.type === _actionTypes2.default.NEW_CHORD) {
      chord = _chords2.default[action.chord] || _chords2.default['none'];
    } else if (action.type === _actionTypes2.default.PLAY_CHORD) {
      guitar.strum(playOptions.time, action.downstroke, playOptions.velocity, chord);
    } else if (action.type === _actionTypes2.default.PLUCK_STRING && chord) {
      guitar.pluck(action.stringNumber, chord);
    }
  };
};

exports.default = GuitarPlayer;
},{"./action-types":14,"./chords":15}],13:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
const Observable = emitter => {
  const subscribers = [];
  const emit = (...args) => subscribers.forEach(subscriber => subscriber(...args));
  let started = false;
  const subscribe = subscriber => {
    subscribers.push(subscriber);
    if (!started) {
      started = true;
      emitter(emit);
    }
  };
  return { subscribe };
};

exports.default = Observable;
},{}],9:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _observable = require("./observable");

var _observable2 = _interopRequireDefault(_observable);

var _actionTypes = require("./action-types");

var _actionTypes2 = _interopRequireDefault(_actionTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const StrokeEmitter = (0, _observable2.default)(emit => {
  const ARROWS = {
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40
  };
  const detectStroke = evt => {
    if (evt.keyCode === ARROWS.UP) {
      const action = {
        type: _actionTypes2.default.PLAY_CHORD,
        downstroke: false
      };
      emit(action);
    } else if (evt.keyCode === ARROWS.DOWN) {
      const action = {
        type: _actionTypes2.default.PLAY_CHORD,
        downstroke: true
      };
      emit(action);
    }
  };
  document.addEventListener('keydown', detectStroke);
});

exports.default = StrokeEmitter;
},{"./observable":13,"./action-types":14}],10:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _observable = require("./observable");

var _observable2 = _interopRequireDefault(_observable);

var _actionTypes = require("./action-types");

var _actionTypes2 = _interopRequireDefault(_actionTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const PluckEmitter = (0, _observable2.default)(emit => {
  const pluck = evt => {
    const stringMapping = {
      'B': 0,
      'N': 1,
      'M': 2,
      '¼': 3, // comma
      '¾': 4, // dot
      '½': 5 // dash
    };
    const key = String.fromCharCode(evt.keyCode);
    const stringNumber = stringMapping[key];
    if (stringNumber !== undefined) {
      const action = {
        type: _actionTypes2.default.PLUCK_STRING,
        stringNumber
      };
      emit(action);
    }
  };
  document.addEventListener('keydown', pluck);
});

exports.default = PluckEmitter;
},{"./observable":13,"./action-types":14}],11:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _observable = require("./observable");

var _observable2 = _interopRequireDefault(_observable);

var _chords = require("./chords");

var _chords2 = _interopRequireDefault(_chords);

var _actionTypes = require("./action-types");

var _actionTypes2 = _interopRequireDefault(_actionTypes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const ChordEmitter = (0, _observable2.default)(emit => {
  let keys = [];
  let chord = 'none';
  const handleKeys = keys => {
    const nextChord = getChord(keys);
    if (nextChord !== chord) {
      chord = nextChord;
      const action = {
        type: _actionTypes2.default.NEW_CHORD,
        chord
      };
      emit(action);
    }
  };
  const unique = arr => [...new Set(arr)];
  const addKey = evt => {
    keys = unique([...keys, String.fromCharCode(evt.keyCode)]);
    handleKeys(keys);
  };
  const removeKey = evt => {
    const evtKey = String.fromCharCode(evt.keyCode);
    keys = keys.filter(key => key !== evtKey);
    handleKeys(keys);
  };
  document.addEventListener('keydown', addKey);
  document.addEventListener('keyup', removeKey);
});

const getChord = keys => {
  const baseNoteMapping = {
    Q: 'C',
    W: 'D',
    E: 'E',
    R: 'F',
    T: 'G',
    Y: 'A',
    U: 'H',
    2: 'C#',
    3: 'D#',
    5: 'F#',
    6: 'G#',
    7: 'A#'
  };
  const upperRow = ['2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const lowerRow = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];

  const upperRowPresses = keys.map(key => upperRow.indexOf(key)).filter(index => index > -1);

  const lowerRowPresses = keys.map(key => lowerRow.indexOf(key)).filter(index => index > -1);

  let row, presses;
  if (upperRowPresses.length > 0) {
    row = upperRow;
    presses = upperRowPresses;
  } else if (lowerRowPresses.length > 0) {
    row = lowerRow;
    presses = lowerRowPresses;
  } else {
    return 'none';
  }

  const MINOR_OFFSET = 1;
  const SEVEN_OFFSET = 2;
  const minPress = Math.min(...presses);
  const isMinor = presses.includes(minPress + MINOR_OFFSET);
  const is7 = presses.includes(minPress + SEVEN_OFFSET);
  const base = baseNoteMapping[row[minPress]];
  const chord = `${base}${isMinor ? 'm' : ''}${is7 ? '7' : ''}`;
  return chord;
};

exports.default = ChordEmitter;
},{"./observable":13,"./chords":15,"./action-types":14}],12:[function(require,module,exports) {
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
const initializeUI = $root => {
  const $toggleHelp = $root.querySelector('.toggle-help');
  const $helpText = $root.querySelector('.help-text');
  const $chordInfo = $root.querySelector('.chord-info');

  // Event handling
  const onToggleHelp = () => $helpText.style.display = ($helpText.style.display || 'none') == 'none' ? 'block' : 'none';
  $toggleHelp.addEventListener('click', onToggleHelp);

  // Action handling
  const onNewChord = chord => $chordInfo.innerHTML = chord;
  const actionHandler = action => {
    if (action.type === 'NEW_CHORD') {
      onNewChord(action.chord);
    }
  };
  return actionHandler;
};

exports.default = initializeUI;
},{}],6:[function(require,module,exports) {
"use strict";

var _guitar = require("./guitar");

var _guitar2 = _interopRequireDefault(_guitar);

var _guitarPlayer = require("./guitar-player");

var _guitarPlayer2 = _interopRequireDefault(_guitarPlayer);

var _strokeEmitter = require("./stroke-emitter");

var _strokeEmitter2 = _interopRequireDefault(_strokeEmitter);

var _pluckEmitter = require("./pluck-emitter");

var _pluckEmitter2 = _interopRequireDefault(_pluckEmitter);

var _chordEmitter = require("./chord-emitter");

var _chordEmitter2 = _interopRequireDefault(_chordEmitter);

var _ui = require("./ui");

var _ui2 = _interopRequireDefault(_ui);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const main = () => {
  const guitarPlayer = (0, _guitarPlayer2.default)(_guitar2.default);
  _chordEmitter2.default.subscribe(guitarPlayer);
  _strokeEmitter2.default.subscribe(guitarPlayer);
  _pluckEmitter2.default.subscribe(guitarPlayer);

  const $root = document.querySelector('.jsuitar-app');
  const ui = (0, _ui2.default)($root);
  _chordEmitter2.default.subscribe(ui);
};

window.onload = main;
},{"./guitar":7,"./guitar-player":8,"./stroke-emitter":9,"./pluck-emitter":10,"./chord-emitter":11,"./ui":12}],0:[function(require,module,exports) {
var global = (1, eval)('this');
var OldModule = module.bundle.Module;
function Module() {
  OldModule.call(this);
  this.hot = {
    accept: function (fn) {
      this._acceptCallback = fn || function () {};
    },
    dispose: function (fn) {
      this._disposeCallback = fn;
    }
  };
}

module.bundle.Module = Module;

if (!module.bundle.parent && typeof WebSocket !== 'undefined') {
  var ws = new WebSocket('ws://' + window.location.hostname + ':58474/');
  ws.onmessage = function(event) {
    var data = JSON.parse(event.data);

    if (data.type === 'update') {
      data.assets.forEach(function (asset) {
        hmrApply(global.require, asset);
      });

      data.assets.forEach(function (asset) {
        if (!asset.isNew) {
          hmrAccept(global.require, asset.id);
        }
      });
    }

    if (data.type === 'reload') {
      ws.close();
      ws.onclose = function () {
        window.location.reload();
      }
    }

    if (data.type === 'error-resolved') {
      console.log('[parcel] ✨ Error resolved');
    }

    if (data.type === 'error') {
      console.error('[parcel] 🚨  ' + data.error.message + '\n' + 'data.error.stack');
    }
  };
}

function getParents(bundle, id) {
  var modules = bundle.modules;
  if (!modules) {
    return [];
  }

  var parents = [];
  var k, d, dep;

  for (k in modules) {
    for (d in modules[k][1]) {
      dep = modules[k][1][d];
      if (dep === id || (Array.isArray(dep) && dep[dep.length - 1] === id)) {
        parents.push(+k);
      }
    }
  }

  if (bundle.parent) {
    parents = parents.concat(getParents(bundle.parent, id));
  }

  return parents;
}

function hmrApply(bundle, asset) {
  var modules = bundle.modules;
  if (!modules) {
    return;
  }

  if (modules[asset.id] || !bundle.parent) {
    var fn = new Function('require', 'module', 'exports', asset.generated.js);
    asset.isNew = !modules[asset.id];
    modules[asset.id] = [fn, asset.deps];
  } else if (bundle.parent) {
    hmrApply(bundle.parent, asset);
  }
}

function hmrAccept(bundle, id) {
  var modules = bundle.modules;
  if (!modules) {
    return;
  }

  if (!modules[id] && bundle.parent) {
    return hmrAccept(bundle.parent, id);
  }

  var cached = bundle.cache[id];
  if (cached && cached.hot._disposeCallback) {
    cached.hot._disposeCallback();
  }

  delete bundle.cache[id];
  bundle(id);

  cached = bundle.cache[id];
  if (cached && cached.hot && cached.hot._acceptCallback) {
    cached.hot._acceptCallback();
    return true;
  }

  return getParents(global.require, id).some(function (id) {
    return hmrAccept(global.require, id)
  });
}
},{}]},{},[0,6])