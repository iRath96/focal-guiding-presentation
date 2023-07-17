import {Line, Ray, makeScene2D} from '@motion-canvas/2d';
import {createSignal} from '@motion-canvas/core';
import { Curve2f, Ray2f, Vector2f, curve2f_intersect, curve2f_normal, curve2f_rasterize, ray2f_evaluate, vec2f, vec2f_add, vec2f_multiply, vec2f_normalized, vec2f_refract, vec3f } from '../rt/math';

export default makeScene2D(function* (view) {
  const curve: Curve2f = {
    t: {
      x: vec3f(500,0,10),
      y: vec3f(0,500,10),
      z: vec3f(0,0,1),
    },
    c0: -0.1,
    c2: -0.1,
    c4: -0.3,
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
        vec2f_refract(normal(), ray().d, 0.7)
      , 150))}
      endArrow
      stroke="#00ff00"
      lineWidth={4}
    />
  )

  yield* d(-0.9, 0).to(0.9, 5).to(-0.9, 5)
});
