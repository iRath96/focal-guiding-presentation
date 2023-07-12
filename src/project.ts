import {makeProject} from '@motion-canvas/core';

import example from './scenes/example?scene';
import quadtree from './scenes/quadtree?scene';

export default makeProject({
  scenes: [
    //example,
    quadtree,
  ],
});
