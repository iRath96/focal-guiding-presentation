import {makeProject} from '@motion-canvas/core'

import focal_points from './scenes/focal_points?scene'
import audio from '../audio/focal-points.mp3'

export default makeProject({
  audio,
  scenes: [
    focal_points,
  ],
})
