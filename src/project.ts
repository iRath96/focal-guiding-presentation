import {makeProject} from '@motion-canvas/core'

import focal_points from './scenes/focal_points?scene'
import lts_algorithms from './scenes/lts_algorithms?scene'
import our_approach from './scenes/our_approach?scene'

import audio from '../audio/focal-points.mp3'

export default makeProject({
  audio,
  scenes: [
    focal_points,
    lts_algorithms,
    our_approach,
  ],
})
