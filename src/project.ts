import {makeProject} from '@motion-canvas/core';

import example from './scenes/example?scene';
import quadtree from './scenes/quadtree?scene';
import vmf from './scenes/vmf?scene';
import lens from './scenes/lens?scene';

export default makeProject({
  scenes: [
    //example,
    //quadtree,
    //vmf,
    lens,
  ],
});
