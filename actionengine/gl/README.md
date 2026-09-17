# Shader variants & custom vertex attributes

The GL pipeline lets a game register its own shader variants and its own custom per-triangle vertex
data, without editing any engine file. This doc covers both mechanisms and how they fit together.

## The pieces

- `shaderregistry.js` — `ShaderRegistry`, where shader variants register themselves. Each shader
  pipeline (object, line, and so on) gets its own independent namespace via `ShaderRegistry.for(kind)`.
- `customattributes.js` — `CustomAttributeRegistry`, where a game defines extra per-triangle values it
  wants uploaded to the GPU alongside position/normal/color/etc. (object pipeline only - see below).
- `shaders/objectshader.js` — the built-in `default` and `virtualboy` object-shader variants.
- `shaders/lineshader.js` — the built-in `default` and `virtualboy` line-shader variants.
- `shaders/spriteshader.js`, `shaders/watershader.js`, `shaders/particleshader.js` — each has one
  built-in `default` variant, registered the same way.
- `programmanager.js` — compiles and caches one WebGL program per registered variant, per pipeline, and
  exposes `setObjectShaderVariant(name)`, `setLineShaderVariant(name)`, `setWaterShaderVariant(name)`,
  and `setParticleShaderVariant(name)` to switch which one is active for each of those pipelines.
- `rendering/renderers/actionrenderer3D/spriteRenderer3D.js` — owns the sprite pipeline's program
  directly (not through `ProgramManager`); switch its variant with its own
  `spriteRenderer.setShaderVariant(name)`.
- `shaders/shadowshader.js` — the built-in `default` variants for the two shadow techniques,
  `shadow-directional` and `shadow-omni` (see below).

**Current coverage:** the object, line, sprite, water, and particle pipelines each support ONE active
variant at a time, the way you'd expect. Shadows are different: a scene can have a directional light
AND point lights casting shadows in the same frame, so there are two independent shadow techniques
active simultaneously rather than one swappable "look" for the whole pipeline. Each technique gets its
own namespace instead: `ShaderRegistry.for('shadow-directional')` and `ShaderRegistry.for('shadow-omni')`,
switched independently via `programManager.setShadowDirectionalVariant(name)` /
`setShadowOmniVariant(name)`. Both are shared across every light of that type (all directional lights
use the one active `shadow-directional` program) rather than each light instance compiling its own.

## 1. Registering a shader variant

A "shader variant" is a complete, independent vertex+fragment pair for one pipeline. Only one variant
per pipeline is active at a time; switching a pipeline's variant swaps its look for everything drawn
through that pipeline, not just one object.

To add your own object-shader variant, create a class that exposes `getVertexShader()`/
`getFragmentShader()` (each returning a GLSL source string), then register it into that pipeline's
namespace:

```js
// mygame/shaders/GlowObjectShader.js
class GlowObjectShader {
    getVertexShader() {
        return `#version 300 es
        // ... your vertex shader ...
        `;
    }

    getFragmentShader() {
        return `#version 300 es
        precision highp float;
        // ... your fragment shader ...
        out vec4 fragColor;
        void main() {
            fragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }`;
    }
}

ShaderRegistry.for('object').register('glow', {
    getVertexShader: GlowObjectShader.prototype.getVertexShader,
    getFragmentShader: GlowObjectShader.prototype.getFragmentShader
});
```

Load this file after `shaderregistry.js` and before anything that switches to the `'glow'` variant. A
line, water, or particle shader variant follows the exact same shape, registered into
`ShaderRegistry.for('line')` / `ShaderRegistry.for('water')` / `ShaderRegistry.for('particle')` instead.
A shadow variant follows the same shape too, registered into `ShaderRegistry.for('shadow-directional')`
or `ShaderRegistry.for('shadow-omni')` depending on which technique it replaces.

Then, once at startup (or whenever you want to switch that pipeline's look):

```js
renderer3D.programManager.setObjectShaderVariant('glow');
renderer3D.programManager.setLineShaderVariant('myLineVariant');
renderer3D.programManager.setWaterShaderVariant('myWaterVariant');
renderer3D.programManager.setParticleShaderVariant('myParticleVariant');
renderer3D.programManager.setShadowDirectionalVariant('myShadowVariant');
renderer3D.programManager.setShadowOmniVariant('myOmniShadowVariant');

// Sprites are the one exception - SpriteRenderer3D owns its own program directly, not ProgramManager:
renderer3D.spriteRenderer.setShaderVariant('mySpriteVariant');
```

That's it — everything drawn through that pipeline from that point on uses your shader instead of
`default`, until you call the setter again. `ProgramManager` compiles each variant's program once and
caches it by name (per pipeline), so switching back and forth after the first time is cheap (no
recompilation).

**Pipelines are independent.** Switching the object shader variant never switches the line shader
variant, or vice versa — each `set<Kind>ShaderVariant` call only ever affects its own pipeline. If you
want two pipelines' variants to visually match (e.g. a stylized look that should apply to both objects
and debug lines), call both setters yourself:

```js
renderer3D.programManager.setObjectShaderVariant('virtualboy');
renderer3D.programManager.setLineShaderVariant('virtualboy');
```

### Starting from a copy of `default`

The easiest way to build a new variant that's mostly like the built-in look, plus your own additions,
is to **copy** the relevant shader file's `getDefaultVertexShader`/`getDefaultFragmentShader` GLSL into
your own file and edit the copy directly. Don't try to programmatically extend or subclass the
built-in shader — GLSL source is just a string, and a real, independent copy is far easier to reason
about (and to diff against the original later) than string-splicing or template composition.

### Uniforms your variant can rely on

For the object pipeline, `getStandardShaderLocations` in `programmanager.js` looks up a large, fixed
set of attribute and uniform names on your compiled program (camera matrices, lights, shadow maps,
material properties, `uTime`, and more). Your shader is free to declare and use as many or as few of
these as it needs — declaring one that `default` doesn't currently read (like `uTime`) is fine, since
the location lookup already exists; you may need to add a line in
`ObjectRenderer3D._setFrameConstantUniforms` if a uniform your variant needs isn't already being set
every frame. The line pipeline's location set is much smaller (position, projection/view matrices,
color, time) - see `initializeLineShader`/`setLineShaderVariant` in `programmanager.js`.

## 2. Custom per-triangle vertex attributes (object pipeline)

Sometimes an object-shader variant needs data that has nothing to do with the built-in attribute set —
a per-surface intensity value, a category flag, anything you want to vary per-triangle and read back in
your shader. `CustomAttributeRegistry` lets you define as many of these as you want, with no limit and
no further engine changes required after this system exists.

**Define the attribute once**, before any mesh that uses it is first drawn:

```js
CustomAttributeRegistry.define('glowStrength', { defaultValue: 0 });
```

**Set it on triangles that should carry a non-default value:**

```js
triangle.custom = { glowStrength: 1.0 };
```

Any triangle that never sets `triangle.custom.glowStrength` gets the attribute's `defaultValue`
automatically — existing meshes that don't know this attribute exists are completely unaffected.

**Read it in your shader** under the generated name `aCustom_<name>` (vertex stage) — pass it through
as a varying to use it in the fragment stage, exactly like any other per-vertex attribute:

```glsl
// vertex shader
in float aCustom_glowStrength;
flat out float vGlowStrength;
...
vGlowStrength = aCustom_glowStrength;
```

```glsl
// fragment shader
flat in float vGlowStrength;
...
color += emissiveColor * vGlowStrength;
```

A shader that doesn't declare `aCustom_glowStrength` simply never receives it — `ObjectRenderer3D` only
binds a custom attribute's buffer when the currently active program actually declares that attribute
name, so defining new custom attributes never affects variants that don't use them.

### Notes

- Custom attribute values are per-vertex floats. If you need more structure (colors, flags, several
  related numbers), define several named attributes rather than trying to pack multiple meanings into
  one number.
- Values participate in the renderer's vertex-merge/dedup pass, so two triangles with different custom
  values on a shared vertex are correctly kept distinct (never silently averaged or collapsed).
- Custom attributes are static per-triangle data. If you need something that changes continuously
  (e.g. animated over time), read `uTime` in your shader and compute the animation there instead of
  updating the custom value every frame.
- This system is currently wired into the object pipeline (`ObjectRenderer3D`) only.

## Summary

| I want to...                                        | Use                                                             |
|------------------------------------------------------|------------------------------------------------------------------|
| Change the shading for the whole scene (objects)      | Register + switch to a new object shader variant (`ShaderRegistry.for('object')`) |
| Change the look of debug/line drawing                 | Register + switch to a new line shader variant (`ShaderRegistry.for('line')`) |
| Change the look of billboarded sprites                | Register into `ShaderRegistry.for('sprite')`, then `spriteRenderer.setShaderVariant(name)` |
| Change the look of water                              | Register + switch to a new water shader variant (`ShaderRegistry.for('water')`) |
| Change the look of GPU particles                      | Register + switch to a new particle shader variant (`ShaderRegistry.for('particle')`) |
| Change directional-light shadow rendering              | Register + switch a `ShaderRegistry.for('shadow-directional')` variant |
| Change point-light (omnidirectional) shadow rendering  | Register + switch a `ShaderRegistry.for('shadow-omni')` variant  |
| Pass extra per-triangle data into an object shader    | `CustomAttributeRegistry.define(...)` + `triangle.custom`        |
| Do both together (extra data used by a custom look)   | Define the attribute, then read it in your own variant's GLSL    |

Both systems are additive and permanent: once registered/defined, they're available to any future
variant or feature without touching `objectrenderer3D.js`, `triangle.js`, or `programmanager.js` again.
