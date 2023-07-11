import {Circle, Line, Ray, makeScene2D} from '@motion-canvas/2d';
import {all, createRef, createSignal} from '@motion-canvas/core';
import { Curve2f, Ray2f, Vector2f, curve2f_eval, curve2f_intersect, curve2f_normal, mat33f_multiply, ray2f_evaluate, vec2f, vec2f_add, vec2f_multiply, vec2f_normalized, vec2f_refract, vec3f, vec3f_homogeneous_project } from '../rt/math';

/*import { PerspectiveCamera3f, Scene3f, quad3f_box, vec3f } from 'rt/math';

const scene: Scene3f = {
  quads: [
    ...quad3f_box()
  ]
}

const camera: PerspectiveCamera3f = new PerspectiveCamera3f(
  vec3f(0, 0, -10),
  vec3f(0, 0, 1),
  vec3f(0, 1, 0),
  30, 30
)*/

function curve2f_rasterize(curve: Curve2f, segments: number) {
  const points: ([number, number])[] = []
  for (let i = 0; i < segments; i++) {
    const x = 2 * i / (segments - 1) - 1
    const y = curve2f_eval(curve, x)
    const p = vec3f_homogeneous_project(mat33f_multiply(curve.t, vec3f(x, y, 1)))
    points.push([ p.x, p.y ])
  }
  return points
}

export default makeScene2D(function* (view) {
  const curve: Curve2f = {
    t: {
      x: vec3f(500,0,10),
      y: vec3f(0,500,10),
      z: vec3f(0,0,1),
    },
    c0: -0.8,
    c2: -0.2,
    c4: 0.5,
  }

  view.add(
    <Line
      points={[
        ...curve2f_rasterize(curve, 64)
      ]}
      stroke="#ffffff"
      lineWidth={4}
      />,
  )

  const d = createSignal(0)
  const ray = createSignal<Ray2f>(() => ({
    o: vec2f(0, 300),
    d: vec2f_normalized(vec2f(d(), -1)),
  }))

  const isect = createSignal(() =>
    curve2f_intersect(curve, ray()))
  
  const hitpoint = createSignal<Vector2f>(() =>
    ray2f_evaluate(ray(), isect().t))

  const normal = createSignal<Vector2f>(() => 
    curve2f_normal(curve, isect().x))

  view.add(
    <Ray
      from={() => ray().o}
      to={() => hitpoint()}
      endArrow
      stroke="#ffffff"
      lineWidth={4}
    />
  )

  view.add(
    <Ray
      from={() => hitpoint()}
      to={() => vec2f_add(hitpoint(), vec2f_multiply(normal(), 150))}
      endArrow
      stroke="#ff0000"
      lineWidth={4}
    />
  )

  view.add(
    <Ray
      from={() => hitpoint()}
      to={() => vec2f_add(hitpoint(), vec2f_multiply(
        vec2f_refract(normal(), ray().d, 0.1)
      , 150))}
      endArrow
      stroke="#00ff00"
      lineWidth={4}
    />
  )

  yield* d(-0.9, 0).to(0.9, 3).to(-0.9, 3)
});
